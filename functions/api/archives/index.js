import { archiveAccessError, archiveErrorResponse, resolveArchiveAccess } from "../../_lib/archive-api.js";
import { canDeleteArchives, createArchive, listArchives } from "../../_lib/archive-store.js";
import { jsonResponse } from "../../_lib/access-gate.js";

export async function onRequestGet(context) {
  const decision = await resolveArchiveAccess(context);
  if (decision.kind !== "allowed") return archiveAccessError(decision, context.request, context.env);

  try {
    const url = new URL(context.request.url);
    const archives = await listArchives(context.env.ARCHIVE_DB, url.searchParams.get("q"), url.searchParams.get("limit"));
    return jsonResponse({
      archives,
      canDelete: canDeleteArchives(decision.user),
    });
  } catch (error) {
    return archiveErrorResponse(error);
  }
}

export async function onRequestPost(context) {
  const decision = await resolveArchiveAccess(context);
  if (decision.kind !== "allowed") return archiveAccessError(decision, context.request, context.env);

  let payload;
  try {
    payload = await context.request.json();
  } catch {
    return jsonResponse({ error: "invalid_json", message: "A JSON archive payload is required." }, 400);
  }

  try {
    const archive = await createArchive(context.env.ARCHIVE_DB, payload, decision.user);
    return jsonResponse({ archive }, 201);
  } catch (error) {
    return archiveErrorResponse(error);
  }
}

export function onRequestPut() {
  return jsonResponse({ error: "immutable_archive", message: "Archived email backups cannot be modified." }, 405, { allow: "GET, POST" });
}

export const onRequestPatch = onRequestPut;
