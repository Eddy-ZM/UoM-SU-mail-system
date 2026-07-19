import { publicPathFromRestriction } from "../../shared/service-restriction.js";

export const REQUIRED_PERMISSION = "service:uom-su-mail-system:access";
export const HANDOFF_AUDIENCE = "uom-su-mail-system";
export const HANDOFF_COOKIE_NAME = "__Host-uom_su_mail_handoff";

const DEFAULT_USER_SYSTEM_ORIGIN = "https://user.chemvault.science";
const DEFAULT_ACCESS_TIMEOUT_MS = 5000;
const DEFAULT_SHARED_SESSION_COOKIE_NAME = "chemvault_session";

export function getUserSystemOrigin(env = {}) {
  const configuredOrigin = env.USER_AUTH_ORIGIN || DEFAULT_USER_SYSTEM_ORIGIN;
  const url = new URL(configuredOrigin);
  if (url.protocol !== "https:" && url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
    throw new Error("USER_AUTH_ORIGIN must use HTTPS outside local development.");
  }
  return url.origin;
}

export function isPublicRequestPath(pathname) {
  if (pathname.startsWith("/.well-known/")) return true;
  if (pathname === "/agreement/privacy-notice" || pathname === "/agreement/privacy-notice/") return true;
  if (pathname === "/verify" || pathname === "/verify/" || pathname === "/api/verification") return true;
  if (pathname === "/api/access/logout") return true;
  if (pathname.startsWith("/assets/")) return true;
  return pathname === "/favicon.ico" || pathname === "/robots.txt" || pathname === "/site.webmanifest";
}

export function buildHandoffStartUrl(request, env = {}) {
  const handoffUrl = new URL("/api/auth/handoff/start", getUserSystemOrigin(env));
  handoffUrl.searchParams.set("returnTo", cleanEditorReturnUrl(request));
  return handoffUrl.toString();
}

export function cleanEditorReturnUrl(request) {
  const requestUrl = new URL(request.url);
  if (requestUrl.pathname.startsWith("/api/")) return `${requestUrl.origin}/`;
  requestUrl.searchParams.delete("token");
  requestUrl.searchParams.delete("provider");
  return requestUrl.toString();
}

export function readHandoffCallbackToken(request) {
  const requestUrl = new URL(request.url);
  const token = requestUrl.searchParams.get("token");
  const provider = requestUrl.searchParams.get("provider");
  if (!token || (provider && provider !== "chemvault-user")) return null;
  return isSafeToken(token) ? token : null;
}

export function readHandoffCookie(request) {
  return readCookie(request.headers.get("cookie") || "", HANDOFF_COOKIE_NAME);
}

export function handoffCookie(token, expiresAt) {
  const expiresAtSeconds = Number(expiresAt);
  const remainingSeconds = Number.isFinite(expiresAtSeconds)
    ? Math.max(1, Math.floor(expiresAtSeconds - Date.now() / 1000))
    : null;
  const maxAge = remainingSeconds ? `; Max-Age=${Math.min(remainingSeconds, 86400)}` : "";
  return `${HANDOFF_COOKIE_NAME}=${encodeURIComponent(token)}${maxAge}; Path=/; HttpOnly; Secure; SameSite=Lax`;
}

export function clearHandoffCookie() {
  return `${HANDOFF_COOKIE_NAME}=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax`;
}

export async function checkRequestAccess(request, env = {}, fetchImplementation = fetch) {
  const handoffToken = readHandoffCookie(request);
  if (handoffToken) return verifyHandoffAccess(handoffToken, request, env, fetchImplementation);

  const sharedCookieName = env.USER_SESSION_COOKIE_NAME || DEFAULT_SHARED_SESSION_COOKIE_NAME;
  const sharedSession = readCookie(request.headers.get("cookie") || "", sharedCookieName);
  if (!sharedSession) return { kind: "unauthenticated", reason: "handoff_required" };

  return checkSharedCookieAccess(request, env, fetchImplementation);
}

