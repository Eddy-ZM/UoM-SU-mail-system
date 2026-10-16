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
export const REPORT_STATUSES = Object.freeze(["new", "in-progress", "replied", "resolved"]);
const MAX_FORM_AGE_MS = 24 * 60 * 60 * 1000;
const MIN_FORM_AGE_MS = 1_000;
const DEFAULT_ARCHIVE_PAGE_SIZE = 20;
const MAX_ARCHIVE_PAGE_SIZE = 100;
const MAX_ARCHIVE_PAGE = 10_000;
const MAX_ARCHIVE_SEARCH_LENGTH = 128;

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

function archiveInteger(value, fallback, minimum, maximum, label) {
  if (value === undefined || value === null || value === "") return fallback;
  const normalized = String(value).trim();
  if (!/^\d+$/.test(normalized)) throw new ReportValidationError(`${label} is invalid.`);
  const number = Number.parseInt(normalized, 10);
  if (!Number.isSafeInteger(number) || number < minimum || number > maximum) {
    throw new ReportValidationError(`${label} is invalid.`);
  }
  return number;
}

function archiveSearch(value) {
  const query = String(value || "").trim();
  if (query.length > MAX_ARCHIVE_SEARCH_LENGTH) {
    throw new ReportValidationError("Search is too long.");
  }
  return query;
}

function archiveReportSummary(row) {
  const statusUpdatedEmail = typeof row.status_updated_by_email === "string"
    ? row.status_updated_by_email.trim()
    : "";
  return {
    id: row.id,
    reference: row.reference,
    category: row.category,
    summary: row.summary,
    impact: row.impact,
    contactPreference: Number(row.contact_requested) === 1 ? "contact" : "anonymous",
    status: REPORT_STATUSES.includes(row.status) ? row.status : "new",
    statusUpdatedAt: row.status_updated_at || null,
    statusUpdatedBy: statusUpdatedEmail ? {
      name: typeof row.status_updated_by_name === "string" && row.status_updated_by_name.trim()
        ? row.status_updated_by_name.trim()
        : statusUpdatedEmail,
      email: statusUpdatedEmail,
    } : null,
    createdAt: row.created_at,
  };
}

function archiveReportDetail(row) {
  return {
    ...archiveReportSummary(row),
    details: row.details,
    desiredOutcome: row.desired_outcome,
    studyStage: row.study_stage,
    courseContext: row.course_context,
    contactEmail: row.contact_email,
  };
}

function normalizedStatusOperator(user) {
  const id = typeof user?.id === "string" ? user.id.trim() : "";
  const email = typeof user?.email === "string" ? user.email.trim().toLowerCase() : "";
  if (!id || id.length > 255 || !email || email.length > 254) {
    throw new ReportValidationError("Verified operator information is unavailable.", 503);
  }
  const suppliedName = typeof user.name === "string" ? user.name.trim() : "";
  const suppliedRole = typeof user.systemRole === "string" ? user.systemRole.trim() : "";
  return {
    id,
    name: suppliedName && suppliedName.length <= 200 ? suppliedName : email,
    email,
    role: suppliedRole && suppliedRole.length <= 80 ? suppliedRole : "user",
  };
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

export async function listStudentReports(db, options = {}) {
  if (!db?.prepare) throw new ReportValidationError("The report archive is temporarily unavailable.", 503);

  const query = archiveSearch(options.query);
  const page = archiveInteger(options.page, 1, 1, MAX_ARCHIVE_PAGE, "Page");
  const limit = archiveInteger(options.limit, DEFAULT_ARCHIVE_PAGE_SIZE, 1, MAX_ARCHIVE_PAGE_SIZE, "Page size");
  const offset = (page - 1) * limit;
  const summaryColumns = `
    id, reference, category, summary, impact, contact_requested, status, status_updated_at,
    status_updated_by_name, status_updated_by_email, created_at
  `;

  let countStatement;
  let listStatement;
  if (query) {
    const like = `%${query.replaceAll("%", "\\%").replaceAll("_", "\\_")}%`;
    const where = `
      WHERE reference LIKE ? ESCAPE '\\' COLLATE NOCASE
         OR category LIKE ? ESCAPE '\\' COLLATE NOCASE
         OR summary LIKE ? ESCAPE '\\' COLLATE NOCASE
         OR details LIKE ? ESCAPE '\\' COLLATE NOCASE
         OR desired_outcome LIKE ? ESCAPE '\\' COLLATE NOCASE
         OR study_stage LIKE ? ESCAPE '\\' COLLATE NOCASE
         OR course_context LIKE ? ESCAPE '\\' COLLATE NOCASE
         OR impact LIKE ? ESCAPE '\\' COLLATE NOCASE
         OR contact_email LIKE ? ESCAPE '\\' COLLATE NOCASE
         OR status LIKE ? ESCAPE '\\' COLLATE NOCASE
    `;
    const searchValues = Array(10).fill(like);
    countStatement = db.prepare(`SELECT COUNT(*) AS total FROM student_issue_reports ${where}`).bind(...searchValues);
    listStatement = db.prepare(`
      SELECT ${summaryColumns}
      FROM student_issue_reports
      ${where}
      ORDER BY created_at DESC, id DESC
      LIMIT ? OFFSET ?
    `).bind(...searchValues, limit, offset);
  } else {
    countStatement = db.prepare("SELECT COUNT(*) AS total FROM student_issue_reports");
    listStatement = db.prepare(`
      SELECT ${summaryColumns}
      FROM student_issue_reports
      ORDER BY created_at DESC, id DESC
      LIMIT ? OFFSET ?
    `).bind(limit, offset);
  }

  const [countRow, listResult] = await Promise.all([countStatement.first(), listStatement.all()]);
  const total = Math.max(0, Number(countRow?.total) || 0);
  return {
    reports: (listResult.results || []).map(archiveReportSummary),
    pagination: {
      page,
      limit,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / limit),
    },
  };
}

export async function getStudentReport(db, reportId) {
  if (!db?.prepare) throw new ReportValidationError("The report archive is temporarily unavailable.", 503);
  const id = requiredString(reportId, "Report identifier", 128);
  const row = await db.prepare(`
    SELECT id, reference, category, summary, details, desired_outcome, study_stage, course_context,
           impact, contact_requested, contact_email, status, status_updated_at,
           status_updated_by_name, status_updated_by_email, created_at
    FROM student_issue_reports
    WHERE id = ?
    LIMIT 1
  `).bind(id).first();
  return row ? archiveReportDetail(row) : null;
}

export async function updateStudentReportStatus(db, reportId, status, verifiedUser, options = {}) {
  if (!db?.prepare) throw new ReportValidationError("The report archive is temporarily unavailable.", 503);
  const id = requiredString(reportId, "Report identifier", 128);
  const normalizedStatus = allowedValue(status, REPORT_STATUSES, "Report status");
  const operator = normalizedStatusOperator(verifiedUser);
  const updatedAt = options.updatedAt || new Date(options.now ?? Date.now()).toISOString();

  const result = await db.prepare(`
    UPDATE student_issue_reports
    SET status = ?, status_updated_at = ?, status_updated_by_user_id = ?, status_updated_by_name = ?,
        status_updated_by_email = ?, status_updated_by_role = ?
    WHERE id = ?
  `).bind(
    normalizedStatus,
    updatedAt,
    operator.id,
    operator.name,
    operator.email,
    operator.role,
    id,
  ).run();
  if (Number(result.meta?.changes || 0) < 1) return null;
  return getStudentReport(db, id);
}
