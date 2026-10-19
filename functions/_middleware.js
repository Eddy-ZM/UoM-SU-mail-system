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
import {
  ACCESS_RESTRICTION_MESSAGE,
  ACCESS_RESTRICTION_TITLE,
  SERVICE_ENTRY_DENIED_MESSAGE,
  SERVICE_ENTRY_DENIED_TITLE,
} from "../shared/service-restriction.js";
import { bestEffortAudit, recordAuditEvent } from "./_lib/audit-store.js";

const STATUS_PATH = "/api/access/status";
const CANONICAL_ORIGIN = "https://mailsys.uomsu.chemvault.science";

export async function onRequest(context) {
  const requestUrl = new URL(context.request.url);

  if (
    requestUrl.hostname === "uom-su-mail-system.pages.dev"
    && (context.request.method === "GET" || context.request.method === "HEAD")
    && ["/report", "/report/", "/questionnaire/already-submitted", "/questionnaire/already-submitted/"].includes(requestUrl.pathname)
  ) {
    const canonicalUrl = new URL(`${requestUrl.pathname}${requestUrl.search}`, CANONICAL_ORIGIN);
    return new Response(null, {
      status: 308,
      headers: noStoreHeaders({ location: canonicalUrl.toString() }),
    });
  }

  if (isPublicRequestPath(requestUrl.pathname) || requestUrl.pathname === STATUS_PATH) {
    return context.next();
  }

  const callbackToken = readHandoffCallbackToken(context.request);
  if (callbackToken) {
    const callbackDecision = await verifyHandoffAccess(callbackToken, context.request, context.env);
    if (callbackDecision.kind === "allowed" || (callbackDecision.kind === "restricted" && callbackDecision.handoffExpiresAt)) {
      bestEffortAudit(context, recordAuditEvent(context.env.ARCHIVE_DB, callbackDecision.user, {
        category: "authentication",
        action: "auth.handoff_completed",
        outcome: callbackDecision.kind === "allowed" ? "success" : "denied",
        method: context.request.method,
        path: requestUrl.pathname,
      }));
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
        SERVICE_ENTRY_DENIED_TITLE,
        SERVICE_ENTRY_DENIED_MESSAGE,
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
      SERVICE_ENTRY_DENIED_TITLE,
      SERVICE_ENTRY_DENIED_MESSAGE,
      403,
    );
  }

  if (decision.kind === "restricted") {
    return gatePageResponse(
      ACCESS_RESTRICTION_TITLE,
      ACCESS_RESTRICTION_MESSAGE,
      403,
      {},
      { limitedAccess: true },
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
  if (
    requestUrl.pathname.startsWith("/api/")
    && !requestUrl.pathname.startsWith("/api/audit/")
    && !requestUrl.pathname.startsWith("/api/admin/audit-logs")
  ) {
    bestEffortAudit(context, recordAuditEvent(context.env.ARCHIVE_DB, decision.user, {
      category: "request",
      action: "request.completed",
      outcome: response.status < 400 ? "success" : response.status === 403 ? "denied" : "failure",
      method: context.request.method,
      path: requestUrl.pathname,
      httpStatus: response.status,
    }));
  }
  const headers = new Headers(response.headers);
  for (const [name, value] of noStoreHeaders()) headers.set(name, value);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
