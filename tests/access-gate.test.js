import test from "node:test";
import assert from "node:assert/strict";
import {
  buildHandoffStartUrl,
  checkRequestAccess,
  cleanEditorReturnUrl,
  FULL_ACCESS_PERMISSION,
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

test("certificate challenges, privacy notice and compiled assets stay public while editor entries stay protected", () => {
  assert.equal(isPublicRequestPath("/.well-known/acme-challenge/certificate-token"), true);
  assert.equal(isPublicRequestPath("/.well-known/cf-custom-hostname-challenge/domain-token"), true);
  assert.equal(isPublicRequestPath("/agreement/privacy-notice/"), true);
  assert.equal(isPublicRequestPath("/agreement/privacy-notice"), true);
  assert.equal(isPublicRequestPath("/assets/index-a1b2.js"), true);
  assert.equal(isPublicRequestPath("/verify/"), true);
  assert.equal(isPublicRequestPath("/api/verification"), true);
  assert.equal(isPublicRequestPath("/report"), true);
  assert.equal(isPublicRequestPath("/report/"), true);
  assert.equal(isPublicRequestPath("/api/reports"), true);
  assert.equal(isPublicRequestPath("/api/access/logout"), true);
  assert.equal(isPublicRequestPath("/api/verification/private"), false);
  assert.equal(isPublicRequestPath("/reports-admin"), false);
  assert.equal(isPublicRequestPath("/api/reports/private"), false);
  assert.equal(isPublicRequestPath("/.well-known-hidden/acme-challenge/token"), false);
  assert.equal(isPublicRequestPath("/agreement/privacy-notice-hidden"), false);
  assert.equal(isPublicRequestPath("/"), false);
  assert.equal(isPublicRequestPath("/index.html"), false);
});

test("handoff verification sends audience and permission and trusts only access.allowed", async () => {
  const capturedUrls = [];
  const capturedOptions = [];
  const decision = await verifyHandoffAccess(token, editorRequest(), {}, async (url, options) => {
    capturedUrls.push(new URL(url));
    capturedOptions.push(options);
    return Response.json({
      access: { allowed: true, reason: "explicit_permission" },
      user: { id: "user-1", email: "rep@example.test", name: "Student Rep", avatarUrl: "https://example.test/avatar.png", permissions: [] },
      handoff: { audience: HANDOFF_AUDIENCE, expiresAt: Math.floor(Date.now() / 1000) + 600 },
    });
  });

  assert.equal(decision.kind, "allowed");
  assert.deepEqual(
    capturedUrls.map((url) => url.searchParams.get("permission")),
    [REQUIRED_PERMISSION, FULL_ACCESS_PERMISSION],
  );
  for (const [index, capturedUrl] of capturedUrls.entries()) {
    assert.equal(capturedUrl.pathname, "/api/auth/handoff/verify");
    assert.equal(capturedUrl.searchParams.get("audience"), HANDOFF_AUDIENCE);
    assert.equal(capturedOptions[index].headers.get("authorization"), `Bearer ${token}`);
    assert.equal(capturedOptions[index].headers.has("cookie"), false);
  }
  assert.deepEqual(decision.user, {
    id: "user-1",
    email: "rep@example.test",
    name: "Student Rep",
    avatarUrl: "https://example.test/avatar.png",
    systemRole: "user",
  });
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

test("entry access is checked before content access and a content deny becomes restricted", async () => {
  const requestedPermissions = [];
  const decision = await verifyHandoffAccess(token, editorRequest(), {}, async (url) => {
    const permission = new URL(url).searchParams.get("permission");
    requestedPermissions.push(permission);
    return Response.json({
      access: {
        allowed: permission === REQUIRED_PERMISSION,
        reason: permission === REQUIRED_PERMISSION ? "entry_granted" : "content_denied",
      },
      user: { id: "user-1", email: "rep@example.test" },
      handoff: { audience: HANDOFF_AUDIENCE, expiresAt: Math.floor(Date.now() / 1000) + 600 },
    });
  });

  assert.deepEqual(requestedPermissions, [REQUIRED_PERMISSION, FULL_ACCESS_PERMISSION]);
  assert.equal(decision.kind, "restricted");
  assert.equal(decision.reason, "content_denied");
  assert.equal(decision.entryReason, "entry_granted");
  assert.equal(decision.user.id, "user-1");
});

test("content access cannot be combined with a different verified identity", async () => {
  let callCount = 0;
  const decision = await verifyHandoffAccess(token, editorRequest(), {}, async () => {
    callCount += 1;
    return Response.json({
      access: { allowed: callCount === 1, reason: callCount === 1 ? "entry_granted" : "content_denied" },
      user: { id: `user-${callCount}`, email: `rep-${callCount}@example.test` },
      handoff: { audience: HANDOFF_AUDIENCE, expiresAt: Math.floor(Date.now() / 1000) + 600 },
    });
  });

  assert.equal(decision.kind, "unavailable");
  assert.equal(decision.reason, "user_system_identity_mismatch");
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
  assert.equal(verificationCount, 4);
});

test("shared ChemVault cookie remains a fallback and is forwarded to access check", async () => {
  const capturedUrls = [];
  let capturedCookie;
  const sharedSession = "shared.session.jwt-signature";
  const request = editorRequest("/", { cookie: `chemvault_session=${sharedSession}` });
  const decision = await checkRequestAccess(request, {}, async (url, options) => {
    capturedUrls.push(new URL(url));
    capturedCookie = options.headers.get("cookie");
    return Response.json({
      allowed: true,
      reason: "explicit_permission",
      user: { id: "user-1", email: "rep@example.test" },
    });
  });

  assert.equal(decision.kind, "allowed");
  assert.deepEqual(
    capturedUrls.map((url) => url.searchParams.get("permission")),
    [REQUIRED_PERMISSION, FULL_ACCESS_PERMISSION],
  );
  assert.equal(capturedUrls[0].pathname, "/api/access/check");
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
