export const AUDIT_OWNER_EMAIL = "ziwen.mu@chemvault.science";

const CLIENT_ACTIONS = new Set([
  "workspace.opened",
  "composer.opened",
  "composer.resumed",
  "draft.deleted",
  "archive.opened",
  "reports.opened",
  "audit.opened",
]);

function clean(value, limit = 180) {
  return typeof value === "string" ? value.trim().slice(0, limit) : "";
}

function actorFrom(user = {}) {
  return {
    id: clean(user.id, 180) || "unknown",
    email: clean(user.email, 254).toLowerCase() || "unknown",
    name: clean(user.name, 180) || null,
    role: clean(user.systemRole || user.role, 80) || null,
  };
}

export function isAuditOwner(user) {
  return clean(user?.email, 254).toLowerCase() === AUDIT_OWNER_EMAIL;
}

export function isAllowedClientAuditAction(action) {
  return CLIENT_ACTIONS.has(action);
}

export async function recordAuditEvent(db, user, input = {}) {
  if (!db?.prepare) return false;
  const actor = actorFrom(user);
  const occurredAt = input.occurredAt || new Date().toISOString();
  const id = clean(input.id, 180) || globalThis.crypto.randomUUID();
  await db.prepare(`
    INSERT OR IGNORE INTO audit_events (
      id, session_id, actor_user_id, actor_email, actor_name, actor_role,
      category, action, target_type, target_id, request_method, request_path,
      http_status, outcome, metadata_json, occurred_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id,
    clean(input.sessionId, 180) || null,
    actor.id,
    actor.email,
    actor.name,
    actor.role,
    clean(input.category, 40) || "activity",
    clean(input.action, 80) || "unknown",
    clean(input.targetType, 60) || null,
    clean(input.targetId, 180) || null,
    clean(input.method, 12) || null,
    clean(input.path, 240) || null,
    Number.isInteger(input.httpStatus) ? input.httpStatus : null,
    ["success", "failure", "denied"].includes(input.outcome) ? input.outcome : "success",
    JSON.stringify(input.metadata && typeof input.metadata === "object" ? input.metadata : {}),
    occurredAt,
  ).run();
  return true;
}

export async function touchAuditSession(db, user, input = {}) {
  if (!db?.prepare) return { created: false };
  const actor = actorFrom(user);
  const sessionId = clean(input.sessionId, 180);
  if (!sessionId) throw new Error("Audit session id is required.");
  const now = input.occurredAt || new Date().toISOString();
  const existing = await db.prepare("SELECT id, ended_at FROM audit_sessions WHERE id = ?").bind(sessionId).first();
  if (!existing) {
    await db.prepare(`
      INSERT INTO audit_sessions (
        id, actor_user_id, actor_email, actor_name, actor_role,
        started_at, last_seen_at, ended_at, end_reason, client_class
      ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?)
    `).bind(sessionId, actor.id, actor.email, actor.name, actor.role, now, now, clean(input.clientClass, 40) || "web").run();
    await recordAuditEvent(db, user, {
      id: `${sessionId}:started`, sessionId, category: "authentication", action: "auth.login",
      outcome: "success", occurredAt: now,
    });
    return { created: true };
  }
  if (!existing.ended_at) {
    await db.prepare("UPDATE audit_sessions SET last_seen_at = ? WHERE id = ? AND ended_at IS NULL").bind(now, sessionId).run();
  }
  return { created: false };
}

export async function endAuditSession(db, user, sessionId, reason = "logout") {
  if (!db?.prepare || !clean(sessionId, 180)) return false;
  const now = new Date().toISOString();
  await db.prepare(`
    UPDATE audit_sessions SET last_seen_at = ?, ended_at = ?, end_reason = ?
    WHERE id = ? AND ended_at IS NULL
  `).bind(now, now, clean(reason, 40) || "logout", clean(sessionId, 180)).run();
  await recordAuditEvent(db, user, {
    id: `${clean(sessionId, 180)}:ended`, sessionId, category: "authentication",
    action: reason === "logout" ? "auth.logout" : "session.ended", outcome: "success", occurredAt: now,
  });
  return true;
}

export async function listAuditLog(db, params = {}) {
  if (!db?.prepare) throw new Error("Audit database is unavailable.");
  const limit = Math.min(Math.max(Number.parseInt(params.limit, 10) || 40, 1), 100);
  const offset = Math.max(Number.parseInt(params.offset, 10) || 0, 0);
  const q = clean(params.q, 120).toLowerCase();
  const action = clean(params.action, 80);
  const outcome = clean(params.outcome, 20);
  const conditions = [];
  const bindings = [];
  if (q) {
    conditions.push("(LOWER(actor_email) LIKE ? OR LOWER(actor_name) LIKE ? OR LOWER(action) LIKE ?)");
    const like = `%${q.replaceAll("%", "\\%").replaceAll("_", "\\_")}%`;
    bindings.push(like, like, like);
  }
  if (action) { conditions.push("action = ?"); bindings.push(action); }
  if (["success", "failure", "denied"].includes(outcome)) { conditions.push("outcome = ?"); bindings.push(outcome); }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const totalRow = await db.prepare(`SELECT COUNT(*) AS total FROM audit_events ${where}`).bind(...bindings).first();
  const result = await db.prepare(`
    SELECT id, session_id, actor_user_id, actor_email, actor_name, actor_role,
      category, action, target_type, target_id, request_method, request_path,
      http_status, outcome, metadata_json, occurred_at
    FROM audit_events ${where}
    ORDER BY occurred_at DESC, id DESC LIMIT ? OFFSET ?
  `).bind(...bindings, limit, offset).all();
  const sessionResult = await db.prepare(`
    SELECT id, actor_email, actor_name, actor_role, started_at, last_seen_at, ended_at, end_reason, client_class
    FROM audit_sessions ORDER BY last_seen_at DESC LIMIT 100
  `).all();
  return {
    events: (result.results || []).map((row) => ({ ...row, metadata: JSON.parse(row.metadata_json || "{}"), metadata_json: undefined })),
    sessions: sessionResult.results || [],
    pagination: { total: Number(totalRow?.total || 0), limit, offset },
    generatedAt: new Date().toISOString(),
  };
}

export function bestEffortAudit(context, promise) {
  const safe = Promise.resolve(promise).catch(() => undefined);
  if (typeof context?.waitUntil === "function") context.waitUntil(safe);
  return safe;
}
