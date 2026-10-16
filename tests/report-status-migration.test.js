import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const migrationUrl = new URL("../db/migrations/004_student_issue_report_status.sql", import.meta.url);

test("report status migration upgrades existing rows without rebuilding or deleting submissions", async () => {
  const migration = await readFile(migrationUrl, "utf8");

  assert.match(migration, /ALTER TABLE student_issue_reports\s+ADD COLUMN status TEXT NOT NULL DEFAULT 'new'/);
  assert.match(migration, /status IN \('new', 'in-progress', 'replied', 'resolved'\)/);
  assert.match(migration, /ADD COLUMN status_updated_at TEXT/);
  assert.match(migration, /ADD COLUMN status_updated_by_user_id TEXT/);
  assert.match(migration, /ADD COLUMN status_updated_by_name TEXT/);
  assert.match(migration, /ADD COLUMN status_updated_by_email TEXT/);
  assert.match(migration, /ADD COLUMN status_updated_by_role TEXT/);
  assert.match(migration, /idx_student_issue_reports_status_created_at/);
  assert.doesNotMatch(migration, /DROP TABLE|DELETE FROM|ALTER TABLE .* RENAME/i);
});
