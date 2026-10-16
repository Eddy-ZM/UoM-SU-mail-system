import test from "node:test";
import assert from "node:assert/strict";
import {
  createOutlookTransaction,
  outlookConfiguration,
  readOutlookTransaction,
  transactionMatches,
  trustedOutlookWebLink,
} from "../functions/_lib/outlook-oauth.js";
import { onRequestGet as getStatus } from "../functions/api/outlook/status.js";
import { onRequestPost as startOutlook } from "../functions/api/outlook/start.js";
import { onRequestGet as finishOutlook } from "../functions/api/outlook/callback.js";
import { prepareEmailForArchive, SHA256_PLACEHOLDER, VERIFICATION_CODE_PLACEHOLDER } from "../shared/email-integrity.js";

const configuration = {
  MS_GRAPH_CLIENT_ID: "11111111-1111-4111-8111-111111111111",
  MS_GRAPH_TENANT_ID: "22222222-2222-4222-8222-222222222222",
  MS_GRAPH_CLIENT_SECRET: "server-secret",
  GRAPH_OAUTH_STATE_KEY: Buffer.alloc(32, 7).toString("base64url"),
  MS_GRAPH_REDIRECT_URI: "https://mailsys.uomsu.chemvault.science/api/outlook/callback",
};

const allowedUser = { id: "user-1", email: "rep@example.test", role: "representative" };
const sourceEmail = `<!doctype html><html><head><title>Graph test</title></head><body><img class="university-logo" src="https://example.test/university-of-manchester.png" width="154" height="64" alt="The University of Manchester"><span data-message-number="true">CHEM-SR-A1B2C3D4</span><p>Protected archived email</p><span data-verification-code="true">${VERIFICATION_CODE_PLACEHOLDER}</span></body><!-- SRMS-METADATA message-number="CHEM-SR-A1B2C3D4" sha256="${SHA256_PLACEHOLDER}" --></html>`;
const preparedEmail = await prepareEmailForArchive(sourceEmail);

function archiveDb() {
  return {
    prepare() {
      return {
        bind() {
          return {
            async first() {
              const createdAt = new Date().toISOString();
              return {
                id: "archive-1",
                message_number: "CHEM-SR-A1B2C3D4",
                sha256: preparedEmail.sha256,
                verification_code: preparedEmail.verificationCode,
                operation: "copy_outlook",
                subject: "Student questionnaire",
                filename: "CHEM-SR-A1B2C3D4.html",
                html: preparedEmail.html,
                document_json: "{}",
                submitted_by_user_id: allowedUser.id,
                submitted_by_email: allowedUser.email,
                submitted_by_role: allowedUser.role,
                created_at: createdAt,
                first_archived_at: createdAt,
              };
            },
          };
        },
      };
    },
  };
}

test("Outlook Graph stays disabled until every safe server setting is present", async () => {
  assert.equal(outlookConfiguration({}, "https://mailsys.uomsu.chemvault.science/").configured, false);
  assert.equal(outlookConfiguration({ ...configuration, GRAPH_OAUTH_STATE_KEY: "short" }).configured, false);
  assert.equal(outlookConfiguration({ ...configuration, MS_GRAPH_TENANT_ID: "organizations" }).configured, false);
  assert.equal(outlookConfiguration(configuration).configured, true);

  const response = getStatus({ env: configuration, request: new Request("https://mailsys.uomsu.chemvault.science/api/outlook/status") });
  assert.deepEqual(await response.json(), { configured: true });
  assert.equal(response.headers.get("cache-control"), "no-store");
});

