import {
  buildHandoffStartUrl,
  checkRequestAccess,
  clearHandoffCookie,
  FULL_ACCESS_PERMISSION,
  jsonResponse,
  REQUIRED_PERMISSION,
} from "../../_lib/access-gate.js";

export async function onRequestGet({ request, env }) {
  const decision = await checkRequestAccess(request, env);

  if (decision.kind === "allowed") {
    return jsonResponse({
      authenticated: true,
      allowed: true,
      entryAllowed: true,
      permission: REQUIRED_PERMISSION,
      contentAllowed: true,
      contentPermission: FULL_ACCESS_PERMISSION,
      user: decision.user,
    });
  }

  if (decision.kind === "unauthenticated") {
    return jsonResponse(
      {
        authenticated: false,
        allowed: false,
        entryAllowed: false,
        permission: REQUIRED_PERMISSION,
        contentAllowed: false,
        contentPermission: FULL_ACCESS_PERMISSION,
        loginUrl: buildHandoffStartUrl(request, env),
      },
      401,
      { "set-cookie": clearHandoffCookie() },
    );
  }

  if (decision.kind === "forbidden") {
    return jsonResponse(
      {
        authenticated: true,
        allowed: false,
        entryAllowed: false,
        permission: REQUIRED_PERMISSION,
        contentAllowed: false,
        contentPermission: FULL_ACCESS_PERMISSION,
        reason: decision.reason,
      },
      403,
    );
  }

  if (decision.kind === "restricted") {
    return jsonResponse(
      {
        authenticated: true,
        allowed: false,
        entryAllowed: true,
        permission: REQUIRED_PERMISSION,
        contentAllowed: false,
        contentPermission: FULL_ACCESS_PERMISSION,
        reason: decision.reason,
        user: decision.user,
      },
      403,
    );
  }

  return jsonResponse(
    {
      authenticated: null,
      allowed: false,
      entryAllowed: null,
      permission: REQUIRED_PERMISSION,
      contentAllowed: false,
      contentPermission: FULL_ACCESS_PERMISSION,
      reason: "user_system_unavailable",
    },
    503,
  );
}
