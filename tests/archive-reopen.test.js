import test from "node:test";
import assert from "node:assert/strict";
import { getArchive } from "../functions/_lib/archive-store.js";
import {
  ARCHIVE_REOPEN_WINDOW_MS,
  archiveReopenWindow,
  canReopenArchive,
} from "../shared/archive-reopen.js";

const firstArchivedAt = "2026-07-18T12:00:00.000Z";

function archiveRow(overrides = {}) {
  return {
    id: "archive-1",
    message_number: "CHEM-SR-DEADBEEF",
    sha256: "a".repeat(64),
    verification_code: "AAAA-BBBB-CCCC-DDDD",
    operation: "copy_outlook",
    subject: "Student announcement",
    filename: "student-announcement.html",
    html: "<!doctype html><html><body>Archived</body></html>",
    document_json: JSON.stringify({ subject: "Student announcement" }),
    submitted_by_user_id: "user-1",
    submitted_by_email: "representative@example.test",
    submitted_by_role: "user",
    created_at: "2026-07-18T12:05:00.000Z",
    first_archived_at: firstArchivedAt,
    ...overrides,
  };
}

function detailDb(row) {
  return {
    prepare() {
      return {
        bind() { return this; },
        async first() { return row; },
      };
    },
  };
}

test("the read-only reopening window lasts exactly 24 hours from first archive", () => {
  const first = new Date(firstArchivedAt).getTime();
  const withinWindow = archiveReopenWindow(firstArchivedAt, first + ARCHIVE_REOPEN_WINDOW_MS - 1);
  const atBoundary = archiveReopenWindow(firstArchivedAt, first + ARCHIVE_REOPEN_WINDOW_MS);

  assert.equal(withinWindow.canReopen, true);
  assert.equal(withinWindow.reopenExpiresAt, "2026-07-19T12:00:00.000Z");
  assert.equal(atBoundary.canReopen, false);
  assert.equal(canReopenArchive(withinWindow, first + ARCHIVE_REOPEN_WINDOW_MS - 1), true);
  assert.equal(canReopenArchive(withinWindow, first + ARCHIVE_REOPEN_WINDOW_MS), false);
  assert.equal(archiveReopenWindow(null, first).canReopen, false);
  assert.equal(archiveReopenWindow(firstArchivedAt, first - 1).canReopen, false);
});

test("an archive created later still uses the message's first archive time", async () => {
  const archive = await getArchive(detailDb(archiveRow()), "archive-1", {
    now: "2026-07-19T11:59:59.000Z",
  });

  assert.equal(archive.createdAt, "2026-07-18T12:05:00.000Z");
  assert.equal(archive.firstArchivedAt, firstArchivedAt);
  assert.equal(archive.canReopen, true);
  assert.match(archive.html, /Archived/);
});

test("the server withholds archived HTML after the 24-hour window", async () => {
  const archive = await getArchive(detailDb(archiveRow()), "archive-1", {
    now: "2026-07-19T12:00:00.000Z",
  });

  assert.equal(archive.canReopen, false);
  assert.equal(archive.reopenExpiresAt, "2026-07-19T12:00:00.000Z");
  assert.equal(Object.hasOwn(archive, "html"), false);
  assert.equal(Object.hasOwn(archive, "document"), false);
});
