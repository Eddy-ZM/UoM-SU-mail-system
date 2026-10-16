import test from "node:test";
import assert from "node:assert/strict";
import {
  onRequestGet as onListGet,
  onRequestPost as onListPost,
} from "../functions/api/report-archive/index.js";
import {
  onRequestDelete as onDetailDelete,
  onRequestGet as onDetailGet,
  onRequestPatch as onDetailPatch,
} from "../functions/api/report-archive/[id].js";
import {
  FULL_ACCESS_PERMISSION,
  REQUIRED_PERMISSION,
} from "../functions/_lib/access-gate.js";

const originalFetch = globalThis.fetch;

test.afterEach(() => {
  globalThis.fetch = originalFetch;
});

function row(overrides = {}) {
  return {
    id: "report-1",
    reference: "CHEM-SR-RPT-A1B2C3D4",
    category: "facilities",
    summary: "Ventilation repeatedly fails in a teaching room",
    details: "The room becomes uncomfortable during afternoon teaching and this has happened repeatedly.",
    desired_outcome: "Please ask the Department to inspect the room.",
    study_stage: "undergraduate",
    course_context: "Chemistry Building",
    impact: "moderate",
    contact_requested: 1,
    contact_email: "student@manchester.ac.uk",
    status: "in-progress",
    status_updated_at: "2026-07-20T12:30:00.000Z",
    status_updated_by_user_id: "staff-1",
    status_updated_by_name: "Support Officer",
    status_updated_by_email: "support@example.test",
    status_updated_by_role: "staff",
    created_at: "2026-07-20T12:00:00.000Z",
    ...overrides,
  };
}

function readableDb({ detail = row(), rows = [row()], total = rows.length, updateChanges = 1 } = {}) {
  const calls = [];
  return {
    calls,
    prepare(sql) {
      const call = { sql, values: [] };
      calls.push(call);
      return {
        bind(...values) { call.values = values; return this; },
        async first() { return /COUNT\(\*\)/.test(sql) ? { total } : detail; },
        async all() { return { results: rows }; },
        async run() { return { meta: { changes: updateChanges } }; },
      };
    },
  };
}

function allowedContext(path, db, params = {}) {
  return {
    request: new Request(`https://uom-su-mail-system.pages.dev${path}`),
    env: { ARCHIVE_DB: db },
    data: {
      mailAccess: {
        kind: "allowed",
        user: {
          id: "staff-1",
          name: "Support Officer",
          email: "staff@example.test",
          systemRole: "staff",
        },
      },
    },
    params,
  };
}

test("an allowed middleware decision can list and paginate compact report summaries", async () => {
  globalThis.fetch = async () => { throw new Error("allowed middleware context must not be rechecked"); };
  const db = readableDb({ total: 21 });
  const response = await onListGet(allowedContext("/api/report-archive?q=ventilation&page=2&limit=10", db));
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(payload.pagination, { page: 2, limit: 10, total: 21, totalPages: 3 });
  assert.deepEqual(payload.reports[0], {
    id: "report-1",
    reference: "CHEM-SR-RPT-A1B2C3D4",
    category: "facilities",
    summary: "Ventilation repeatedly fails in a teaching room",
    impact: "moderate",
    contactPreference: "contact",
    status: "in-progress",
    statusUpdatedAt: "2026-07-20T12:30:00.000Z",
    statusUpdatedBy: { name: "Support Officer", email: "support@example.test" },
    createdAt: "2026-07-20T12:00:00.000Z",
  });
  assert.equal("details" in payload.reports[0], false);
  const listCall = db.calls.find((call) => /LIMIT \? OFFSET \?/.test(call.sql));
  assert.deepEqual(listCall.values.slice(-2), [10, 10]);
});

test("a direct archive read verifies both service entry and full access", async () => {
  const checkedPermissions = [];
  globalThis.fetch = async (url) => {
    const permission = new URL(url).searchParams.get("permission");
    checkedPermissions.push(permission);
    return Response.json({
      allowed: true,
      reason: "explicit_permission",
      user: { id: "staff-1", email: "staff@example.test" },
    });
  };
  const response = await onListGet({
    request: new Request("https://uom-su-mail-system.pages.dev/api/report-archive", {
      headers: { cookie: "chemvault_session=shared.full-access-session" },
    }),
    env: { ARCHIVE_DB: readableDb() },
    data: {},
  });

  assert.equal(response.status, 200);
  assert.deepEqual(checkedPermissions, [REQUIRED_PERMISSION, FULL_ACCESS_PERMISSION]);
});

