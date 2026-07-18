import {
  buildHandoffStartUrl,
  checkRequestAccess,
  clearHandoffCookie,
  jsonResponse,
  REQUIRED_PERMISSION,
} from "../../_lib/access-gate.js";

export async function onRequestGet({ request, env }) {
  const decision = await checkRequestAccess(request, env);

  if (decision.kind === "allowed") {
    return jsonResponse({
      authenticated: true,
      allowed: true,
      permission: REQUIRED_PERMISSION,
      user: decision.user,
    });
  }

  if (decision.kind === "unauthenticated") {
    return jsonResponse(
      {
        authenticated: false,
        allowed: false,
        permission: REQUIRED_PERMISSION,
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
        permission: REQUIRED_PERMISSION,
        reason: decision.reason,
      },
      403,
    );
  }

  return jsonResponse(
    {
      authenticated: null,
      allowed: false,
      permission: REQUIRED_PERMISSION,
      reason: "user_system_unavailable",
    },
    503,
  );
}