export async function verifyHandoffAccess(token, request, env = {}, fetchImplementation = fetch) {
  if (!isSafeToken(token)) return { kind: "unauthenticated", reason: "invalid_handoff_token" };

  let verifyUrl;
  try {
    verifyUrl = new URL("/api/auth/handoff/verify", getUserSystemOrigin(env));
  } catch {
    return { kind: "unavailable", reason: "invalid_user_system_origin" };
  }
  verifyUrl.searchParams.set("audience", HANDOFF_AUDIENCE);
  verifyUrl.searchParams.set("permission", REQUIRED_PERMISSION);

  const headers = forwardedHeaders(request);
  headers.set("authorization", `Bearer ${token}`);
  headers.delete("cookie");
  const response = await fetchUserSystem(verifyUrl, headers, env, fetchImplementation);
  if (response.kind) return response;

  const { httpResponse } = response;
  if (httpResponse.status === 401) return { kind: "unauthenticated", reason: "handoff_expired" };
  if (httpResponse.status === 403) return { kind: "forbidden", reason: "user_system_denied" };
  if (!httpResponse.ok) return { kind: "unavailable", reason: "user_system_unavailable" };

  const payload = await parseJson(httpResponse);
  if (!payload) return { kind: "unavailable", reason: "invalid_user_system_response" };
  if (payload.access?.allowed !== true) {
    return {
      kind: "forbidden",
      reason: typeof payload.access?.reason === "string" ? payload.access.reason : "permission_not_granted",
      handoffExpiresAt: payload.handoff?.expiresAt,
    };
  }

  const user = normalizedUser(payload.user);
  if (!user) return { kind: "unavailable", reason: "invalid_user_system_profile" };
  return {
    kind: "allowed",
    reason: typeof payload.access.reason === "string" ? payload.access.reason : "permission_granted",
    user,
    handoffExpiresAt: payload.handoff?.expiresAt,
    authentication: "handoff",
  };
}

export async function checkSharedCookieAccess(request, env = {}, fetchImplementation = fetch) {
  let accessUrl;
  try {
    accessUrl = new URL("/api/access/check", getUserSystemOrigin(env));
  } catch {
    return { kind: "unavailable", reason: "invalid_user_system_origin" };
  }
  accessUrl.searchParams.set("permission", REQUIRED_PERMISSION);

  const response = await fetchUserSystem(accessUrl, forwardedHeaders(request), env, fetchImplementation);
  if (response.kind) return response;

  const { httpResponse } = response;
  if (httpResponse.status === 401) return { kind: "unauthenticated", reason: "login_required" };
  if (httpResponse.status === 403) return { kind: "forbidden", reason: "user_system_denied" };
  if (!httpResponse.ok) return { kind: "unavailable", reason: "user_system_unavailable" };

  const payload = await parseJson(httpResponse);
  if (!payload) return { kind: "unavailable", reason: "invalid_user_system_response" };
  if (payload.allowed !== true) {
    return {
      kind: "forbidden",
      reason: typeof payload.reason === "string" ? payload.reason : "permission_not_granted",
    };
  }

  const user = normalizedUser(payload.user);
  if (!user) return { kind: "unavailable", reason: "invalid_user_system_profile" };
  return {
    kind: "allowed",
    reason: typeof payload.reason === "string" ? payload.reason : "permission_granted",
    user,
    authentication: "shared-cookie",
  };
}

async function fetchUserSystem(url, headers, env, fetchImplementation) {
  const timeoutValue = Number(env.USER_AUTH_TIMEOUT_MS);
  const timeoutMs = Number.isFinite(timeoutValue) && timeoutValue > 0 ? timeoutValue : DEFAULT_ACCESS_TIMEOUT_MS;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const httpResponse = await fetchImplementation(url, {
      method: "GET",
      headers,
      redirect: "manual",
      signal: controller.signal,
    });
    return { httpResponse };
  } catch {
    return { kind: "unavailable", reason: "user_system_request_failed" };
  } finally {
    clearTimeout(timeout);
  }
}

function forwardedHeaders(request) {
  const headers = new Headers({ accept: "application/json" });
  const cookie = request.headers.get("cookie");
  const userAgent = request.headers.get("user-agent");
  const connectingIp = request.headers.get("cf-connecting-ip");
  if (cookie) headers.set("cookie", cookie);
  if (userAgent) headers.set("user-agent", userAgent);
  if (connectingIp) headers.set("cf-connecting-ip", connectingIp);
  return headers;
}

function readCookie(cookieHeader, name) {
  for (const pair of cookieHeader.split(";")) {
    const [rawName, ...rawValue] = pair.trim().split("=");
    if (rawName !== name) continue;
    try {
      const value = decodeURIComponent(rawValue.join("="));
      return isSafeToken(value) ? value : null;
    } catch {
      return null;
    }
  }
  return null;
}