test("an allowed account can fetch one full report without raw database fields", async () => {
  const db = readableDb();
  const response = await onDetailGet(allowedContext("/api/report-archive/report-1", db, { id: "report-1" }));
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.report.details, row().details);
  assert.equal(payload.report.contactEmail, "student@manchester.ac.uk");
  assert.equal(payload.report.contactPreference, "contact");
  assert.equal(payload.report.status, "in-progress");
  assert.equal(payload.report.statusUpdatedAt, "2026-07-20T12:30:00.000Z");
  assert.deepEqual(payload.report.statusUpdatedBy, {
    name: "Support Officer",
    email: "support@example.test",
  });
  assert.equal("contact_requested" in payload.report, false);
  assert.equal("created_at" in payload.report, false);
  assert.equal("status_updated_by_user_id" in payload.report, false);
  assert.equal("status_updated_by_role" in payload.report, false);
  assert.deepEqual(db.calls[0].values, ["report-1"]);
});

function patchContext(body, db, headers = {}, user = {}) {
  return {
    request: new Request("https://uom-su-mail-system.pages.dev/api/report-archive/report-1", {
      method: "PATCH",
      headers: {
        origin: "https://uom-su-mail-system.pages.dev",
        "content-type": "application/json",
        ...headers,
      },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
    env: { ARCHIVE_DB: db },
    data: {
      mailAccess: {
        kind: "allowed",
        user: {
          id: "staff-2",
          name: "Archive Officer",
          email: "archive.officer@example.test",
          systemRole: "staff",
          ...user,
        },
      },
    },
    params: { id: "report-1" },
  };
}

test("a full-access operator can update status and receives the safe updated report", async () => {
  const db = readableDb({
    detail: row({
      status: "resolved",
      status_updated_at: "2026-07-20T13:00:00.000Z",
      status_updated_by_name: "Archive Officer",
      status_updated_by_email: "archive.officer@example.test",
    }),
  });
  const response = await onDetailPatch(patchContext({ status: "resolved" }, db));
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.report.status, "resolved");
  assert.equal(payload.report.statusUpdatedAt, "2026-07-20T13:00:00.000Z");
  assert.deepEqual(payload.report.statusUpdatedBy, {
    name: "Archive Officer",
    email: "archive.officer@example.test",
  });
  assert.match(db.calls[0].sql, /UPDATE student_issue_reports/);
  assert.deepEqual(db.calls[0].values.slice(0, 1), ["resolved"]);
  assert.deepEqual(db.calls[0].values.slice(2), [
    "staff-2",
    "Archive Officer",
    "archive.officer@example.test",
    "staff",
    "report-1",
  ]);
  assert.equal("status_updated_by_user_id" in payload.report, false);
  assert.equal("status_updated_by_role" in payload.report, false);
});

test("status PATCH validates same-origin JSON and the exact payload before D1", async () => {
  let prepareCalls = 0;
  const db = { prepare() { prepareCalls += 1; throw new Error("must not query"); } };
  const responses = [
    await onDetailPatch(patchContext({ status: "resolved" }, db, { origin: "https://attacker.example" })),
    await onDetailPatch(patchContext({ status: "resolved" }, db, { "content-type": "text/plain" })),
    await onDetailPatch(patchContext("{", db)),
    await onDetailPatch(patchContext({ status: "resolved", extra: true }, db)),
    await onDetailPatch(patchContext({ status: "closed" }, db)),
    await onDetailPatch(patchContext({ status: "resolved" }, db, { "content-length": "1025" })),
  ];

  assert.deepEqual(responses.map((response) => response.status), [403, 415, 400, 400, 400, 413]);
  assert.equal(prepareCalls, 0);
});

test("status PATCH returns not found without issuing a detail read", async () => {
  const db = readableDb({ updateChanges: 0 });
  const response = await onDetailPatch(patchContext({ status: "replied" }, db));

  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { error: "report_not_found" });
  assert.equal(db.calls.length, 1);
  assert.match(db.calls[0].sql, /UPDATE student_issue_reports/);
});

