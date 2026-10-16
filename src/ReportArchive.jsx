import { useCallback, useEffect, useRef, useState } from "react";
import {
  loadReportArchive,
  loadReportArchiveEntry,
  updateReportArchiveStatus,
} from "./reportArchiveClient.js";
import "./report-archive.css";

const CATEGORY_LABELS = {
  teaching: "Teaching",
  assessment: "Assessment",
  laboratory: "Laboratory",
  facilities: "Facilities",
  accessibility: "Accessibility",
  "student-support": "Student support",
  conduct: "Conduct",
  other: "Other",
};

const IMPACT_LABELS = {
  limited: "Limited impact",
  moderate: "Moderate impact",
  significant: "Significant impact",
};

const STUDY_STAGE_LABELS = {
  undergraduate: "Undergraduate",
  "postgraduate-taught": "Postgraduate taught",
  "postgraduate-research": "Postgraduate research",
  other: "Other",
};

const STATUS_OPTIONS = [
  { value: "new", label: "New" },
  { value: "in-progress", label: "In progress" },
  { value: "replied", label: "Replied" },
  { value: "resolved", label: "Resolved" },
];

const STATUS_LABELS = Object.fromEntries(STATUS_OPTIONS.map((option) => [option.value, option.label]));

const EMPTY_PAGINATION = { page: 1, limit: 20, total: 0, totalPages: 0 };

function formatDate(value) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not recorded";
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function labelledValue(labels, value, fallback = "Not provided") {
  return labels[value] || value || fallback;
}

