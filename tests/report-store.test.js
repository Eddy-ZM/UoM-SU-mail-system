import test from "node:test";
import assert from "node:assert/strict";
import {
  createStudentReport,
  getStudentReport,
  listStudentReports,
  REPORT_STATUSES,
  ReportValidationError,
  updateStudentReportStatus,
} from "../functions/_lib/report-store.js";

const NOW = Date.parse("2026-07-20T12:00:00.000Z");

function validPayload(overrides = {}) {
  return {
    category: "teaching",
    summary: "Back-to-back teaching rooms are too far apart",
    details: "Students cannot travel between the two teaching rooms within the ten-minute changeover.",
    desiredOutcome: "Please review the timetable or room allocation.",
    studyStage: "undergraduate",
    courseContext: "CHEM20000",
    impact: "moderate",
    contactPreference: "anonymous",
    contactEmail: "Should.Not.Be.Stored@example.test",
    privacyAccepted: true,
    website: "",
    startedAt: NOW - 2_000,
    ...overrides,
  };
}

function recordingDb() {
  const calls = [];
  return {
    calls,
    prepare(sql) {
      return {
        bind(...values) {
          calls.push({ sql, values });
          return { async run() { return { success: true }; } };
        },
      };
    },
  };
}

test("a valid anonymous report is normalized and written without contact details", async () => {
  const db = recordingDb();
  const result = await createStudentReport(db, new Request("https://example.test/api/reports"), validPayload(), {
    now: NOW,
    id: "report-id",
    reference: "CHEM-SR-RPT-A1B2C3D4",
    cryptoImplementation: { randomUUID: () => "unused" },
  });

  assert.deepEqual(result, { reference: "CHEM-SR-RPT-A1B2C3D4", createdAt: "2026-07-20T12:00:00.000Z" });
  assert.equal(db.calls.length, 1);
  assert.deepEqual(db.calls[0].values, [
    "report-id",
    "CHEM-SR-RPT-A1B2C3D4",
    "teaching",
    "Back-to-back teaching rooms are too far apart",
    "Students cannot travel between the two teaching rooms within the ten-minute changeover.",
    "Please review the timetable or room allocation.",
    "undergraduate",
    "CHEM20000",
    "moderate",
    0,
    null,
    "2026-07-20T12:00:00.000Z",
  ]);
});

test("a contact request stores a normalized email address", async () => {
  const db = recordingDb();
  await createStudentReport(db, new Request("https://example.test/api/reports"), validPayload({
    contactPreference: "contact",
    contactEmail: " Student.Name@Manchester.ac.uk ",
  }), {
    now: NOW,
    id: "report-id",
    reference: "CHEM-SR-RPT-A1B2C3D4",
    cryptoImplementation: { randomUUID: () => "unused" },
  });

  assert.equal(db.calls[0].values[9], 1);
  assert.equal(db.calls[0].values[10], "student.name@manchester.ac.uk");
});

test("invalid, rushed and overlong reports are rejected before any database write", async () => {
  for (const payload of [
    validPayload({ category: "not-a-category" }),
    validPayload({ startedAt: NOW - 200 }),
    validPayload({ details: "too short" }),
    validPayload({ summary: "x".repeat(121) }),
    validPayload({ privacyAccepted: false }),
  ]) {
    const db = recordingDb();
    await assert.rejects(
      createStudentReport(db, new Request("https://example.test/api/reports"), payload, {
        now: NOW,
        cryptoImplementation: { randomUUID: () => "unused" },
      }),
      ReportValidationError,
    );
    assert.equal(db.calls.length, 0);
  }
});

test("a missing report database fails closed with a service error", async () => {
  await assert.rejects(
    createStudentReport(null, new Request("https://example.test/api/reports"), validPayload(), { now: NOW }),
    (error) => error instanceof ReportValidationError && error.status === 503,
  );
});

