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

export async function loadReportArchive(query = "", page = 1, limit = 20) {
  const url = new URL("/api/report-archive", window.location.origin);
  if (query.trim()) url.searchParams.set("q", query.trim());
  url.searchParams.set("page", String(page));
  url.searchParams.set("limit", String(limit));

  const response = await fetch(url, {
    credentials: "same-origin",
    cache: "no-store",
    headers: { accept: "application/json" },
  });
  const payload = await readJson(response);
  if (!response.ok || !Array.isArray(payload.reports)) {
    throw requestError(response, payload, "Submitted reports could not be loaded.");
  }
  return payload;
}

export async function loadReportArchiveEntry(reportId) {
  const response = await fetch(`/api/report-archive/${encodeURIComponent(reportId)}`, {
    credentials: "same-origin",
    cache: "no-store",
    headers: { accept: "application/json" },
  });
  const payload = await readJson(response);
  if (!response.ok || !payload.report) {
    throw requestError(response, payload, "The submitted report could not be loaded.");
  }
  return payload.report;
}

export async function updateReportArchiveStatus(reportId, status) {
  const response = await fetch(`/api/report-archive/${encodeURIComponent(reportId)}`, {
    method: "PATCH",
    credentials: "same-origin",
    cache: "no-store",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ status }),
  });
  const payload = await readJson(response);
  if (!response.ok || !payload.report) {
    throw requestError(response, payload, "The report status could not be updated.");
  }
  return payload.report;
}
