import { jsonResponse } from "../../_lib/access-gate.js";
import { bestEffortAudit, isAllowedClientAuditAction, recordAuditEvent } from "../../_lib/audit-store.js";
import { isValidMessageNumber } from "../../../shared/email-integrity.js";

const ARCHIVE_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL_TARGET_ACTIONS = new Set([
  "composer.opened",
  "composer.resumed",
  "draft.deleted",
  "email.archived",
  "email.html_copied",
  "email.outlook_copied",
  "email.eml_downloaded",
  "email.html_downloaded",
  "email.archive_opened",
  "email.archive_deleted",
  "outlook.authorisation_started",
]);

export function clientAuditTarget(payload = {}) {
  const messageNumber = typeof payload.messageNumber === "string" ? payload.messageNumber.trim() : "";
  const archiveId = typeof payload.archiveId === "string" ? payload.archiveId.trim() : "";
  if (messageNumber && !isValidMessageNumber(messageNumber)) return null;
  if (archiveId && !ARCHIVE_ID_PATTERN.test(archiveId)) return null;
  if (EMAIL_TARGET_ACTIONS.has(payload.action) && !messageNumber) return null;
  const metadata = {};
  if (archiveId) metadata.archiveId = archiveId;
  if (typeof payload.automatic === "boolean") metadata.automatic = payload.automatic;
  return {
    targetType: messageNumber ? "email" : archiveId ? "email_archive" : null,
    targetId: messageNumber || archiveId || null,
    metadata,
  };
}

export async function onRequestPost(context) {
  const decision = context.data?.mailAccess;
  if (decision?.kind !== "allowed") return jsonResponse({ error: "forbidden" }, 403);
  let payload;
  try { payload = await context.request.json(); } catch { return jsonResponse({ error: "invalid_json" }, 400); }
  if (!isAllowedClientAuditAction(payload?.action)) return jsonResponse({ error: "invalid_action" }, 400);
  const target = clientAuditTarget(payload);
  if (!target) return jsonResponse({ error: "invalid_target" }, 400);
  await bestEffortAudit(context, recordAuditEvent(context.env.ARCHIVE_DB, decision.user, {
    id: payload.eventId,
    sessionId: payload.sessionId,
    category: "activity",
    action: payload.action,
    outcome: "success",
    method: "CLIENT",
    path: "/",
    ...target,
  }));
  return jsonResponse({ ok: true }, 202);
}
