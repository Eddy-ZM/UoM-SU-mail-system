import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { isAllowedClientAuditAction, isAuditOwner } from "../functions/_lib/audit-store.js";
import { onRequestGet as readAuditLog } from "../functions/api/admin/audit-logs.js";

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
  assert.equal(isAllowedClientAuditAction("email.body.changed"), false);
  assert.equal(isAllowedClientAuditAction("custom free text"), false);
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
