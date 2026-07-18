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
  const body = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${safeTitle} | Manchester Chemistry Representative Mail Studio</title>
    <style>
      :root { color: #211827; background: #e9ebf1; font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      * { box-sizing: border-box; }
      body { min-height: 100vh; margin: 0; display: grid; place-items: center; padding: 24px; background: #e9ebf1; }
      main { width: min(540px, 100%); background: #fff; border-top: 5px solid #660099; box-shadow: 0 18px 46px rgba(43,37,48,.16); padding: 36px; }
      .kicker { color: #660099; font-size: 12px; font-weight: 800; letter-spacing: 1.6px; text-transform: uppercase; }
      h1 { margin: 10px 0 12px; color: #2b2530; font-size: clamp(28px, 5vw, 38px); line-height: 1.08; }
      p { margin: 0; color: #574f5b; font-size: 16px; line-height: 1.65; }
      a { display: inline-block; margin-top: 24px; color: #fff; background: #660099; padding: 12px 18px; border-radius: 4px; font-weight: 750; text-decoration: none; }
      a:focus-visible { outline: 3px solid #ffcc33; outline-offset: 3px; }
    </style>
  </head>
  <body>
    <main>
      <div class="kicker">The University of Manchester</div>
      <h1>${safeTitle}</h1>
      <p>${safeMessage}</p>
      <a href="https://user.chemvault.science/">Open ChemVault User System</a>
    </main>
  </body>
</html>`;

  return new Response(body, {
    status,
    headers: noStoreHeaders({
      "content-type": "text/html; charset=utf-8",
      "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
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
