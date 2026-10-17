import { jsonResponse } from "../../_lib/access-gate.js";
import { bestEffortAudit, endAuditSession, touchAuditSession } from "../../_lib/audit-store.js";

export async function onRequestPost(context) {
  const decision = context.data?.mailAccess;
  if (decision?.kind !== "allowed") return jsonResponse({ error: "forbidden" }, 403);
  let payload;
  try { payload = await context.request.json(); } catch { return jsonResponse({ error: "invalid_json" }, 400); }
  const sessionId = typeof payload?.sessionId === "string" ? payload.sessionId.trim().slice(0, 180) : "";
  if (!sessionId) return jsonResponse({ error: "invalid_session" }, 400);
  if (payload.state === "offline" || payload.state === "logout") {
    await bestEffortAudit(context, endAuditSession(context.env.ARCHIVE_DB, decision.user, sessionId, payload.state === "logout" ? "logout" : "closed"));
  } else {
    await bestEffortAudit(context, touchAuditSession(context.env.ARCHIVE_DB, decision.user, {
      sessionId,
      clientClass: context.request.headers.get("sec-ch-ua-mobile") === "?1" ? "mobile" : "web",
    }));
  }
  return jsonResponse({ ok: true });
}
