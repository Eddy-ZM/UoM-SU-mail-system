import {
  buildHandoffStartUrl,
  checkRequestAccess,
  cleanEditorReturnUrl,
  clearHandoffCookie,
  gatePageResponse,
  handoffCookie,
  isPublicRequestPath,
  noStoreHeaders,
  readHandoffCallbackToken,
  verifyHandoffAccess,
} from "./_lib/access-gate.js";

const STATUS_PATH = "/api/access/status";

export async function onRequest(context) {
  const requestUrl = new URL(context.request.url);

  if (isPublicRequestPath(requestUrl.pathname) || requestUrl.pathname === STATUS_PATH) {
    return context.next();
  }

  const callbackToken = readHandoffCallbackToken(context.request);
  if (callbackToken) {
    const callbackDecision = await verifyHandoffAccess(callbackToken, context.request, context.env);
    if (callbackDecision.kind === "allowed" || (callbackDecision.kind === "forbidden" && callbackDecision.handoffExpiresAt)) {
      return new Response(null, {
        status: 303,
        headers: noStoreHeaders({
          location: cleanEditorReturnUrl(context.request),
          "set-cookie": handoffCookie(callbackToken, callbackDecision.handoffExpiresAt),
        }),
      });
    }
    if (callbackDecision.kind === "unauthenticated") {
      return new Response(null, {
        status: 302,
        headers: noStoreHeaders({
          location: buildHandoffStartUrl(context.request, context.env),
          "set-cookie": clearHandoffCookie(),
        }),
      });
    }
    if (callbackDecision.kind === "forbidden") {
      return gatePageResponse(
        "Access denied",
        "ChemVault User System rejected this sign-in handoff. Please sign in again or contact a User System administrator.",
        403,
        { "set-cookie": clearHandoffCookie() },
      );
    }
    return gatePageResponse(
      "Authentication unavailable",
      "The editor is closed because ChemVault User System could not verify the sign-in handoff. Please try again shortly.",
      503,
    );
  }

  const decision = await checkRequestAccess(context.request, context.env);
  if (decision.kind === "unauthenticated") {
    return new Response(null, {
      status: 302,
      headers: noStoreHeaders({
        location: buildHandoffStartUrl(context.request, context.env),
        "set-cookie": clearHandoffCookie(),
      }),
    });
  }

  if (decision.kind === "forbidden") {
    return gatePageResponse(
      "Access denied",
      "Your ChemVault account is signed in, but it does not have permission to use this mail editor. Please contact a User System administrator.",
      403,
    );
  }

  if (decision.kind !== "allowed") {
    return gatePageResponse(
      "Authentication unavailable",
      "The editor is closed because ChemVault User System could not verify your account. Please try again shortly.",
      503,
    );
  }

  if (context.data) context.data.mailAccess = decision;
  const response = await context.next();
  const headers = new Headers(response.headers);
  for (const [name, value] of noStoreHeaders()) headers.set(name, value);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
