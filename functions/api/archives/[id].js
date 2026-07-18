import { archiveAccessError, archiveErrorResponse, resolveArchiveAccess } from "../../_lib/archive-api.js";
import { deleteArchive, getArchive } from "../../_lib/archive-store.js";
import { jsonResponse } from "../../_lib/access-gate.js";

function archiveId(context) {
  return String(context.params?.id || "").trim();
}

export async function onRequestGet(context) {
  const decision = await resolveArchiveAccess(context);
  if (decision.kind !== "allowed") return archiveAccessError(decision, context.request, context.env);
  try {
    const archive = await getArchive(context.env.ARCHIVE_DB, archiveId(context));
    return archive ? jsonResponse({ archive }) : jsonResponse({ error: "archive_not_found" }, 404);
  } catch (error) {
    return archiveErrorResponse(error);
  }
}

export async function onRequestDelete(context) {
  const decision = await resolveArchiveAccess(context);
  if (decision.kind !== "allowed") return archiveAccessError(decision, context.request, context.env);
  try {
    const deleted = await deleteArchive(context.env.ARCHIVE_DB, archiveId(context), decision.user);
    return deleted ? new Response(null, { status: 204 }) : jsonResponse({ error: "archive_not_found" }, 404);
  } catch (error) {
    return archiveErrorResponse(error);
  }
}

export function onRequestPut() {
  return jsonResponse({ error: "immutable_archive", message: "Archived email backups cannot be modified." }, 405, { allow: "GET, DELETE" });
}

export const onRequestPatch = onRequestPut;