export function ReportArchive({ onClose }) {
  const detailRef = useRef(null);
  const [query, setQuery] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const [reports, setReports] = useState([]);
  const [pagination, setPagination] = useState(EMPTY_PAGINATION);
  const [selected, setSelected] = useState(null);
  const [status, setStatus] = useState("loading-list");
  const [error, setError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const refresh = useCallback(async (search = "", page = 1) => {
    setStatus("loading-list");
    setError("");
    setStatusMessage("");
    setSelected(null);
    try {
      const payload = await loadReportArchive(search, page);
      setReports(payload.reports);
      setPagination(payload.pagination || EMPTY_PAGINATION);
      setStatus("ready");
    } catch (caught) {
      setReports([]);
      setPagination(EMPTY_PAGINATION);
      setError(caught instanceof Error ? caught.message : "Submitted reports could not be loaded.");
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    void refresh("", 1);
  }, [refresh]);

  useEffect(() => {
    if (!selected || !detailRef.current) return;
    detailRef.current.focus({ preventScroll: true });
    detailRef.current.scrollIntoView({ block: "start" });
  }, [selected]);

  const openReport = async (report) => {
    setStatus("loading-detail");
    setError("");
    setStatusMessage("");
    try {
      setSelected(await loadReportArchiveEntry(report.id));
      setStatus("ready");
    } catch (caught) {
      setSelected(null);
      setError(caught instanceof Error ? caught.message : "The submitted report could not be loaded.");
      setStatus("error");
    }
  };

  const submitSearch = (event) => {
    event.preventDefault();
    const nextQuery = query.trim();
    setActiveQuery(nextQuery);
    void refresh(nextQuery, 1);
  };

  const clearSearch = () => {
    setQuery("");
    setActiveQuery("");
    void refresh("", 1);
  };

  const openPage = (page) => {
    if (page < 1 || page > pagination.totalPages || page === pagination.page) return;
    void refresh(activeQuery, page);
  };

  const changeReportStatus = async (nextStatus) => {
    if (!selected || nextStatus === selected.status || updatingStatus) return;
    setUpdatingStatus(true);
    setError("");
    setStatusMessage("");
    try {
      const updated = await updateReportArchiveStatus(selected.id, nextStatus);
      setSelected(updated);
      setReports((current) => current.map((report) => (
        report.id === updated.id
          ? {
            ...report,
            status: updated.status,
            statusUpdatedAt: updated.statusUpdatedAt,
            statusUpdatedBy: updated.statusUpdatedBy,
          }
          : report
      )));
      setStatusMessage(`Marked as ${labelledValue(STATUS_LABELS, updated.status).toLowerCase()}.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The report status could not be updated.");
    } finally {
      setUpdatingStatus(false);
    }
  };

  const resultStart = pagination.total === 0 ? 0 : ((pagination.page - 1) * pagination.limit) + 1;
  const resultEnd = Math.min(pagination.page * pagination.limit, pagination.total);

  return (
    <section className="report-archive" aria-labelledby="report-archive-title">
      <header className="report-archive__header">
        <div>
          <p>CONFIDENTIAL STUDENT SUBMISSIONS</p>
          <h1 id="report-archive-title">Student reports</h1>
        </div>
        <button type="button" onClick={onClose}>Back to workspace</button>
      </header>

      <div className="report-archive__policy">
        <div>
          <span>Archive status</span>
          <strong>Restricted to authorised representatives</strong>
        </div>
        <p>Review submissions only for representative work. Contact details must not be copied or shared beyond the stated follow-up purpose.</p>
      </div>

      <form className="report-archive__search" onSubmit={submitSearch} role="search">
        <label htmlFor="report-archive-search">Search submitted reports</label>
        <div>
          <input
            id="report-archive-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Reference, issue type, summary or report content"
          />
          {(query || activeQuery) && <button type="button" onClick={clearSearch}>Clear</button>}
          <button className="report-archive__search-submit" type="submit">Search</button>
        </div>
      </form>

      {error && <div className="report-archive__error" role="alert">{error}</div>}

      <div className="report-archive__layout">
        <section className="report-archive__index" aria-labelledby="report-archive-index-title">
          <div className="report-archive__index-heading">
            <div>
              <span id="report-archive-index-title">Submitted reports</span>
              <strong>{pagination.total}</strong>
            </div>
            {pagination.total > 0 && <small>Showing {resultStart}–{resultEnd}</small>}
          </div>

          {status === "loading-list" && <p className="report-archive__empty">Loading submitted reports...</p>}
          {status !== "loading-list" && reports.length === 0 && (
            <p className="report-archive__empty">{activeQuery ? "No reports match this search." : "No student reports have been submitted yet."}</p>
          )}

          <div className="report-archive__records">
            {reports.map((report) => (
              <button
                className={selected?.id === report.id ? "is-selected" : ""}
                type="button"
                key={report.id}
                onClick={() => void openReport(report)}
                aria-current={selected?.id === report.id ? "true" : undefined}
                disabled={status === "loading-detail" && selected?.id !== report.id}
              >
                <span className="report-archive__record-topline">
                  <strong>{labelledValue(CATEGORY_LABELS, report.category)}</strong>
                  <span className={`report-status report-status--${report.status || "new"}`}>{labelledValue(STATUS_LABELS, report.status || "new")}</span>
                </span>
                <span className="report-archive__record-summary">{report.summary}</span>
                <span className="report-archive__record-meta">
                  <code>{report.reference}</code>
                  <span>{formatDate(report.createdAt)}</span>
                </span>
                <span className="report-archive__record-contact">
                  <span>{report.contactPreference === "contact" ? "Follow-up requested" : "Anonymous submission"}</span>
                  <span className={`impact impact--${report.impact}`}>{labelledValue(IMPACT_LABELS, report.impact)}</span>
                </span>
              </button>
            ))}
          </div>

          {pagination.totalPages > 1 && (
            <nav className="report-archive__pagination" aria-label="Report archive pages">
              <button type="button" onClick={() => openPage(pagination.page - 1)} disabled={pagination.page <= 1}>Previous</button>
              <span>Page {pagination.page} of {pagination.totalPages}</span>
              <button type="button" onClick={() => openPage(pagination.page + 1)} disabled={pagination.page >= pagination.totalPages}>Next</button>
            </nav>
          )}
        </section>

        <section
          className="report-archive__detail"
          aria-live="polite"
          aria-labelledby="report-archive-detail-title"
          ref={detailRef}
          tabIndex="-1"
        >
          {!selected && status !== "loading-detail" && (
            <div className="report-archive__detail-empty">
              <span>Report record</span>
              <h2 id="report-archive-detail-title">Select a submission to review</h2>
              <p>The full description, requested outcome and any optional contact details will appear here.</p>
            </div>
          )}

          {status === "loading-detail" && <p className="report-archive__detail-loading">Opening report...</p>}

          {selected && status !== "loading-detail" && (
            <article>
              <header className="report-archive__detail-heading">
                <div>
                  <span>{labelledValue(CATEGORY_LABELS, selected.category)}</span>
                  <h2 id="report-archive-detail-title">{selected.summary}</h2>
                </div>
                <button type="button" onClick={() => setSelected(null)}>Close record</button>
              </header>

              <dl className="report-archive__metadata">
                <div><dt>Reference</dt><dd><code>{selected.reference}</code></dd></div>
                <div><dt>Submitted</dt><dd>{formatDate(selected.createdAt)}</dd></div>
                <div><dt>Impact</dt><dd>{labelledValue(IMPACT_LABELS, selected.impact)}</dd></div>
                <div><dt>Follow-up</dt><dd>{selected.contactPreference === "contact" ? "Requested" : "Anonymous"}</dd></div>
              </dl>

              <section className="report-archive__status" aria-labelledby="report-archive-status-title">
                <div className="report-archive__status-copy">
                  <span id="report-archive-status-title">Handling status</span>
                  <strong>{labelledValue(STATUS_LABELS, selected.status || "new")}</strong>
                  <small>
                    {selected.statusUpdatedAt && selected.statusUpdatedBy
                      ? `Updated ${formatDate(selected.statusUpdatedAt)} by ${selected.statusUpdatedBy.name || selected.statusUpdatedBy.email}.`
                      : "No handling update has been recorded."}
                  </small>
                </div>
                <div className="report-archive__status-actions" aria-label="Update report handling status">
                  {STATUS_OPTIONS.map((option) => (
                    <button
                      className={selected.status === option.value || (!selected.status && option.value === "new") ? "is-active" : ""}
                      type="button"
                      key={option.value}
                      onClick={() => void changeReportStatus(option.value)}
                      disabled={updatingStatus || selected.status === option.value || (!selected.status && option.value === "new")}
                      aria-pressed={selected.status === option.value || (!selected.status && option.value === "new")}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                {statusMessage && <p className="report-archive__status-message" role="status">{statusMessage}</p>}
              </section>

              <section className="report-archive__statement">
                <span>Issue description</span>
                <p>{selected.details}</p>
              </section>

              <div className="report-archive__detail-grid">
                <section>
                  <span>Requested improvement</span>
                  <p>{selected.desiredOutcome || "No requested outcome was provided."}</p>
                </section>
                <section>
                  <span>Study context</span>
                  <dl>
                    <div><dt>Stage</dt><dd>{labelledValue(STUDY_STAGE_LABELS, selected.studyStage)}</dd></div>
                    <div><dt>Course or location</dt><dd>{selected.courseContext || "Not provided"}</dd></div>
                  </dl>
                </section>
              </div>

              <section className="report-archive__contact">
                <span>Contact instruction</span>
                {selected.contactPreference === "contact" && selected.contactEmail
                  ? <p>The student requested follow-up at <a href={`mailto:${selected.contactEmail}`}>{selected.contactEmail}</a>.</p>
                  : <p>This report was submitted anonymously. Do not attempt to identify the student.</p>}
              </section>
            </article>
          )}
        </section>
      </div>
    </section>
  );
}