test("content-restricted accounts cannot read the report archive or reach D1", async () => {
  const checkedPermissions = [];
  let prepareCalls = 0;
  globalThis.fetch = async (url) => {
    const permission = new URL(url).searchParams.get("permission");
    checkedPermissions.push(permission);
    return Response.json({
      allowed: permission === REQUIRED_PERMISSION,
      reason: permission === REQUIRED_PERMISSION ? "entry_granted" : "content_denied",
      user: { id: "user-1", email: "student@example.test" },
    });
  };
  const context = {
    request: new Request("https://uom-su-mail-system.pages.dev/api/report-archive", {
      headers: { cookie: "chemvault_session=shared.report-archive-session" },
    }),
    env: { ARCHIVE_DB: { prepare() { prepareCalls += 1; throw new Error("must not query"); } } },
    data: {},
  };

  const response = await onListGet(context);
  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), { error: "permission_denied" });
  assert.deepEqual(checkedPermissions, [REQUIRED_PERMISSION, FULL_ACCESS_PERMISSION]);
  assert.equal(prepareCalls, 0);
});

test("content-restricted accounts cannot change report status", async () => {
  const checkedPermissions = [];
  let prepareCalls = 0;
  globalThis.fetch = async (url) => {
    const permission = new URL(url).searchParams.get("permission");
    checkedPermissions.push(permission);
    return Response.json({
      allowed: permission === REQUIRED_PERMISSION,
      reason: permission === REQUIRED_PERMISSION ? "entry_granted" : "content_denied",
      user: { id: "user-1", email: "student@example.test" },
    });
  };
  const response = await onDetailPatch({
    request: new Request("https://uom-su-mail-system.pages.dev/api/report-archive/report-1", {
      method: "PATCH",
      headers: {
        cookie: "chemvault_session=shared.restricted-status-session",
        origin: "https://uom-su-mail-system.pages.dev",
        "content-type": "application/json",
      },
      body: JSON.stringify({ status: "resolved" }),
    }),
    env: { ARCHIVE_DB: { prepare() { prepareCalls += 1; throw new Error("must not query"); } } },
    data: {},
    params: { id: "report-1" },
  });

  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), { error: "permission_denied" });
  assert.deepEqual(checkedPermissions, [REQUIRED_PERMISSION, FULL_ACCESS_PERMISSION]);
  assert.equal(prepareCalls, 0);
});

test("unauthenticated archive reads receive a login URL and never reach D1", async () => {
  let prepareCalls = 0;
  const response = await onListGet({
    request: new Request("https://uom-su-mail-system.pages.dev/api/report-archive"),
    env: { ARCHIVE_DB: { prepare() { prepareCalls += 1; } } },
    data: {},
  });
  const payload = await response.json();

  assert.equal(response.status, 401);
  assert.equal(payload.error, "authentication_required");
  assert.equal(new URL(payload.loginUrl).pathname, "/api/auth/handoff/start");
  assert.equal(prepareCalls, 0);
});

test("missing reports and private storage failures return non-disclosing errors", async () => {
  const missing = await onDetailGet(allowedContext(
    "/api/report-archive/missing",
    readableDb({ detail: null }),
    { id: "missing" },
  ));
  assert.equal(missing.status, 404);
  assert.deepEqual(await missing.json(), { error: "report_not_found" });

  const unavailable = await onListGet(allowedContext("/api/report-archive", {
    prepare() { throw new Error("private D1 report detail"); },
  }));
  assert.equal(unavailable.status, 503);
  const unavailableBody = await unavailable.text();
  assert.match(unavailableBody, /report_archive_unavailable/);
  assert.doesNotMatch(unavailableBody, /private D1 report detail/);
});

test("report archive routes reject unsupported mutations and advertise their allowed methods", async () => {
  const listResponse = onListPost();
  assert.equal(listResponse.status, 405);
  assert.equal(listResponse.headers.get("allow"), "GET");
  assert.deepEqual(await listResponse.json(), { error: "method_not_allowed" });

  const detailResponse = onDetailDelete();
  assert.equal(detailResponse.status, 405);
  assert.equal(detailResponse.headers.get("allow"), "GET, PATCH");
  assert.deepEqual(await detailResponse.json(), { error: "method_not_allowed" });
});
