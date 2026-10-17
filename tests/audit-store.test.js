import test from "node:test";
import assert from "node:assert/strict";
import { endAuditSession, listAuditLog } from "../functions/_lib/audit-store.js";
import { onRequestGet as readAuditLog } from "../functions/api/admin/audit-logs.js";

function statementRecorder(respond) {
  const calls = [];
  return {
    calls,
    db: {
      prepare(sql) {
        return {
          bind(...bindings) {
            const call = { sql, bindings };
            calls.push(call);
            return {
              first: async () => respond(call, "first"),
              all: async () => respond(call, "all"),
              run: async () => respond(call, "run"),
            };
          },
          all: async () => {
            const call = { sql, bindings: [] };
            calls.push(call);
            return respond(call, "all");
          },
        };
      },
    },
  };
}

test("ending an audit session is scoped to the authenticated account and records only a changed session", async () => {
  const fixture = statementRecorder((call, method) => {
    if (method === "run" && /UPDATE audit_sessions/.test(call.sql)) return { meta: { changes: 1 } };
    return { meta: { changes: 1 } };
  });
  const user = { id: "user-1", email: "Person@Example.com", name: "Person" };

  assert.equal(await endAuditSession(fixture.db, user, "mobile-session", "logout"), true);
  const update = fixture.calls.find((call) => /UPDATE audit_sessions/.test(call.sql));
  assert.match(update.sql, /actor_user_id = \? AND actor_email = \?/);
  assert.deepEqual(update.bindings.slice(-3), ["mobile-session", "user-1", "person@example.com"]);
  assert.equal(fixture.calls.filter((call) => /INSERT OR IGNORE INTO audit_events/.test(call.sql)).length, 1);

  const denied = statementRecorder((call, method) => (
    method === "run" && /UPDATE audit_sessions/.test(call.sql) ? { meta: { changes: 0 } } : { meta: { changes: 1 } }
  ));
  assert.equal(await endAuditSession(denied.db, user, "another-account-session", "logout"), false);
  assert.equal(denied.calls.some((call) => /INSERT OR IGNORE INTO audit_events/.test(call.sql)), false);
});

test("audit listing applies forensic filters and returns account-level presence across all sessions", async () => {
  const fixture = statementRecorder((call, method) => {
    if (method === "first") return { total: 1 };
    if (/SELECT DISTINCT category/.test(call.sql)) return { results: [{ category: "authentication" }, { category: "archive" }] };
    if (/FROM audit_events/.test(call.sql)) return { results: [{ id: "event-1", metadata_json: "{}" }] };
    if (/GROUP BY actor_user_id, actor_email/.test(call.sql)) {
      return { results: [{
        actor_user_id: "user-1", actor_email: "person@example.com", actor_name: "Person",
        actor_role: "representative", session_count: 2, online_session_count: 1,
        signed_out_session_count: 1, inactive_session_count: 0,
        last_seen_at: "2026-10-17T12:00:00.000Z",
      }] };
    }
    if (/FROM audit_sessions/.test(call.sql)) {
      return { results: [{ id: "mobile", actor_email: "person@example.com", ended_at: "2026-10-17T11:59:00.000Z" }] };
    }
    return { results: [] };
  });

  const result = await listAuditLog(fixture.db, {
    action: "auth.logout",
    outcome: "success",
    category: "authentication",
    actorEmail: "PERSON@EXAMPLE.COM",
    since: "2026-10-10T12:00:00Z",
  });

  const count = fixture.calls.find((call) => /SELECT COUNT\(\*\)/.test(call.sql));
  assert.match(count.sql, /category = \?/);
  assert.match(count.sql, /LOWER\(actor_email\) = \?/);
  assert.match(count.sql, /occurred_at >= \?/);
  assert.deepEqual(count.bindings, [
    "auth.logout", "success", "authentication", "person@example.com", "2026-10-10T12:00:00.000Z",
  ]);
  assert.equal(result.accounts[0].state, "online");
  assert.equal(result.accounts[0].session_count, 2);
  assert.equal(result.accounts[0].online_session_count, 1);
  assert.equal(result.accounts[0].signed_out_session_count, 1);
  assert.deepEqual(result.facets.categories, ["authentication", "archive"]);
  assert.deepEqual(result.facets.actors, [{ email: "person@example.com", name: "Person" }]);
  const eventQuery = fixture.calls.find((call) => /ORDER BY occurred_at DESC/.test(call.sql));
  assert.match(eventQuery.sql, /AS client_class/);
});

test("the owner audit API forwards forensic query filters to the store", async () => {
  const fixture = statementRecorder((call, method) => {
    if (method === "first") return { total: 0 };
    return { results: [] };
  });
  const response = await readAuditLog({
    request: new Request("https://mailsys.uomsu.chemvault.science/api/admin/audit-logs?category=archive&actorEmail=REP%40EXAMPLE.COM&since=2026-10-01T00%3A00%3A00Z"),
    data: { mailAccess: { kind: "allowed", user: { id: "owner", email: "ziwen.mu@chemvault.science" } } },
    env: { ARCHIVE_DB: fixture.db },
  });

  assert.equal(response.status, 200);
  const count = fixture.calls.find((call) => /SELECT COUNT\(\*\)/.test(call.sql));
  assert.deepEqual(count.bindings, ["archive", "rep@example.com", "2026-10-01T00:00:00.000Z"]);
});
