import {
  clearHandoffCookie,
  getUserSystemOrigin,
  jsonResponse,
  noStoreHeaders,
} from "../../_lib/access-gate.js";

export function onRequestPost({ request, env }) {
  const returnTo = new URL("/", request.url).toString();
  const logoutUrl = new URL("/api/auth/logout/redirect", getUserSystemOrigin(env));
  logoutUrl.searchParams.set("returnTo", returnTo);

  if (!request.headers.get("accept")?.includes("application/json")) {
    return new Response(null, {
      status: 303,
      headers: noStoreHeaders({
        location: logoutUrl.toString(),
        "set-cookie": clearHandoffCookie(),
      }),
    });
  }

  return jsonResponse(
    { ok: true, logoutUrl: logoutUrl.toString() },
    200,
    { "set-cookie": clearHandoffCookie() },
  );
}

export function onRequestGet() {
  return jsonResponse({ ok: false, error: "method_not_allowed" }, 405, { allow: "POST" });
}
