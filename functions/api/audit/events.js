import { jsonResponse } from "../../_lib/access-gate.js";
import { bestEffortAudit, isAllowedClientAuditAction, recordAuditEvent } from "../../_lib/audit-store.js";

export async function onRequestPost(context) {
  const decision = context.data?.mailAccess;
  if (decision?.kind !== "allowed") return jsonResponse({ error: "forbidden" }, 403);
  let payload;
  try { payload = await context.request.json(); } catch { return jsonResponse({ error: "invalid_json" }, 400); }
  if (!isAllowedClientAuditAction(payload?.action)) return jsonResponse({ error: "invalid_action" }, 400);
  await bestEffortAudit(context, recordAuditEvent(context.env.ARCHIVE_DB, decision.user, {
    id: payload.eventId,
    sessionId: payload.sessionId,
    category: "activity",
    action: payload.action,
    outcome: "success",
    method: "CLIENT",
    path: "/",
  }));
  return jsonResponse({ ok: true }, 202);
}
