import test from "node:test";
import assert from "node:assert/strict";
import {
  EDITOR_PHASE,
  archiveReceiptFromExport,
  canModifyDraft,
} from "../src/editorSession.js";

test("only the editing phase permits draft modification", () => {
  assert.equal(canModifyDraft(EDITOR_PHASE.CHOOSER), false);
  assert.equal(canModifyDraft(EDITOR_PHASE.ARCHIVING), false);
  assert.equal(canModifyDraft(EDITOR_PHASE.ARCHIVED), false);
  assert.equal(canModifyDraft(EDITOR_PHASE.EDITING), true);
});

test("a successful export creates an immutable terminal receipt", () => {
  const receipt = archiveReceiptFromExport({
    archive: {
      id: "archive-1",
      messageNumber: "CHEM-SR-DEADBEEF",
      verificationCode: "AAAA-BBBB-CCCC-DDDD",
      subject: "Student announcement",
      createdAt: "2026-07-18T12:00:00.000Z",
    },
  }, "copy_outlook");

  assert.deepEqual(receipt, {
    archiveId: "archive-1",
    messageNumber: "CHEM-SR-DEADBEEF",
    verificationCode: "AAAA-BBBB-CCCC-DDDD",
    operation: "copy_outlook",
    subject: "Student announcement",
    createdAt: "2026-07-18T12:00:00.000Z",
  });
  assert.equal(Object.isFrozen(receipt), true);
});

test("an incomplete archive response cannot close the editor", () => {
  assert.throws(() => archiveReceiptFromExport({ archive: { id: "archive-1" } }, "copy_html"), /complete receipt/);
});
