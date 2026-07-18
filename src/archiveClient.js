import { prepareEmailForArchive } from "../shared/email-integrity.js";

async function readJson(response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

function requestError(response, payload, fallback) {
  const error = new Error(typeof payload.message === "string" ? payload.message : fallback);
  error.status = response.status;
  return error;
}

export async function archiveEmailExport({ html, subject, filename, preset, modules, operation }) {
  const prepared = await prepareEmailForArchive(html);
  const response = await fetch("/api/archives", {
    method: "POST",
    credentials: "same-origin",
    cache: "no-store",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      html: prepared.html,
      subject,
      filename,
      preset,
      modules,
      operation,
    }),
  });
  const payload = await readJson(response);
  if (!response.ok || !payload.archive) throw requestError(response, payload, "The immutable archive could not be created.");
  if (payload.archive.sha256 !== prepared.sha256 || payload.archive.verificationCode !== prepared.verificationCode || payload.archive.messageNumber !== prepared.messageNumber) {
    throw new Error("The archive service returned inconsistent integrity data.");
  }
  return { ...prepared, archive: payload.archive };
}

export async function loadArchives(query = "") {
  const url = new URL("/api/archives", window.location.origin);
  if (query.trim()) url.searchParams.set("q", query.trim());
  const response = await fetch(url, { credentials: "same-origin", cache: "no-store", headers: { accept: "application/json" } });
  const payload = await readJson(response);
  if (!response.ok) throw requestError(response, payload, "Archived emails could not be loaded.");
  return payload;
}

export async function loadArchive(archiveId) {
  const response = await fetch(`/api/archives/${encodeURIComponent(archiveId)}`, {
    credentials: "same-origin",
    cache: "no-store",
    headers: { accept: "application/json" },
  });
  const payload = await readJson(response);
  if (!response.ok || !payload.archive) throw requestError(response, payload, "The archived email could not be loaded.");
  return payload.archive;
}

export async function removeArchive(archiveId) {
  const response = await fetch(`/api/archives/${encodeURIComponent(archiveId)}`, {
    method: "DELETE",
    credentials: "same-origin",
    cache: "no-store",
    headers: { accept: "application/json" },
  });
  if (response.status === 204) return;
  const payload = await readJson(response);
  throw requestError(response, payload, "The archived email could not be deleted.");
}
