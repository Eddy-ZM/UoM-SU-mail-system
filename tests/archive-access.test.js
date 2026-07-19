import test from "node:test";
import assert from "node:assert/strict";
import { onRequestGet, onRequestPost } from "../functions/api/archives/index.js";

const originalFetch = globalThis.fetch;
const sharedSession = "shared.session.archive-denial";

test.afterEach(() => {
  globalThis.fetch = originalFetch;
});

function restrictedContext(method) {
  const archiveDb = {
    prepare() {
      throw new Error("Archive storage must not be reached for a restricted user.");
    },
  };
  return {
    request: new Request("https://mailsys.uomsu.chemvault.science/api/archives?q=private", {
      method,
      headers: {
        cookie: `chemvault_session=${sharedSession}`,
        ...(method === "POST" ? { "content-type": "application/json" } : {}),
      },
      ...(method === "POST" ? { body: JSON.stringify({ subject: "Restricted archive" }) } : {}),
    }),
    env: { ARCHIVE_DB: archiveDb },
    data: {},
  };
}

test("restricted users cannot query or create archives", async () => {
  globalThis.fetch = async () => new Response(null, { status: 403 });

  for (const [method, handler] of [["GET", onRequestGet], ["POST", onRequestPost]]) {
    const response = await handler(restrictedContext(method));
    assert.equal(response.status, 403);
    assert.deepEqual(await response.json(), { error: "permission_denied" });
  }
});
