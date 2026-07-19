import test from "node:test";
import assert from "node:assert/strict";
import { onRequestGet, onRequestPost } from "../functions/api/archives/index.js";
import {
  FULL_ACCESS_PERMISSION,
  REQUIRED_PERMISSION,
} from "../functions/_lib/access-gate.js";

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
  const checkedPermissions = [];
  globalThis.fetch = async (url) => {
    const permission = new URL(url).searchParams.get("permission");
    checkedPermissions.push(permission);
    return Response.json({
      allowed: permission === REQUIRED_PERMISSION,
      reason: permission === REQUIRED_PERMISSION ? "entry_granted" : "content_denied",
      user: { id: "user-1", email: "rep@example.test" },
    });
  };

  for (const [method, handler] of [["GET", onRequestGet], ["POST", onRequestPost]]) {
    const response = await handler(restrictedContext(method));
    assert.equal(response.status, 403);
    assert.deepEqual(await response.json(), { error: "permission_denied" });
  }

  assert.deepEqual(checkedPermissions, [
    REQUIRED_PERMISSION,
    FULL_ACCESS_PERMISSION,
    REQUIRED_PERMISSION,
    FULL_ACCESS_PERMISSION,
  ]);
});
