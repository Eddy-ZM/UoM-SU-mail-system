import test from "node:test";
import assert from "node:assert/strict";
import { createStudentReport, ReportValidationError } from "../functions/_lib/report-store.js";

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
