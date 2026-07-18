import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const migrationUrl = new URL("../db/migrations/002_simplify_integrity_checks.sql", import.meta.url);

test("archive integrity constraints use D1-safe compact GLOB patterns", async () => {
  const migration = await readFile(migrationUrl, "utf8");
  const globPatterns = [...migration.matchAll(/GLOB\s+'([^']+)'/g)].map((match) => match[1]);

  assert.ok(globPatterns.length >= 3);
  assert.ok(globPatterns.every((pattern) => pattern.length <= 20));
  assert.match(migration, /substr\(message_number, 1, 8\) = 'CHEM-SR-'/);
  assert.match(migration, /length\(replace\(verification_code, '-', ''\)\) = 16/);
  assert.match(migration, /CREATE TRIGGER email_archives_are_immutable/);
});