function archivedRow(overrides = {}) {
  return {
    id: "report-id",
    reference: "CHEM-SR-RPT-A1B2C3D4",
    category: "teaching",
    summary: "Back-to-back teaching rooms are too far apart",
    details: "Students cannot travel between the two teaching rooms within the ten-minute changeover.",
    desired_outcome: "Please review the timetable or room allocation.",
    study_stage: "undergraduate",
    course_context: "CHEM20000",
    impact: "moderate",
    contact_requested: 1,
    contact_email: "student.name@manchester.ac.uk",
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

function archiveDb({ rows = [archivedRow()], detail = archivedRow(), total = rows.length, updateChanges = 1 } = {}) {
  const calls = [];
  return {
    calls,
    prepare(sql) {
      const call = { sql, values: [] };
      calls.push(call);
      return {
        bind(...values) {
          call.values = values;
          return this;
        },
        async first() {
          if (/COUNT\(\*\)/.test(sql)) return { total };
          return detail;
        },
        async all() {
          return { results: rows };
        },
        async run() {
          return { meta: { changes: updateChanges } };
        },
      };
    },
  };
}

test("the protected archive lists compact summaries with stable pagination", async () => {
  const db = archiveDb({ total: 5 });
  const result = await listStudentReports(db, { page: "2", limit: "2" });

  assert.deepEqual(result, {
    reports: [{
      id: "report-id",
      reference: "CHEM-SR-RPT-A1B2C3D4",
      category: "teaching",
      summary: "Back-to-back teaching rooms are too far apart",
      impact: "moderate",
      contactPreference: "contact",
      status: "in-progress",
      statusUpdatedAt: "2026-07-20T12:30:00.000Z",
      statusUpdatedBy: { name: "Support Officer", email: "support@example.test" },
      createdAt: "2026-07-20T12:00:00.000Z",
    }],
    pagination: { page: 2, limit: 2, total: 5, totalPages: 3 },
  });
  const listCall = db.calls.find((call) => /LIMIT \? OFFSET \?/.test(call.sql));
  assert.match(listCall.sql, /ORDER BY created_at DESC, id DESC/);
  assert.deepEqual(listCall.values, [2, 2]);
  assert.equal("details" in result.reports[0], false);
  assert.equal("contactEmail" in result.reports[0], false);
});

test("legacy reports default to the new workflow state without update metadata", async () => {
  assert.deepEqual(REPORT_STATUSES, ["new", "in-progress", "replied", "resolved"]);
  const legacyRow = archivedRow({
    status: undefined,
    status_updated_at: undefined,
    status_updated_by_name: undefined,
    status_updated_by_email: undefined,
  });
  const result = await listStudentReports(archiveDb({ rows: [legacyRow] }));

  assert.equal(result.reports[0].status, "new");
  assert.equal(result.reports[0].statusUpdatedAt, null);
  assert.equal(result.reports[0].statusUpdatedBy, null);
});

test("archive search escapes SQL wildcards and searches full report fields", async () => {
  const db = archiveDb({ rows: [], total: 0 });
  const result = await listStudentReports(db, { query: "Lab_100%", page: "1", limit: "10" });

  const countCall = db.calls.find((call) => /COUNT\(\*\)/.test(call.sql));
  const listCall = db.calls.find((call) => /LIMIT \? OFFSET \?/.test(call.sql));
  assert.equal(countCall.values.length, 10);
  assert.ok(countCall.values.every((value) => value === "%Lab\\_100\\%%"));
  assert.deepEqual(listCall.values, [...countCall.values, 10, 0]);
  assert.match(listCall.sql, /details LIKE \?/);
  assert.match(listCall.sql, /contact_email LIKE \?/);
  assert.deepEqual(result.pagination, { page: 1, limit: 10, total: 0, totalPages: 0 });
});

test("the protected archive fetches one complete report without internal fields", async () => {
  const db = archiveDb();
  const report = await getStudentReport(db, " report-id ");

  assert.deepEqual(report, {
    id: "report-id",
    reference: "CHEM-SR-RPT-A1B2C3D4",
    category: "teaching",
    summary: "Back-to-back teaching rooms are too far apart",
    impact: "moderate",
    contactPreference: "contact",
    status: "in-progress",
    statusUpdatedAt: "2026-07-20T12:30:00.000Z",
    statusUpdatedBy: { name: "Support Officer", email: "support@example.test" },
    createdAt: "2026-07-20T12:00:00.000Z",
    details: "Students cannot travel between the two teaching rooms within the ten-minute changeover.",
    desiredOutcome: "Please review the timetable or room allocation.",
    studyStage: "undergraduate",
    courseContext: "CHEM20000",
    contactEmail: "student.name@manchester.ac.uk",
  });
  assert.deepEqual(db.calls[0].values, ["report-id"]);
  assert.equal("contact_requested" in report, false);
  assert.equal("created_at" in report, false);

  const missingDb = archiveDb({ detail: null });
  assert.equal(await getStudentReport(missingDb, "missing-report"), null);
});

test("status updates record the verified operator and return the updated safe report", async () => {
  const updatedRow = archivedRow({
    status: "resolved",
    status_updated_at: "2026-07-20T13:00:00.000Z",
    status_updated_by_name: "Archive Officer",
    status_updated_by_email: "archive.officer@example.test",
  });
  const db = archiveDb({ detail: updatedRow });
  const report = await updateStudentReportStatus(db, " report-id ", "resolved", {
    id: " staff-2 ",
    name: " Archive Officer ",
    email: " Archive.Officer@Example.test ",
    systemRole: " staff ",
  }, { updatedAt: "2026-07-20T13:00:00.000Z" });

  assert.match(db.calls[0].sql, /UPDATE student_issue_reports/);
  assert.deepEqual(db.calls[0].values, [
    "resolved",
    "2026-07-20T13:00:00.000Z",
    "staff-2",
    "Archive Officer",
    "archive.officer@example.test",
    "staff",
    "report-id",
  ]);
  assert.equal(report.status, "resolved");
  assert.equal(report.statusUpdatedAt, "2026-07-20T13:00:00.000Z");
  assert.deepEqual(report.statusUpdatedBy, {
    name: "Archive Officer",
    email: "archive.officer@example.test",
  });
  assert.equal("status_updated_by_user_id" in report, false);
  assert.equal("status_updated_by_role" in report, false);
});

test("status updates validate workflow values and fail closed for missing operators", async () => {
  let prepareCalls = 0;
  const db = { prepare() { prepareCalls += 1; throw new Error("must not query"); } };

  await assert.rejects(
    () => updateStudentReportStatus(db, "report-id", "closed", {
      id: "staff-1",
      email: "staff@example.test",
    }),
    ReportValidationError,
  );
  await assert.rejects(
    () => updateStudentReportStatus(db, "report-id", "resolved", { name: "Missing identity" }),
    (error) => error instanceof ReportValidationError && error.status === 503,
  );
  assert.equal(prepareCalls, 0);

  const missingDb = archiveDb({ updateChanges: 0 });
  assert.equal(await updateStudentReportStatus(missingDb, "missing", "replied", {
    id: "staff-1",
    email: "staff@example.test",
  }), null);
  assert.equal(missingDb.calls.length, 1);
});

test("invalid archive search and pagination fail before querying D1", async () => {
  let prepareCalls = 0;
  const db = { prepare() { prepareCalls += 1; throw new Error("must not query"); } };

  for (const options of [
    { page: "0" },
    { page: "1.5" },
    { limit: "101" },
    { query: "x".repeat(129) },
  ]) {
    await assert.rejects(() => listStudentReports(db, options), ReportValidationError);
  }
  await assert.rejects(() => getStudentReport(db, " "), ReportValidationError);
  assert.equal(prepareCalls, 0);
});
