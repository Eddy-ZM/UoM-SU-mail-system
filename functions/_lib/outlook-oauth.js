import {
  canonicalizeEmailHtml,
  extractEmbeddedSha256,
  extractMessageNumber,
  extractVerificationCode,
  hasCompleteEmailDocumentStructure,
  hasProtectedUniversityLogo,
  sha256Hex,
} from "../../shared/email-integrity.js";

export const OUTLOOK_OAUTH_COOKIE = "__Host-uom_outlook_oauth";
export const OUTLOOK_GRAPH_SCOPE = "https://graph.microsoft.com/Mail.ReadWrite";
export const OUTLOOK_CALLBACK_PATH = "/api/outlook/callback";

const TRANSACTION_LIFETIME_SECONDS = 10 * 60;
const ALLOWED_OUTLOOK_HOSTS = new Set(["outlook.office.com", "outlook.office365.com"]);

function base64UrlEncode(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

function base64UrlDecode(value) {
  const normalized = String(value || "").replaceAll("-", "+").replaceAll("_", "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function randomToken(size = 32) {
  return base64UrlEncode(crypto.getRandomValues(new Uint8Array(size)));
}

async function stateKey(encodedKey) {
  const raw = base64UrlDecode(encodedKey);
  if (raw.byteLength !== 32) throw new Error("GRAPH_OAUTH_STATE_KEY must contain exactly 32 random bytes.");
  return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

export function outlookConfiguration(env = {}, requestUrl = "https://mailsys.uomsu.chemvault.science/") {
  const clientId = String(env.MS_GRAPH_CLIENT_ID || "").trim();
  const tenantId = String(env.MS_GRAPH_TENANT_ID || "").trim();
  const clientSecret = String(env.MS_GRAPH_CLIENT_SECRET || "").trim();
  const stateSecret = String(env.GRAPH_OAUTH_STATE_KEY || "").trim();
  const redirectUri = String(env.MS_GRAPH_REDIRECT_URI || new URL(OUTLOOK_CALLBACK_PATH, requestUrl).toString()).trim();
  const guidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
  let stateSecretIsSafe = false;
  let redirectIsSafe = false;
  try {
    stateSecretIsSafe = base64UrlDecode(stateSecret).byteLength === 32;
    const redirect = new URL(redirectUri);
    redirectIsSafe = redirect.pathname === OUTLOOK_CALLBACK_PATH
      && (redirect.protocol === "https:" || redirect.hostname === "localhost" || redirect.hostname === "127.0.0.1");
  } catch {
    // Invalid configuration remains disabled without exposing which secret is wrong.
  }
  const configured = Boolean(guidPattern.test(clientId) && guidPattern.test(tenantId) && clientSecret && stateSecretIsSafe && redirectIsSafe);
  return { configured, clientId, tenantId, clientSecret, stateSecret, redirectUri };
}

export async function createOutlookTransaction({ archiveId, userId, stateSecret, now = Date.now() }) {
  const state = randomToken();
  const verifier = randomToken(48);
  const challengeDigest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  const challenge = base64UrlEncode(new Uint8Array(challengeDigest));
  const transaction = { v: 1, state, verifier, archiveId, userId, exp: now + (TRANSACTION_LIFETIME_SECONDS * 1000) };
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await stateKey(stateSecret);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(JSON.stringify(transaction)),
  );
  const sealed = new Uint8Array(iv.byteLength + ciphertext.byteLength);
  sealed.set(iv, 0);
  sealed.set(new Uint8Array(ciphertext), iv.byteLength);
  return { state, verifier, challenge, cookieValue: base64UrlEncode(sealed) };
}

export async function readOutlookTransaction(cookieValue, stateSecret) {
  const sealed = base64UrlDecode(cookieValue);
  if (sealed.byteLength < 29) throw new Error("Invalid Outlook transaction.");
  const iv = sealed.slice(0, 12);
  const ciphertext = sealed.slice(12);
  const key = await stateKey(stateSecret);
  const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
  return JSON.parse(new TextDecoder().decode(plaintext));
}

export function outlookTransactionCookie(value) {
  return `${OUTLOOK_OAUTH_COOKIE}=${value}; Path=/; Max-Age=${TRANSACTION_LIFETIME_SECONDS}; HttpOnly; Secure; SameSite=Lax`;
}

export function clearOutlookTransactionCookie() {
  return `${OUTLOOK_OAUTH_COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;
}

export function readNamedCookie(request, name) {
  const cookies = String(request.headers.get("cookie") || "").split(";");
  for (const cookie of cookies) {
    const separator = cookie.indexOf("=");
    if (separator < 0) continue;
    if (cookie.slice(0, separator).trim() === name) return cookie.slice(separator + 1).trim();
  }
  return "";
}

export function sameOriginRequest(request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

export function transactionMatches(actual, expected) {
  const left = new TextEncoder().encode(String(actual || ""));
  const right = new TextEncoder().encode(String(expected || ""));
  let difference = left.byteLength ^ right.byteLength;
  const length = Math.max(left.byteLength, right.byteLength);
  for (let index = 0; index < length; index += 1) {
    difference |= (left[index] || 0) ^ (right[index] || 0);
  }
  return difference === 0;
}

export function verifiedUserId(user = {}) {
  return String(user.id || user.email || "").trim().toLowerCase();
}

export function trustedOutlookWebLink(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || !ALLOWED_OUTLOOK_HOSTS.has(url.hostname.toLowerCase())) return "";
    url.searchParams.set("ispopout", "1");
    return url.toString();
  } catch {
    return "";
  }
}

export async function archivedEmailIsIntact(archive) {
  try {
    if (!archive?.html || !hasCompleteEmailDocumentStructure(archive.html) || !hasProtectedUniversityLogo(archive.html)) return false;
    if (extractMessageNumber(archive.html) !== archive.messageNumber) return false;
    if (extractEmbeddedSha256(archive.html) !== archive.sha256) return false;
    if (extractVerificationCode(archive.html) !== archive.verificationCode) return false;
    return await sha256Hex(canonicalizeEmailHtml(archive.html)) === archive.sha256;
  } catch {
    return false;
  }
}

export function outlookErrorPage(title, message, status = 400, headers = {}) {
  const safeTitle = String(title).replace(/[&<>"']/gu, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
  const safeMessage = String(message).replace(/[&<>"']/gu, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
  return new Response(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${safeTitle}</title><body style="margin:0;font:16px/1.55 Arial,sans-serif;color:#1f1722;background:#f4f1f5"><main style="max-width:720px;margin:12vh auto;padding:40px;background:#fff;border-top:5px solid #6b0f9c"><p style="color:#6b0f9c;font-weight:700;text-transform:uppercase;letter-spacing:.08em">Outlook draft</p><h1>${safeTitle}</h1><p>${safeMessage}</p><p><a href="/" style="color:#6b0f9c;font-weight:700">Return to the mail studio</a></p></main></body></html>`, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
      "referrer-policy": "no-referrer",
      "x-content-type-options": "nosniff",
      ...headers,
    },
  });
}
