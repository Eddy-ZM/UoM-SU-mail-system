import {
  reportArchiveAccessError,
  reportArchiveErrorResponse,
  resolveReportArchiveAccess,
} from "../../_lib/report-archive-api.js";
import { listStudentReports } from "../../_lib/report-store.js";
import { jsonResponse } from "../../_lib/access-gate.js";

export async function onRequestGet(context) {
  const decision = await resolveReportArchiveAccess(context);
  if (decision.kind !== "allowed") {
    return reportArchiveAccessError(decision, context.request, context.env);
  }

  try {
    const url = new URL(context.request.url);
    return jsonResponse(await listStudentReports(context.env.ARCHIVE_DB, {
      query: url.searchParams.get("q"),
      page: url.searchParams.get("page"),
      limit: url.searchParams.get("limit"),
    }));
  } catch (error) {
    return reportArchiveErrorResponse(error);
  }
}

export function onRequestPost() {
  return jsonResponse({ error: "method_not_allowed" }, 405, { allow: "GET" });
}

export const onRequestPut = onRequestPost;
export const onRequestPatch = onRequestPost;
export const onRequestDelete = onRequestPost;
