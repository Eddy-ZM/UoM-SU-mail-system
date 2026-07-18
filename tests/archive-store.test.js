import test from "node:test";
import assert from "node:assert/strict";
import { createArchive, deleteArchive, verifyArchivedMessage } from "../functions/_lib/archive-store.js";
import { VERIFICATION_CODE_PLACEHOLDER, prepareEmailForArchive } from "../shared/email-integrity.js";

const sourceEmail = `<!doctype html><html><body><span data-message-number="true">CHEM-SR-89ABCDEF</span><p>Archive me</p><span data-verification-code="true">${VERIFICATION_CODE_PLACEHOLDER}</span></body></html>`;

function recordingDb({ deleteChanges = 1 } = {}) {
  const calls = [];
  return {
    calls,
    prepare(sql) {
      const call = { sql, values: [] };
      calls.push(call);
      return {
        bind(...values) { call.values = values; return this; },
        async run() { return { meta: { changes: sql.includes("DELETE") ? deleteChanges : 1 } }; },
      };
    },
  };
}

test("the server recomputes SHA-256 and records verified submitter identity", async () => {
  const prepared = await prepareEmailForArchive(sourceEmail);
  const db = recordingDb();
  const archive = await createArchive(db, {
    html: prepared.html,
    subject: "Chemistry update",
    filename: "chemistry-update.html",
    operation: "copy_html",
    preset: "general",
    modules: { details: false },
  }, {
    id: "user-123",
    email: "Representative@Example.test",
    systemRole: "user",
  }, {
    id: "archive-123",
    createdAt: "2026-07-18T12:00:00.000Z",
  });

  assert.equal(archive.sha256, prepared.sha256);
  assert.equal(archive.verificationCode, prepared.verificationCode);
  assert.equal(archive.messageNumber, "CHEM-SR-89ABCDEF");
  assert.equal(archive.submittedBy.email, "representative@example.test");
  assert.match(db.calls[0].sql, /INSERT INTO email_archives/);
  assert.equal(db.calls[0].values[7], prepared.html);
  assert.equal(db.calls[0].values[9], "user-123");
});

test("a forged embedded hash is rejected before any database write", async () => {
  const prepared = await prepareEmailForArchive(sourceEmail);
  const db = recordingDb();
  const forged = prepared.html.replace(prepared.verificationCode, "AAAA-AAAA-AAAA-AAAA");
  await assert.rejects(() => createArchive(db, {
    html: forged,
    subject: "Chemistry update",
    filename: "update.html",
    operation: "download_html",
  }, { id: "u1", email: "rep@example.test", systemRole: "user" }), /does not match/);
  assert.equal(db.calls.length, 0);
});

test("public verification returns the same generic invalid result for wrong or malformed values", async () => {
  const validDb = {
    prepare() {
      return {
        bind() { return this; },
        async first() { return { first_archived_at: "2026-07-18T12:00:00.000Z" }; },
      };
    },
  };
  assert.deepEqual(await verifyArchivedMessage(validDb, "CHEM-SR-89ABCDEF", "1234-ABCD-5678-EF90"), {
    valid: true,
    firstArchivedAt: "2026-07-18T12:00:00.000Z",
  });
  assert.deepEqual(await verifyArchivedMessage(validDb, "not-a-number", "wrong"), { valid: false });

  const missingDb = { prepare() { return { bind() { return this; }, async first() { return { first_archived_at: null }; } }; } };
  assert.deepEqual(await verifyArchivedMessage(missingDb, "CHEM-SR-89ABCDEF", "1234-ABCD-5678-EF90"), { valid: false });
});

test("only ziwen.mu@chemvault.science can delete an archive", async () => {
  const db = recordingDb();
  await assert.rejects(
    () => deleteArchive(db, "archive-1", { email: "other@chemvault.science" }),
    (error) => error.status === 403,
  );
  assert.equal(db.calls.length, 0);

  assert.equal(await deleteArchive(db, "archive-1", { email: "ZIWEN.MU@CHEMVAULT.SCIENCE" }), true);
  assert.match(db.calls[0].sql, /DELETE FROM email_archives/);
});
