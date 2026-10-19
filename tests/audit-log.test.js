import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { isAllowedClientAuditAction, isAuditOwner } from "../functions/_lib/audit-store.js";
import { onRequestGet as readAuditLog } from "../functions/api/admin/audit-logs.js";
import { clientAuditTarget, onRequestPost as writeAuditEvent } from "../functions/api/audit/events.js";

test("only the configured owner identity is recognised for audit access", () => {
  assert.equal(isAuditOwner({ email: "ZIWEN.MU@CHEMVAULT.SCIENCE" }), true);
  assert.equal(isAuditOwner({ email: "test@chemvault.science" }), false);
  assert.equal(isAuditOwner({ email: "ziwen.mu@chemvault.science.evil.example" }), false);
});

test("the audit API denies other full-access users before touching D1", async () => {
  const response = await readAuditLog({
    request: new Request("https://mailsys.uomsu.chemvault.science/api/admin/audit-logs"),
    data: { mailAccess: { kind: "allowed", user: { id: "test", email: "test@chemvault.science" } } },
    env: { ARCHIVE_DB: { prepare() { throw new Error("D1 must not be reached"); } } },
  });
  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { error: "not_found" });
});

test("client audit actions are an explicit non-content allowlist", () => {
  assert.equal(isAllowedClientAuditAction("composer.opened"), true);
  assert.equal(isAllowedClientAuditAction("email.archived"), true);
  assert.equal(isAllowedClientAuditAction("email.eml_downloaded"), true);
  assert.equal(isAllowedClientAuditAction("email.body.changed"), false);
  assert.equal(isAllowedClientAuditAction("custom free text"), false);
});

test("email audit targets accept only protected message numbers and UUID archive ids", () => {
  const valid = clientAuditTarget({
    action: "email.archived",
    messageNumber: "CHEM-SR-A1B2C3D4",
    archiveId: "123e4567-e89b-42d3-a456-426614174000",
    automatic: true,
    subject: "must not be retained",
    html: "<p>must not be retained</p>",
  });
  assert.deepEqual(valid, {
    targetType: "email",
    targetId: "CHEM-SR-A1B2C3D4",
    metadata: { archiveId: "123e4567-e89b-42d3-a456-426614174000", automatic: true },
  });
  assert.equal(clientAuditTarget({ action: "email.archived", messageNumber: "student subject" }), null);
  assert.equal(clientAuditTarget({ action: "email.archived", messageNumber: "CHEM-SR-A1B2C3D4", archiveId: "not-an-id" }), null);
  assert.equal(clientAuditTarget({ action: "email.archived" }), null);
});

test("the client audit endpoint stores identifiers without email content", async () => {
  const calls = [];
  const db = { prepare(sql) { return { bind(...bindings) { calls.push({ sql, bindings }); return { run: async () => ({ meta: { changes: 1 } }) }; } }; } };
  const response = await writeAuditEvent({
    request: new Request("https://mailsys.uomsu.chemvault.science/api/audit/events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        eventId: "event-1",
        sessionId: "session-1",
        action: "email.archived",
        messageNumber: "CHEM-SR-A1B2C3D4",
        archiveId: "123e4567-e89b-42d3-a456-426614174000",
        subject: "Private title",
        html: "<p>Private body</p>",
      }),
    }),
    data: { mailAccess: { kind: "allowed", user: { id: "user-1", email: "rep@example.com" } } },
    env: { ARCHIVE_DB: db },
  });
  assert.equal(response.status, 202);
  const stored = calls[0].bindings;
  assert.equal(stored[8], "email");
  assert.equal(stored[9], "CHEM-SR-A1B2C3D4");
  assert.deepEqual(JSON.parse(stored[14]), { archiveId: "123e4567-e89b-42d3-a456-426614174000" });
  assert.equal(stored.some((value) => String(value).includes("Private")), false);
});

test("audit migration creates indexed sessions and immutable event rows", async () => {
  const sql = await readFile(new URL("../db/migrations/005_audit_logs.sql", import.meta.url), "utf8");
  assert.match(sql, /CREATE TABLE IF NOT EXISTS audit_sessions/i);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS audit_events/i);
  assert.match(sql, /CHECK \(json_valid\(metadata_json\)\)/i);
  assert.match(sql, /CREATE TRIGGER IF NOT EXISTS audit_events_are_immutable/i);
});

test("the workspace gates the editor on mobile and exposes owner-only system logs", async () => {
  const [app, chooser] = await Promise.all([
    readFile(new URL("../src/App.jsx", import.meta.url), "utf8"),
    readFile(new URL("../src/WorkspaceChooser.jsx", import.meta.url), "utf8"),
  ]);
  assert.match(app, /mobileEditorBlocked && canModifyDraft\(editorPhase\)/);
  assert.match(chooser, /user\?\.capabilities\?\.auditLog/);
  assert.match(chooser, /Tap to review the desktop-browser requirement/);
  assert.doesNotMatch(chooser, /onClick=\{onCreateEmail\} disabled=\{editorUnavailable\}/);
  assert.match(chooser, /role="alertdialog"/);
});

test("the owner log uses the forensic grid and account-level multi-device presence", async () => {
  const audit = await readFile(new URL("../src/AuditLog.jsx", import.meta.url), "utf8");
  assert.match(audit, /Forensic Data Grid/);
  assert.match(audit, /data\.accounts\?\.length/);
  assert.match(audit, /online_session_count/);
  assert.match(audit, /signed_out_session_count/);
  assert.match(audit, /requestSequenceRef/);
  assert.match(audit, /scrollIntoView/);
  assert.match(audit, /Email target/);
  assert.match(audit, /Archive ID/);
  assert.match(audit, /Message No\. or Archive ID/);
});
