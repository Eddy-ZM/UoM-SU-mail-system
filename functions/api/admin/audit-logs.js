import { jsonResponse } from "../../_lib/access-gate.js";
import { isAuditOwner, listAuditLog } from "../../_lib/audit-store.js";

export async function onRequestGet(context) {
  const decision = context.data?.mailAccess;
  if (decision?.kind !== "allowed" || !isAuditOwner(decision.user)) return jsonResponse({ error: "not_found" }, 404);
  try {
    const url = new URL(context.request.url);
    const result = await listAuditLog(context.env.ARCHIVE_DB, {
      q: url.searchParams.get("q"), action: url.searchParams.get("action"),
      outcome: url.searchParams.get("outcome"), limit: url.searchParams.get("limit"), offset: url.searchParams.get("offset"),
      category: url.searchParams.get("category"), actorEmail: url.searchParams.get("actorEmail"),
      since: url.searchParams.get("since"),
    });
    return jsonResponse(result);
  } catch {
    return jsonResponse({ error: "audit_unavailable", message: "The audit log is temporarily unavailable." }, 503);
  }
}
