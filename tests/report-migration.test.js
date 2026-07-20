import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const migrationUrl = new URL("../db/migrations/003_student_issue_reports.sql", import.meta.url);

test("student issue report migration keeps submissions separate and queryable", async () => {
  const migration = await readFile(migrationUrl, "utf8");

  assert.match(migration, /CREATE TABLE IF NOT EXISTS student_issue_reports/);
  assert.match(migration, /contact_requested INTEGER NOT NULL CHECK/);
  assert.match(migration, /contact_requested = 0 AND contact_email IS NULL/);
  assert.match(migration, /idx_student_issue_reports_created_at/);
  assert.doesNotMatch(migration, /CREATE TRIGGER/);
  assert.doesNotMatch(migration, /submitted_by_email/);
});
