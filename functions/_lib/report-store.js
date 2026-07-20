const CATEGORIES = [
  "teaching",
  "assessment",
  "laboratory",
  "facilities",
  "accessibility",
  "student-support",
  "conduct",
  "other",
];
const STUDY_STAGES = ["undergraduate", "postgraduate-taught", "postgraduate-research", "other"];
const IMPACT_LEVELS = ["limited", "moderate", "significant"];
const CONTACT_PREFERENCES = ["anonymous", "contact"];
const MAX_FORM_AGE_MS = 24 * 60 * 60 * 1000;
const MIN_FORM_AGE_MS = 1_000;

export class ReportValidationError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = "ReportValidationError";
    this.status = status;
  }
}

function requiredString(value, label, maxLength, minLength = 1) {
  if (typeof value !== "string") throw new ReportValidationError(`${label} is required.`);
  const normalized = value.trim();
  if (normalized.length < minLength) throw new ReportValidationError(`${label} is too short.`);
  if (normalized.length > maxLength) throw new ReportValidationError(`${label} is too long.`);
  return normalized;
}

function optionalString(value, label, maxLength) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") throw new ReportValidationError(`${label} is invalid.`);
  const normalized = value.trim();
  if (!normalized) return null;
  if (normalized.length > maxLength) throw new ReportValidationError(`${label} is too long.`);
  return normalized;
}

function allowedValue(value, values, label, optional = false) {
  if (optional && (value === undefined || value === null || value === "")) return null;
  if (!values.includes(value)) throw new ReportValidationError(`${label} is invalid.`);
  return value;
}

function normalizedEmail(value) {
  const email = requiredString(value, "Email address", 254);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ReportValidationError("Email address is invalid.");
  return email.toLowerCase();
}

function validateStartedAt(value, now) {
  const startedAt = Number(value);
  if (!Number.isFinite(startedAt)) throw new ReportValidationError("Please reload the page and try again.");
  const elapsed = now - startedAt;
  if (elapsed < MIN_FORM_AGE_MS || elapsed > MAX_FORM_AGE_MS) {
    throw new ReportValidationError("Please reload the page and try again.");
  }
}

function normalizePayload(payload, now) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new ReportValidationError("The report is invalid.");
  }
  if (typeof payload.website === "string" && payload.website.trim()) {
    throw new ReportValidationError("The report could not be submitted.");
  }
  if (payload.privacyAccepted !== true) {
    throw new ReportValidationError("Please read and accept the Privacy Notice before submitting.");
  }
  validateStartedAt(payload.startedAt, now);

  const contactPreference = allowedValue(payload.contactPreference, CONTACT_PREFERENCES, "Contact preference");
  return {
    category: allowedValue(payload.category, CATEGORIES, "Issue type"),
    summary: requiredString(payload.summary, "Short summary", 120, 5),
    details: requiredString(payload.details, "Issue description", 3_000, 20),
    desiredOutcome: optionalString(payload.desiredOutcome, "Requested improvement", 1_200),
    studyStage: allowedValue(payload.studyStage, STUDY_STAGES, "Study stage", true),
    courseContext: optionalString(payload.courseContext, "Course unit or location", 120),
    impact: allowedValue(payload.impact, IMPACT_LEVELS, "Impact"),
    contactRequested: contactPreference === "contact",
    contactEmail: contactPreference === "contact" ? normalizedEmail(payload.contactEmail) : null,
  };
}

function reportReference(randomUUID) {
  return `CHEM-SR-RPT-${randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase()}`;
}

export async function createStudentReport(db, request, payload, options = {}) {
  if (!db?.prepare) throw new ReportValidationError("The reporting service is temporarily unavailable.", 503);
  const now = options.now ?? Date.now();
  const cryptoImplementation = options.cryptoImplementation || globalThis.crypto;
  if (!cryptoImplementation?.randomUUID) {
    throw new ReportValidationError("The reporting service is temporarily unavailable.", 503);
  }

  const report = normalizePayload(payload, now);

  const id = options.id || cryptoImplementation.randomUUID();
  const reference = options.reference || reportReference(() => cryptoImplementation.randomUUID());
  const createdAt = options.createdAt || new Date(now).toISOString();

  await db.prepare(`
    INSERT INTO student_issue_reports (
      id, reference, category, summary, details, desired_outcome, study_stage, course_context,
      impact, contact_requested, contact_email, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id,
    reference,
    report.category,
    report.summary,
    report.details,
    report.desiredOutcome,
    report.studyStage,
    report.courseContext,
    report.impact,
    report.contactRequested ? 1 : 0,
    report.contactEmail,
    createdAt,
  ).run();

  return { reference, createdAt };
}
