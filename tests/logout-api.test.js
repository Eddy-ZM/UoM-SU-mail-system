import test from "node:test";
import assert from "node:assert/strict";
import { onRequestGet, onRequestPost } from "../functions/api/access/logout.js";
import { HANDOFF_COOKIE_NAME } from "../functions/_lib/access-gate.js";

test("logout clears the editor handoff and sends the browser through User System logout", async () => {
  const response = onRequestPost({
    request: new Request("https://mailsys.uomsu.chemvault.science/api/access/logout", { method: "POST" }),
    env: {},
  });
  const payload = await response.json();
  const logoutUrl = new URL(payload.logoutUrl);

  assert.equal(response.status, 200);
  assert.equal(payload.ok, true);
  assert.equal(logoutUrl.origin, "https://user.chemvault.science");
  assert.equal(logoutUrl.pathname, "/api/auth/logout/redirect");
  assert.equal(logoutUrl.searchParams.get("returnTo"), "https://mailsys.uomsu.chemvault.science/");
  assert.match(response.headers.get("set-cookie"), new RegExp(`^${HANDOFF_COOKIE_NAME}=; Max-Age=0`));
});

test("logout cannot be triggered with a GET request", async () => {
  const response = onRequestGet();
  assert.equal(response.status, 405);
  assert.equal(response.headers.get("allow"), "POST");
});
