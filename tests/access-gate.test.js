import test from "node:test";
import assert from "node:assert/strict";
import {
  buildHandoffStartUrl,
  checkRequestAccess,
  cleanEditorReturnUrl,
  HANDOFF_AUDIENCE,
  HANDOFF_COOKIE_NAME,
  handoffCookie,
  isPublicRequestPath,
  REQUIRED_PERMISSION,
  verifyHandoffAccess,
} from "../functions/_lib/access-gate.js";

const token = "header.payload.signature-value";
const editorRequest = (path = "/", headers = {}) =>
  new Request(`https://mailsys.uomsu.chemvault.science${path}`, { headers });

test("privacy notice and compiled assets stay public while editor entries stay protected", () => {
  assert.equal(isPublicRequestPath("/agreement/privacy-notice/"), true);
  assert.equal(isPublicRequestPath("/agreement/privacy-notice"), true);
  assert.equal(isPublicRequestPath("/assets/index-a1b2.js"), true);
  assert.equal(isPublicRequestPath("/verify/"), true);
  assert.equal(isPublicRequestPath("/api/verification"), true);
  assert.equal(isPublicRequestPath("/api/verification/private"), false);
  assert.equal(isPublicRequestPath("/agreement/privacy-notice-hidden"), false);
  assert.equal(isPublicRequestPath("/"), false);
  assert.equal(isPublicRequestPath("/index.html"), false);
});

test("handoff verification sends audience and permission and trusts only access.allowed", async () => {
  let capturedUrl;
  let capturedOptions;
  const decision = await verifyHandoffAccess(token, editorRequest(), {}, async (url, options) => {
    capturedUrl = new URL(url);
    capturedOptions = options;
    return Response.json({
      access: { allowed: true, reason: "explicit_permission" },
      user: { id: "user-1", email: "rep@example.test", permissions: [] },
      handoff: { audience: HANDOFF_AUDIENCE, expiresAt: Math.floor(Date.now() / 1000) + 600 },
    });
  });

  assert.equal(decision.kind, "allowed");
  assert.equal(capturedUrl.pathname, "/api/auth/handoff/verify");
  assert.equal(capturedUrl.searchParams.get("audience"), HANDOFF_AUDIENCE);
  assert.equal(capturedUrl.searchParams.get("permission"), REQUIRED_PERMISSION);
  assert.equal(capturedOptions.headers.get("authorization"), `Bearer ${token}`);
  assert.equal(capturedOptions.headers.has("cookie"), false);
});

test("handoff permissions fail closed even when the user payload lists a matching permission", async () => {
  const decision = await verifyHandoffAccess(token, editorRequest(), {}, async () => Response.json({
    access: { allowed: false, reason: "permission_not_granted" },
    user: { id: "user-1", email: "rep@example.test", permissions: [REQUIRED_PERMISSION] },
    handoff: { audience: HANDOFF_AUDIENCE, expiresAt: Math.floor(Date.now() / 1000) + 600 },
  }));

  assert.equal(decision.kind, "forbidden");
  assert.equal(decision.reason, "permission_not_granted");
});

test("a host-only handoff cookie is verified on every request", async () => {
  let verificationCount = 0;
  const request = editorRequest("/", { cookie: `${HANDOFF_COOKIE_NAME}=${encodeURIComponent(token)}` });
  const fetchImplementation = async () => {
    verificationCount += 1;
    return Response.json({
      access: { allowed: true, reason: "explicit_permission" },
      user: { id: "user-1", email: "rep@example.test" },
      handoff: { audience: HANDOFF_AUDIENCE, expiresAt: Math.floor(Date.now() / 1000) + 600 },
    });
  };

  assert.equal((await checkRequestAccess(request, {}, fetchImplementation)).kind, "allowed");
  assert.equal((await checkRequestAccess(request, {}, fetchImplementation)).kind, "allowed");
  assert.equal(verificationCount, 2);
});

test("shared ChemVault cookie remains a fallback and is forwarded to access check", async () => {
  let capturedUrl;
  let capturedCookie;
  const sharedSession = "shared.session.jwt-signature";
  const request = editorRequest("/", { cookie: `chemvault_session=${sharedSession}` });
  const decision = await checkRequestAccess(request, {}, async (url, options) => {
    capturedUrl = new URL(url);
    capturedCookie = options.headers.get("cookie");
    return Response.json({
      allowed: true,
      reason: "explicit_permission",
      user: { id: "user-1", email: "rep@example.test" },
    });
  });

  assert.equal(decision.kind, "allowed");
  assert.equal(capturedUrl.pathname, "/api/access/check");
  assert.equal(capturedUrl.searchParams.get("permission"), REQUIRED_PERMISSION);
  assert.equal(capturedCookie, `chemvault_session=${sharedSession}`);
});

test("no local session starts handoff and callback credentials are removed from returnTo", async () => {
  const decision = await checkRequestAccess(editorRequest(), {}, async () => {
    throw new Error("fetch must not run without a local session");
  });
  const callbackRequest = editorRequest(`/?preset=questionnaire&token=${token}&provider=chemvault-user`);
  const handoffUrl = new URL(buildHandoffStartUrl(callbackRequest, {}));

  assert.equal(decision.kind, "unauthenticated");
  assert.equal(handoffUrl.pathname, "/api/auth/handoff/start");
  assert.equal(
    handoffUrl.searchParams.get("returnTo"),
    "https://mailsys.uomsu.chemvault.science/?preset=questionnaire",
  );
  assert.equal(cleanEditorReturnUrl(callbackRequest), "https://mailsys.uomsu.chemvault.science/?preset=questionnaire");
});

test("handoff cookie is HttpOnly, Secure, SameSite Lax and host-only", () => {
  const value = handoffCookie(token, Math.floor(Date.now() / 1000) + 600);
  assert.match(value, new RegExp(`^${HANDOFF_COOKIE_NAME}=`));
  assert.match(value, /; Path=\//);
  assert.match(value, /; HttpOnly/);
  assert.match(value, /; Secure/);
  assert.match(value, /; SameSite=Lax/);
  assert.doesNotMatch(value, /Domain=/i);
});

test("401, 403, network errors and malformed payloads remain distinct and fail closed", async () => {
  const unauthenticated = await verifyHandoffAccess(token, editorRequest(), {}, async () => new Response(null, { status: 401 }));
  const forbidden = await verifyHandoffAccess(token, editorRequest(), {}, async () => new Response(null, { status: 403 }));
  const networkError = await verifyHandoffAccess(token, editorRequest(), {}, async () => { throw new Error("offline"); });
  const malformed = await verifyHandoffAccess(token, editorRequest(), {}, async () => Response.json({ access: { allowed: true } }));

  assert.equal(unauthenticated.kind, "unauthenticated");
  assert.equal(forbidden.kind, "forbidden");
  assert.equal(networkError.kind, "unavailable");
  assert.equal(malformed.kind, "unavailable");
});
