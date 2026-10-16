import { archiveAccessError, resolveArchiveAccess } from "./archive-api.js";
import { jsonResponse } from "./access-gate.js";
import { ReportValidationError } from "./report-store.js";

export async function resolveReportArchiveAccess(context) {
  return resolveArchiveAccess(context);
}

export function reportArchiveAccessError(decision, request, env) {
  return archiveAccessError(decision, request, env);
}

export function reportArchiveErrorResponse(error) {
  const status = error instanceof ReportValidationError && Number.isInteger(error.status)
    ? error.status
    : 503;
  const safeStatus = status >= 400 && status <= 599 ? status : 503;
  const isClientError = safeStatus < 500;
  return jsonResponse({
    error: isClientError ? "invalid_report_archive_request" : "report_archive_unavailable",
    message: isClientError && typeof error?.message === "string"
      ? error.message
      : "The report archive is temporarily unavailable.",
  }, safeStatus);
}