test("the short-lived OAuth transaction is encrypted and bound to state, archive and user", async () => {
  const transaction = await createOutlookTransaction({
    archiveId: "archive-1",
    userId: "rep@example.test",
    stateSecret: configuration.GRAPH_OAUTH_STATE_KEY,
    now: 1_000,
  });
  assert.doesNotMatch(transaction.cookieValue, /archive-1|rep@example/u);
  const decoded = await readOutlookTransaction(transaction.cookieValue, configuration.GRAPH_OAUTH_STATE_KEY);
  assert.equal(decoded.archiveId, "archive-1");
  assert.equal(decoded.userId, "rep@example.test");
  assert.equal(decoded.exp, 601_000);
  assert.equal(transactionMatches(decoded.state, transaction.state), true);
  assert.equal(transactionMatches(`${decoded.state}x`, transaction.state), false);
});

test("only official HTTPS Outlook hosts are accepted for the returned draft link", () => {
  const accepted = trustedOutlookWebLink("https://outlook.office.com/mail/deeplink/read/id/123");
  assert.match(accepted, /^https:\/\/outlook\.office\.com\//u);
  assert.match(accepted, /ispopout=1/u);
  assert.equal(trustedOutlookWebLink("https://outlook.office.com.evil.test/draft"), "");
  assert.equal(trustedOutlookWebLink("http://outlook.office.com/draft"), "");
});

test("the server authorises a tenant-scoped draft and creates it without recipients or Mail.Send", async (t) => {
  const startRequest = new Request("https://mailsys.uomsu.chemvault.science/api/outlook/start", {
    method: "POST",
    headers: { origin: "https://mailsys.uomsu.chemvault.science", "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ archiveId: "archive-1" }),
  });
  const startResponse = await startOutlook({
    request: startRequest,
    env: { ...configuration, ARCHIVE_DB: archiveDb() },
    data: { mailAccess: { kind: "allowed", user: allowedUser } },
  });
  assert.equal(startResponse.status, 303);
  const authoriseUrl = new URL(startResponse.headers.get("location"));
  assert.equal(authoriseUrl.hostname, "login.microsoftonline.com");
  assert.equal(authoriseUrl.pathname, `/${configuration.MS_GRAPH_TENANT_ID}/oauth2/v2.0/authorize`);
  assert.equal(authoriseUrl.searchParams.get("scope"), "https://graph.microsoft.com/Mail.ReadWrite");
  assert.equal(authoriseUrl.searchParams.has("offline_access"), false);
  assert.doesNotMatch(authoriseUrl.toString(), /Mail\.Send/u);

  const stateCookie = startResponse.headers.get("set-cookie").split(";", 1)[0];
  const callbackUrl = new URL(configuration.MS_GRAPH_REDIRECT_URI);
  callbackUrl.searchParams.set("state", authoriseUrl.searchParams.get("state"));
  callbackUrl.searchParams.set("code", "one-time-code");
  const requests = [];
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async (url, options) => {
    requests.push({ url: String(url), options });
    if (String(url).includes("/token")) return Response.json({ access_token: "temporary-access-token" });
    return Response.json({ webLink: "https://outlook.office.com/mail/deeplink/read/id/draft-1" }, { status: 201 });
  };

  const callbackResponse = await finishOutlook({
    request: new Request(callbackUrl, { headers: { cookie: stateCookie } }),
    env: { ...configuration, ARCHIVE_DB: archiveDb() },
    data: { mailAccess: { kind: "allowed", user: allowedUser } },
  });
  assert.equal(callbackResponse.status, 303);
  assert.match(callbackResponse.headers.get("location"), /^https:\/\/outlook\.office\.com\//u);
  assert.match(callbackResponse.headers.get("set-cookie"), /Max-Age=0/u);
  assert.equal(requests.length, 2);
  assert.equal(requests[1].url, "https://graph.microsoft.com/v1.0/me/messages");
  const graphPayload = JSON.parse(requests[1].options.body);
  assert.equal(graphPayload.subject, "Student questionnaire");
  assert.equal(graphPayload.body.contentType, "HTML");
  assert.equal(graphPayload.body.content, preparedEmail.html);
  assert.equal("toRecipients" in graphPayload, false);
});
