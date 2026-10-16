import {
  reportArchiveAccessError,
  reportArchiveErrorResponse,
  resolveReportArchiveAccess,
} from "../../_lib/report-archive-api.js";
import { getStudentReport, updateStudentReportStatus } from "../../_lib/report-store.js";
import { jsonResponse } from "../../_lib/access-gate.js";

const MAX_STATUS_REQUEST_BYTES = 1_024;

function reportId(context) {
  return String(context.params?.id || "").trim();
}

export async function onRequestGet(context) {
  const decision = await resolveReportArchiveAccess(context);
  if (decision.kind !== "allowed") {
    return reportArchiveAccessError(decision, context.request, context.env);
  }

  try {
    const report = await getStudentReport(context.env.ARCHIVE_DB, reportId(context));
    return report
      ? jsonResponse({ report })
      : jsonResponse({ error: "report_not_found" }, 404);
  } catch (error) {
    return reportArchiveErrorResponse(error);
  }
}

export async function onRequestPatch(context) {
  const decision = await resolveReportArchiveAccess(context);
  if (decision.kind !== "allowed") {
    return reportArchiveAccessError(decision, context.request, context.env);
  }

  const requestUrl = new URL(context.request.url);
  if (context.request.headers.get("origin") !== requestUrl.origin) {
    return jsonResponse({
      error: "origin_not_allowed",
      message: "The report status must be updated from this website.",
    }, 403);
  }
  const mediaType = context.request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase();
  if (mediaType !== "application/json") {
    return jsonResponse({
      error: "unsupported_media_type",
      message: "The report status format is not supported.",
    }, 415);
  }
  const contentLength = Number(context.request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_STATUS_REQUEST_BYTES) {
    return jsonResponse({ error: "request_too_large", message: "The report status request is too large." }, 413);
  }

  let payload;
  try {
    const body = await context.request.text();
    if (new TextEncoder().encode(body).byteLength > MAX_STATUS_REQUEST_BYTES) {
      return jsonResponse({ error: "request_too_large", message: "The report status request is too large." }, 413);
    }
    payload = JSON.parse(body);
  } catch {
    return jsonResponse({
      error: "invalid_report_archive_request",
      message: "A JSON report status is required.",
    }, 400);
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)
    || Object.keys(payload).length !== 1 || !Object.hasOwn(payload, "status")) {
    return jsonResponse({
      error: "invalid_report_archive_request",
      message: "Only a report status may be updated.",
    }, 400);
  }

  try {
    const report = await updateStudentReportStatus(
      context.env.ARCHIVE_DB,
      reportId(context),
      payload.status,
      decision.user,
    );
    return report
      ? jsonResponse({ report })
      : jsonResponse({ error: "report_not_found" }, 404);
  } catch (error) {
    return reportArchiveErrorResponse(error);
  }
}

export function onRequestPost() {
  return jsonResponse({ error: "method_not_allowed" }, 405, { allow: "GET, PATCH" });
}

export const onRequestPut = onRequestPost;
export const onRequestDelete = onRequestPost;