function isSafeToken(value) {
  return typeof value === "string" && value.length >= 20 && value.length <= 8192 && /^[A-Za-z0-9._~-]+$/.test(value);
}

async function parseJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function normalizedUser(user) {
  if (!user || typeof user.id !== "string" || typeof user.email !== "string") return null;
  return {
    id: user.id,
    email: user.email,
    name: typeof user.name === "string" && user.name.trim() ? user.name.trim() : null,
    avatarUrl: typeof user.avatarUrl === "string" && user.avatarUrl.trim() ? user.avatarUrl.trim() : null,
    systemRole: typeof user.systemRole === "string" ? user.systemRole : "user",
  };
}

export function noStoreHeaders(extraHeaders = {}) {
  return new Headers({
    "cache-control": "private, no-store, max-age=0",
    pragma: "no-cache",
    vary: "Cookie",
    "x-content-type-options": "nosniff",
    "referrer-policy": "no-referrer",
    ...extraHeaders,
  });
}

export function jsonResponse(payload, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: noStoreHeaders({ "content-type": "application/json; charset=utf-8", ...extraHeaders }),
  });
}

export function gatePageResponse(title, message, status, extraHeaders = {}) {
  const safeTitle = escapeHtml(title);
  const safeMessage = escapeHtml(message);
  const isRestricted = Number(status) === 403;
  const statusLabel = isRestricted ? "Pre-release access" : "Secure access check";
  const serviceLabel = isRestricted ? "Limited access" : "Identity verification";
  const position = isRestricted
    ? `<section class="position" aria-label="Current access position">
          <h2>Current access position</h2>
          <dl>
            <div><dt>Main workspace</dt><dd class="restricted">Restricted</dd></div>
            <div><dt>Archive services</dt><dd>Viewing and creation unavailable</dd></div>
            <div><dt>Public verification</dt><dd class="available">Available</dd></div>
          </dl>
        </section>`
    : `<aside class="advisory">Access will remain closed until your account and permission can be verified securely.</aside>`;
  const primaryAction = isRestricted
    ? `<a class="primary" href="${publicPathFromRestriction("/verify/")}">Open public verification</a>`
    : `<a class="primary" href="/">Try access again</a>`;
  const privacyHref = isRestricted
    ? publicPathFromRestriction("/agreement/privacy-notice/")
    : "/agreement/privacy-notice/";
  const signOutAction = isRestricted
    ? `<form method="post" action="/api/access/logout"><button type="submit">Sign out</button></form>`
    : "";
  const body = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${safeTitle} | Manchester Chemistry Representative Mail Studio</title>
    <style>
      :root { color: #262028; background: #e8e8ed; font-family: Arial, Helvetica, sans-serif; }
      * { box-sizing: border-box; }
      body { min-height: 100vh; margin: 0; display: grid; place-items: center; padding: clamp(22px,5vw,64px); background: #e8e8ed; }
      main { width: min(920px,100%); overflow: hidden; background: #fff; border-top: 6px solid #660099; box-shadow: 0 22px 52px rgba(32,27,36,.14); }
      .masthead { min-height: 126px; display: flex; align-items: center; justify-content: space-between; gap: 36px; padding: 20px clamp(28px,5vw,52px); border-bottom: 1px solid #d6d2d8; }
      .identity { display: flex; flex: 1 1 420px; flex-direction: column; gap: 5px; max-width: 520px; padding-left: 20px; border-left: 5px solid #660099; }
      .identity span, .status span { color: #660099; font-size: 10px; font-weight: 800; letter-spacing: 1.5px; text-transform: uppercase; }
      .identity strong { color: #241d28; font-family: Georgia,"Times New Roman",serif; font-size: clamp(20px,2.2vw,27px); line-height: 1.15; }
      .status { display: flex; flex-direction: column; gap: 5px; padding-left: 28px; text-align: right; border-left: 1px solid #c9c3cc; }
      .status span { color: #5f5663; letter-spacing: .35px; }
      .status strong { color: #2c2630; font-size: 17px; }
      .service-strip { min-height: 42px; display: flex; align-items: center; justify-content: space-between; gap: 22px; padding: 9px clamp(28px,5vw,52px); color: #fff; background: #2b2530; border-bottom: 4px solid #660099; font-size: 11px; }
      .service-strip strong { color: #ffcc33; font-size: 10px; letter-spacing: 1.1px; text-transform: uppercase; }
      .body { padding: clamp(42px,6vw,64px) clamp(28px,6vw,64px) clamp(38px,5vw,54px); }
      .kicker { margin: 0 0 14px; color: #660099; font-size: 10px; font-weight: 850; letter-spacing: 1.5px; text-transform: uppercase; }
      h1 { max-width: 700px; margin: 0; color: #241f26; font-size: clamp(36px,5.5vw,56px); font-weight: 650; line-height: 1.03; letter-spacing: -1.7px; }
      .lead { max-width: 700px; margin: 21px 0 0; color: #5f5663; font-size: 15px; line-height: 1.72; }
      .position { margin-top: 34px; border-top: 1px solid #cfc9d2; }
      .position h2 { margin: 0; padding: 15px 0 10px; color: #373039; font-size: 12px; }
      dl { margin: 0; }
      dl div { display: grid; grid-template-columns: minmax(180px,.8fr) minmax(0,1.2fr); gap: 24px; padding: 12px 0; border-top: 1px solid #ddd8df; }
      dt, dd { margin: 0; font-size: 12px; line-height: 1.5; }
      dt { color: #6f6673; font-weight: 700; }
      dd { color: #433a46; font-weight: 800; }
      dd.restricted { color: #b42318; }
      dd.available { color: #287050; }
      .advisory { max-width: 700px; margin-top: 30px; padding: 16px 18px; color: #4c444f; background: #f4f2f5; border-left: 4px solid #660099; font-size: 13px; line-height: 1.6; }
      .actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 30px; }
      .actions form { margin: 0; }
      .actions a, .actions button { min-height: 46px; padding: 0 17px; color: #660099; background: #fff; border: 1px solid #9b8fa0; border-radius: 2px; font: 800 12px/44px Arial,Helvetica,sans-serif; text-decoration: none; }
      .actions button { cursor: pointer; }
      .actions a.primary { color: #fff; background: #660099; border-color: #660099; }
      .footer { display: flex; align-items: center; justify-content: space-between; gap: 28px; padding: 21px clamp(28px,5vw,52px); color: #d8d0dc; background: #211b24; border-top: 4px solid #660099; font-size: 10px; }
      .footer div { display: flex; flex-direction: column; gap: 2px; }
      .footer strong { color: #fff; }
      .footer a { color: #ffcc33; font-weight: 750; text-underline-offset: 2px; }
      a:focus-visible { outline: 3px solid #ffcc33; outline-offset: 3px; }
      @media (max-width: 620px) {
        body { display: block; padding: 0; }
        main { width: 100%; min-height: 100vh; box-shadow: none; }
        .masthead { min-height: 0; align-items: flex-start; flex-direction: column; gap: 18px; }
        .identity { flex-basis: auto; }
        .status { padding: 0; text-align: left; border-left: 0; }
        .service-strip, .footer { align-items: flex-start; flex-direction: column; gap: 5px; }
        dl div { grid-template-columns: 1fr; gap: 3px; }
        .actions { display: grid; }
        .actions a, .actions form, .actions button { width: 100%; text-align: center; }
      }
    </style>
  </head>
  <body>
    <main>
      <header class="masthead">
        <div class="identity"><span>Student representative service</span><strong>Department of Chemistry Student Representatives</strong></div>
        <div class="status"><span>Service status</span><strong>${statusLabel}</strong></div>
      </header>
      <div class="service-strip"><span>Manchester Chemistry Representative Mail Studio</span><strong>${serviceLabel}</strong></div>
      <div class="body">
        <p class="kicker">${isRestricted ? "Pre-release service notice" : "Secure access check"}</p>
        <h1>${safeTitle}</h1>
        <p class="lead">${safeMessage}</p>
        ${position}
        <div class="actions">
          ${primaryAction}
          <a href="https://user.chemvault.science/">Review account access</a>
          ${signOutAction}
        </div>
      </div>
      <footer class="footer">
        <div><strong>Manchester Chemistry Representative Mail Studio</strong><span>Student representative communications service</span></div>
        <a href="${privacyHref}">Privacy notice</a>
      </footer>
    </main>
  </body>
</html>`;

  return new Response(body, {
    status,
    headers: noStoreHeaders({
      "content-type": "text/html; charset=utf-8",
      "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
      ...extraHeaders,
    }),
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
