import { jsonResponse } from "../_lib/access-gate.js";
import { createStudentReport, ReportValidationError } from "../_lib/report-store.js";

const MAX_REQUEST_BYTES = 12_000;

function errorResponse(error) {
  if (error instanceof ReportValidationError) {
    return jsonResponse({ error: "report_invalid", message: error.message }, error.status);
  }
  return jsonResponse({ error: "report_unavailable", message: "The reporting service is temporarily unavailable. Please try again later." }, 503);
}

export async function onRequestPost({ request, env }) {
  const requestUrl = new URL(request.url);
  const origin = request.headers.get("origin");
  if (origin !== requestUrl.origin) {
    return jsonResponse({ error: "origin_not_allowed", message: "The report must be submitted from this website." }, 403);
  }
  if (!request.headers.get("content-type")?.toLowerCase().includes("application/json")) {
    return jsonResponse({ error: "unsupported_media_type", message: "The report format is not supported." }, 415);
  }
  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES) {
    return jsonResponse({ error: "report_too_large", message: "The report is too large." }, 413);
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ error: "invalid_json", message: "The report format is invalid." }, 400);
  }

  try {
    const result = await createStudentReport(env.ARCHIVE_DB, request, payload);
    return jsonResponse(result, 201);
  } catch (error) {
    return errorResponse(error);
  }
}

export function onRequestGet() {
  return jsonResponse({ error: "method_not_allowed" }, 405);
}
