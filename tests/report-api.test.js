import test from "node:test";
import assert from "node:assert/strict";
import { onRequestGet, onRequestPost } from "../functions/api/reports.js";

function validPayload() {
  return {
    category: "facilities",
    summary: "A teaching room has repeated ventilation problems",
    details: "The room becomes uncomfortable during the afternoon session and this has happened more than once.",
    desiredOutcome: "Please ask the Department to review the room.",
    studyStage: "undergraduate",
    courseContext: "Chemistry Building",
    impact: "moderate",
    contactPreference: "anonymous",
    contactEmail: "",
    privacyAccepted: true,
    website: "",
    startedAt: Date.now() - 2_000,
  };
}

function acceptingDb() {
  return {
    prepare() {
      return {
        bind() {
          return { async run() { return { success: true }; } };
        },
      };
    },
  };
}

function reportRequest(body = validPayload(), headers = {}) {
  return new Request("https://uom-su-mail-system.pages.dev/api/reports", {
    method: "POST",
    headers: {
      origin: "https://uom-su-mail-system.pages.dev",
      "content-type": "application/json",
      ...headers,
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

test("a public report returns only a server-generated reference and time", async () => {
  const response = await onRequestPost({ request: reportRequest(), env: { ARCHIVE_DB: acceptingDb() } });
  const payload = await response.json();

  assert.equal(response.status, 201);
  assert.match(payload.reference, /^CHEM-SR-RPT-[0-9A-F]{8}$/);
  assert.equal(typeof payload.createdAt, "string");
  assert.equal("details" in payload, false);
  assert.equal("contactEmail" in payload, false);
  assert.match(response.headers.get("cache-control"), /no-store/);
});

test("invalid JSON, wrong origins and unsupported formats fail without reaching storage", async () => {
  let prepareCalls = 0;
  const db = { prepare() { prepareCalls += 1; throw new Error("must not run"); } };

  const invalidJson = await onRequestPost({ request: reportRequest("{"), env: { ARCHIVE_DB: db } });
  const wrongOrigin = await onRequestPost({
    request: reportRequest(validPayload(), { origin: "https://attacker.example" }),
    env: { ARCHIVE_DB: db },
  });
  const wrongType = await onRequestPost({
    request: reportRequest(validPayload(), { "content-type": "text/plain" }),
    env: { ARCHIVE_DB: db },
  });

  assert.equal(invalidJson.status, 400);
  assert.equal(wrongOrigin.status, 403);
  assert.equal(wrongType.status, 415);
  assert.equal(prepareCalls, 0);
});

test("oversized requests and database failures return safe errors", async () => {
  const oversized = await onRequestPost({
    request: reportRequest(validPayload(), { "content-length": "12001" }),
    env: { ARCHIVE_DB: acceptingDb() },
  });
  const unavailable = await onRequestPost({
    request: reportRequest(),
    env: { ARCHIVE_DB: { prepare() { throw new Error("private D1 detail"); } } },
  });

  assert.equal(oversized.status, 413);
  assert.equal(unavailable.status, 503);
  assert.equal((await unavailable.text()).includes("private D1 detail"), false);
});

test("GET never exposes submitted reports", async () => {
  const response = onRequestGet();
  assert.equal(response.status, 405);
  assert.deepEqual(await response.json(), { error: "method_not_allowed" });
});
