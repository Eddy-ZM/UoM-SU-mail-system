import test from "node:test";
import assert from "node:assert/strict";
import { onRequestPost } from "../functions/api/verification.js";

function dbReturning(firstArchivedAt) {
  return {
    prepare() {
      return {
        bind() { return this; },
        async first() { return { first_archived_at: firstArchivedAt }; },
      };
    },
  };
}

test("public verification confirms a matching pair without returning archive or submitter data", async () => {
  const response = await onRequestPost({
    request: new Request("https://uom-su-mail-system.pages.dev/api/verification", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ messageNumber: "CHEM-SR-89ABCDEF", verificationCode: "1234-ABCD-5678-EF90" }),
    }),
    env: { ARCHIVE_DB: dbReturning("2026-07-18T12:00:00.000Z") },
  });
  const payload = await response.json();
  assert.deepEqual(payload, { valid: true, firstArchivedAt: "2026-07-18T12:00:00.000Z" });
  assert.equal(JSON.stringify(payload).includes("html"), false);
  assert.equal(JSON.stringify(payload).includes("submitted"), false);
});

test("wrong, missing and malformed pairs return the same generic invalid result", async () => {
  for (const body of [
    { messageNumber: "CHEM-SR-89ABCDEF", verificationCode: "1234-ABCD-5678-EF90" },
    { messageNumber: "invalid", verificationCode: "invalid" },
    {},
  ]) {
    const response = await onRequestPost({
      request: new Request("https://uom-su-mail-system.pages.dev/api/verification", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }),
      env: { ARCHIVE_DB: dbReturning(null) },
    });
    assert.deepEqual(await response.json(), { valid: false });
  }
});
