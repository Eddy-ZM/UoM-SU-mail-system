import test from "node:test";
import assert from "node:assert/strict";
import { onRequest } from "../functions/_middleware.js";
import { HANDOFF_COOKIE_NAME } from "../functions/_lib/access-gate.js";
import {
  ACCESS_RESTRICTION_MESSAGE,
  ACCESS_RESTRICTION_TITLE,
} from "../shared/service-restriction.js";

const handoffToken = "header.payload.middleware-signature";
const originalFetch = globalThis.fetch;

test.afterEach(() => {
  globalThis.fetch = originalFetch;
});

test("public privacy notice bypasses authentication middleware", async () => {
  let nextCalls = 0;
  const response = await onRequest({
    request: new Request("https://mailsys.uomsu.chemvault.science/agreement/privacy-notice/"),
    env: {},
    next: async () => {
      nextCalls += 1;
      return new Response("privacy");
    },
  });

  assert.equal(nextCalls, 1);
  assert.equal(await response.text(), "privacy");
});

test("certificate validation challenges bypass authentication middleware", async () => {
  globalThis.fetch = async () => { throw new Error("certificate challenges must not call User System"); };
  let nextCalls = 0;
  const response = await onRequest({
    request: new Request("http://mailsys.uomsu.chemvault.science/.well-known/acme-challenge/certificate-token"),
    env: {},
    next: async () => {
      nextCalls += 1;
      return new Response("certificate-token");
    },
  });

  assert.equal(nextCalls, 1);
  assert.equal(await response.text(), "certificate-token");
});

test("public verification page and API bypass the editor authentication redirect", async () => {
  for (const path of ["/verify/", "/api/verification"]) {
    let nextCalls = 0;
    const response = await onRequest({
      request: new Request(`https://uom-su-mail-system.pages.dev${path}`, { method: path.startsWith("/api/") ? "POST" : "GET" }),
      env: {},
      next: async () => { nextCalls += 1; return new Response("public verification"); },
    });
    assert.equal(nextCalls, 1);
    assert.equal(await response.text(), "public verification");
  }
});

test("an editor request without a local session redirects to User System handoff", async () => {
  const response = await onRequest({
    request: new Request("https://mailsys.uomsu.chemvault.science/?preset=event"),
    env: {},
    next: async () => { throw new Error("protected asset must not be served"); },
  });

  const location = new URL(response.headers.get("location"));
  assert.equal(response.status, 302);
  assert.equal(location.origin, "https://user.chemvault.science");
  assert.equal(location.pathname, "/api/auth/handoff/start");
  assert.equal(location.searchParams.get("returnTo"), "https://mailsys.uomsu.chemvault.science/?preset=event");
});

test("an allowed callback stores the host token and strips it from the URL", async () => {
  globalThis.fetch = async () => Response.json({
    access: { allowed: true, reason: "explicit_permission" },
    user: { id: "user-1", email: "rep@example.test" },
    handoff: { audience: "uom-su-mail-system", expiresAt: Math.floor(Date.now() / 1000) + 600 },
  });
  const response = await onRequest({
    request: new Request(`https://uom-su-mail-system.pages.dev/?token=${handoffToken}&provider=chemvault-user`),
    env: {},
    next: async () => { throw new Error("callback must redirect before serving the editor"); },
  });

  assert.equal(response.status, 303);
  assert.equal(response.headers.get("location"), "https://uom-su-mail-system.pages.dev/");
  assert.match(response.headers.get("set-cookie"), new RegExp(`^${HANDOFF_COOKIE_NAME}=`));
  assert.match(response.headers.get("set-cookie"), /HttpOnly; Secure; SameSite=Lax/);
});

test("a stored handoff token is reverified before every editor response", async () => {
  let nextCalls = 0;
  globalThis.fetch = async () => Response.json({
    access: { allowed: true, reason: "explicit_permission" },
    user: { id: "user-1", email: "rep@example.test" },
    handoff: { audience: "uom-su-mail-system", expiresAt: Math.floor(Date.now() / 1000) + 600 },
  });
  const response = await onRequest({
    request: new Request("https://uom-su-mail-system.pages.dev/", {
      headers: { cookie: `${HANDOFF_COOKIE_NAME}=${encodeURIComponent(handoffToken)}` },
    }),
    env: {},
    next: async () => {
      nextCalls += 1;
      return new Response("editor", { headers: { "content-type": "text/html" } });
    },
  });

  assert.equal(nextCalls, 1);
  assert.equal(response.status, 200);
  assert.equal(await response.text(), "editor");
  assert.match(response.headers.get("cache-control"), /no-store/);
  assert.equal(response.headers.get("vary"), "Cookie");
});

test("a revoked permission returns 403 and never serves the editor", async () => {
  globalThis.fetch = async () => Response.json({
    access: { allowed: false, reason: "permission_revoked" },
    user: { id: "user-1", email: "rep@example.test" },
    handoff: { audience: "uom-su-mail-system", expiresAt: Math.floor(Date.now() / 1000) + 600 },
  });
  const response = await onRequest({
    request: new Request("https://uom-su-mail-system.pages.dev/", {
      headers: { cookie: `${HANDOFF_COOKIE_NAME}=${encodeURIComponent(handoffToken)}` },
    }),
    env: {},
    next: async () => { throw new Error("revoked users must never receive the editor"); },
  });

  assert.equal(response.status, 403);
  const body = await response.text();
  assert.match(body, new RegExp(ACCESS_RESTRICTION_TITLE));
  assert.match(body, new RegExp(ACCESS_RESTRICTION_MESSAGE.replaceAll("'", "&#039;")));
  assert.match(body, /\/verify\/\?restrictionNotice=shown/);
  assert.match(body, /\/agreement\/privacy-notice\/\?restrictionNotice=shown/);
  assert.match(body, /<form method="post" action="\/api\/access\/logout">/);
  assert.match(body, />Sign out<\/button>/);
  assert.match(response.headers.get("content-security-policy"), /form-action 'self'/);
});

test("User System failures return 503 and fail closed", async () => {
  globalThis.fetch = async () => { throw new Error("offline"); };
  const response = await onRequest({
    request: new Request("https://uom-su-mail-system.pages.dev/", {
      headers: { cookie: `${HANDOFF_COOKIE_NAME}=${encodeURIComponent(handoffToken)}` },
    }),
    env: {},
    next: async () => { throw new Error("the editor must remain closed"); },
  });

  assert.equal(response.status, 503);
  assert.match(await response.text(), /Authentication unavailable/);
});
