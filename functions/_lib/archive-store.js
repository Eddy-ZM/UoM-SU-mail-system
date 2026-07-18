import {
  canonicalizeEmailHtml,
  extractMessageNumber,
  extractVerificationCode,
  isValidMessageNumber,
  isValidVerificationCode,
  sha256Hex,
  verificationCodeFromSha256,
} from "../../shared/email-integrity.js";

export const ARCHIVE_OWNER_EMAIL = "ziwen.mu@chemvault.science";
export const ARCHIVE_OPERATIONS = Object.freeze(["copy_html", "copy_outlook", "download_html"]);

const MAX_HTML_BYTES = 2_000_000;
const MAX_SUBJECT_LENGTH = 500;
const MAX_FILENAME_LENGTH = 255;
const MAX_PRESET_LENGTH = 80;

export class ArchiveValidationError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = "ArchiveValidationError";
    this.status = status;
  }
}

function requiredString(value, name, maxLength) {
  if (typeof value !== "string" || !value.trim()) throw new ArchiveValidationError(`${name} is required.`);
  const normalized = value.trim();
  if (normalized.length > maxLength) throw new ArchiveValidationError(`${name} is too long.`);
  return normalized;
}

function normalizedUser(user) {
  if (!user || typeof user.id !== "string" || typeof user.email !== "string") {
    throw new ArchiveValidationError("Verified submitter information is unavailable.", 503);
  }
  return {
    id: user.id,
    email: user.email.trim().toLowerCase(),
    role: typeof user.systemRole === "string" && user.systemRole.trim() ? user.systemRole.trim() : "user",
  };
}

export function canDeleteArchives(user) {
  return String(user?.email || "").trim().toLowerCase() === ARCHIVE_OWNER_EMAIL;
}

