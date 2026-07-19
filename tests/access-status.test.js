import test from "node:test";
import assert from "node:assert/strict";
import { onRequestGet } from "../functions/api/access/status.js";
import {
  FULL_ACCESS_PERMISSION,
  HANDOFF_COOKIE_NAME,
  REQUIRED_PERMISSION,
} from "../functions/_lib/access-gate.js";

const originalFetch = globalThis.fetch;
const token = "header.payload.status-signature";

test.afterEach(() => {
  globalThis.fetch = originalFetch;
});

function statusRequest() {
  return new Request("https://mailsys.uomsu.chemvault.science/api/access/status", {
    headers: { cookie: `${HANDOFF_COOKIE_NAME}=${encodeURIComponent(token)}` },
  });
}

function handoffResponse(allowed) {
  return Response.json({
    access: { allowed, reason: allowed ? "permission_granted" : "permission_denied" },
    user: { id: "user-1", email: "rep@example.test" },
    handoff: { audience: "uom-su-mail-system", expiresAt: Math.floor(Date.now() / 1000) + 600 },
  });
}

test("status reports both entry and content access when both permissions allow", async () => {
  globalThis.fetch = async () => handoffResponse(true);

  const response = await onRequestGet({ request: statusRequest(), env: {} });
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.allowed, true);
  assert.equal(payload.entryAllowed, true);
  assert.equal(payload.permission, REQUIRED_PERMISSION);
  assert.equal(payload.contentAllowed, true);
  assert.equal(payload.contentPermission, FULL_ACCESS_PERMISSION);
  assert.equal(payload.user.id, "user-1");
});

test("status distinguishes content restriction from service-entry denial", async () => {
  globalThis.fetch = async (url) => {
    const permission = new URL(url).searchParams.get("permission");
    return handoffResponse(permission === REQUIRED_PERMISSION);
  };

  const restrictedResponse = await onRequestGet({ request: statusRequest(), env: {} });
  const restricted = await restrictedResponse.json();
  assert.equal(restrictedResponse.status, 403);
  assert.equal(restricted.allowed, false);
  assert.equal(restricted.entryAllowed, true);
  assert.equal(restricted.contentAllowed, false);
  assert.equal(restricted.user.id, "user-1");

  globalThis.fetch = async () => handoffResponse(false);
  const deniedResponse = await onRequestGet({ request: statusRequest(), env: {} });
  const denied = await deniedResponse.json();
  assert.equal(deniedResponse.status, 403);
  assert.equal(denied.allowed, false);
  assert.equal(denied.entryAllowed, false);
  assert.equal(denied.contentAllowed, false);
  assert.equal(denied.user, undefined);
});
