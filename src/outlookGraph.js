export async function getOutlookDraftAvailability(signal) {
  const response = await fetch("/api/outlook/status", {
    method: "GET",
    credentials: "same-origin",
    headers: { accept: "application/json" },
    signal,
  });
  if (!response.ok) return false;
  const payload = await response.json();
  return payload.configured === true;
}

export function openOutlookDraftAuthorisation(archiveId, documentObject = document) {
  const form = documentObject.createElement("form");
  form.method = "post";
  form.action = "/api/outlook/start";
  form.target = "_blank";
  form.hidden = true;
  const archiveField = documentObject.createElement("input");
  archiveField.type = "hidden";
  archiveField.name = "archiveId";
  archiveField.value = String(archiveId || "");
  form.appendChild(archiveField);
  documentObject.body.appendChild(form);
  try {
    form.submit();
  } finally {
    form.remove();
  }
}