export async function createArchive(db, payload, verifiedUser, options = {}) {
  if (!db?.prepare) throw new ArchiveValidationError("Archive database is unavailable.", 503);
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new ArchiveValidationError("Archive request is invalid.");

  const operation = requiredString(payload.operation, "operation", 40);
  if (!ARCHIVE_OPERATIONS.includes(operation)) throw new ArchiveValidationError("Archive operation is invalid.");
  const html = requiredString(payload.html, "html", MAX_HTML_BYTES);
  if (new TextEncoder().encode(html).byteLength > MAX_HTML_BYTES) throw new ArchiveValidationError("Email HTML is too large.", 413);
  const subject = requiredString(payload.subject, "subject", MAX_SUBJECT_LENGTH);
  const filename = requiredString(payload.filename, "filename", MAX_FILENAME_LENGTH);
  const preset = typeof payload.preset === "string" ? payload.preset.trim().slice(0, MAX_PRESET_LENGTH) : "custom";
  const modules = payload.modules && typeof payload.modules === "object" && !Array.isArray(payload.modules) ? payload.modules : {};
  const user = normalizedUser(verifiedUser);

  let messageNumber;
  let submittedVerificationCode;
  let canonicalHtml;
  try {
    messageNumber = extractMessageNumber(html);
    submittedVerificationCode = extractVerificationCode(html);
    canonicalHtml = canonicalizeEmailHtml(html);
  } catch (error) {
    throw new ArchiveValidationError(error instanceof Error ? error.message : "Email integrity fields are invalid.");
  }

  const computedSha256 = await sha256Hex(canonicalHtml, options.cryptoImplementation || globalThis.crypto);
  const verificationCode = verificationCodeFromSha256(computedSha256);
  if (verificationCode !== submittedVerificationCode) {
    throw new ArchiveValidationError("Email verification code does not match the submitted HTML.");
  }

  const archiveId = options.id || globalThis.crypto.randomUUID();
  const createdAt = options.createdAt || new Date().toISOString();
  const document = JSON.stringify({
    subject,
    filename,
    preset,
    modules,
    messageNumber,
    sha256: computedSha256,
    verificationCode,
  });

  await db.prepare(`
    INSERT INTO email_archives (
      id, message_number, sha256, verification_code, operation, subject, filename, html, document_json,
      submitted_by_user_id, submitted_by_email, submitted_by_role, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    archiveId,
    messageNumber,
    computedSha256,
    verificationCode,
    operation,
    subject,
    filename,
    html,
    document,
    user.id,
    user.email,
    user.role,
    createdAt,
  ).run();

  return {
    id: archiveId,
    messageNumber,
    sha256: computedSha256,
    verificationCode,
    operation,
    subject,
    filename,
    submittedBy: user,
    createdAt,
  };
}

function archiveSummary(row) {
  return {
    id: row.id,
    messageNumber: row.message_number,
    sha256: row.sha256,
    verificationCode: row.verification_code,
    operation: row.operation,
    subject: row.subject,
    filename: row.filename,
    submittedBy: {
      id: row.submitted_by_user_id,
      email: row.submitted_by_email,
      role: row.submitted_by_role,
    },
    createdAt: row.created_at,
  };
}

export async function listArchives(db, search = "", requestedLimit = 50) {
  if (!db?.prepare) throw new ArchiveValidationError("Archive database is unavailable.", 503);
  const query = String(search || "").trim().slice(0, 128);
  const limit = Math.min(Math.max(Number.parseInt(requestedLimit, 10) || 50, 1), 100);
  let statement;
  if (query) {
    const like = `%${query.replaceAll("%", "\\%").replaceAll("_", "\\_")}%`;
    statement = db.prepare(`
      SELECT id, message_number, sha256, verification_code, operation, subject, filename,
             submitted_by_user_id, submitted_by_email, submitted_by_role, created_at
      FROM email_archives
      WHERE message_number LIKE ? ESCAPE '\\' OR sha256 LIKE ? ESCAPE '\\' OR verification_code LIKE ? ESCAPE '\\'
      ORDER BY created_at DESC
      LIMIT ?
    `).bind(like, like, like, limit);
  } else {
    statement = db.prepare(`
      SELECT id, message_number, sha256, verification_code, operation, subject, filename,
             submitted_by_user_id, submitted_by_email, submitted_by_role, created_at
      FROM email_archives
      ORDER BY created_at DESC
      LIMIT ?
    `).bind(limit);
  }
  const result = await statement.all();
  return (result.results || []).map(archiveSummary);
}

export async function getArchive(db, archiveId) {
  if (!db?.prepare) throw new ArchiveValidationError("Archive database is unavailable.", 503);
  const row = await db.prepare(`
    SELECT id, message_number, sha256, verification_code, operation, subject, filename, html, document_json,
           submitted_by_user_id, submitted_by_email, submitted_by_role, created_at
    FROM email_archives WHERE id = ?
  `).bind(archiveId).first();
  if (!row) return null;
  return {
    ...archiveSummary(row),
    html: row.html,
    document: JSON.parse(row.document_json),
  };
}

export async function deleteArchive(db, archiveId, verifiedUser) {
  if (!canDeleteArchives(verifiedUser)) throw new ArchiveValidationError("Only the archive owner may delete backups.", 403);
  if (!db?.prepare) throw new ArchiveValidationError("Archive database is unavailable.", 503);
  const result = await db.prepare("DELETE FROM email_archives WHERE id = ?").bind(archiveId).run();
  return Number(result.meta?.changes || 0) > 0;
}

export async function verifyArchivedMessage(db, messageNumber, verificationCode) {
  if (!db?.prepare) throw new ArchiveValidationError("Archive database is unavailable.", 503);
  const normalizedNumber = String(messageNumber || "").trim().toUpperCase();
  const normalizedCode = String(verificationCode || "").trim().toUpperCase();
  if (!isValidMessageNumber(normalizedNumber) || !isValidVerificationCode(normalizedCode)) return { valid: false };
  const row = await db.prepare(`
    SELECT MIN(created_at) AS first_archived_at
    FROM email_archives
    WHERE message_number = ? AND verification_code = ?
  `).bind(normalizedNumber, normalizedCode).first();
  if (!row?.first_archived_at) return { valid: false };
  return { valid: true, firstArchivedAt: row.first_archived_at };
}
