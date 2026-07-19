import { buildHandoffStartUrl, checkRequestAccess, jsonResponse } from "./access-gate.js";

export async function resolveArchiveAccess(context) {
  const fromMiddleware = context.data?.mailAccess;
  if (fromMiddleware?.kind === "allowed") return fromMiddleware;
  return checkRequestAccess(context.request, context.env);
}

export function archiveAccessError(decision, request, env) {
  if (decision.kind === "unauthenticated") {
    return jsonResponse({ error: "authentication_required", loginUrl: buildHandoffStartUrl(request, env) }, 401);
  }
  if (decision.kind === "forbidden" || decision.kind === "restricted") {
    return jsonResponse({ error: "permission_denied" }, 403);
  }
  return jsonResponse({ error: "authentication_unavailable" }, 503);
}

export function archiveErrorResponse(error) {
  const status = Number.isInteger(error?.status) ? error.status : 503;
  const safeStatus = status >= 400 && status <= 599 ? status : 503;
  const message = safeStatus < 500 && typeof error?.message === "string"
    ? error.message
    : "The archive service is unavailable.";
  return jsonResponse({ error: safeStatus < 500 ? "invalid_archive_request" : "archive_unavailable", message }, safeStatus);
}
