import { useCallback, useEffect, useState } from "react";
import { canReopenArchive } from "../shared/archive-reopen.js";
import { loadArchive, loadArchives, removeArchive } from "./archiveClient.js";

const OPERATION_LABELS = {
  copy_html: "Copy HTML",
  copy_outlook: "Copy for Outlook",
  download_html: "Download HTML",
};

function formatDate(value) {
  return new Date(value).toLocaleString("en-GB");
}

function legacyCopyText(value) {
  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  textarea.remove();
  if (!copied) throw new Error("The browser blocked clipboard access.");
}

async function copyHtmlSource(html) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(html);
    return;
  }
  legacyCopyText(html);
}

async function copyHtmlForOutlook(html) {
  const parsed = new DOMParser().parseFromString(html, "text/html");
  const bodyHtml = parsed.body.innerHTML;
  const plainText = parsed.body.innerText.replace(/\n{3,}/g, "\n\n").trim();

  if (window.ClipboardItem && navigator.clipboard?.write) {
    await navigator.clipboard.write([
      new window.ClipboardItem({
        "text/html": new Blob([bodyHtml], { type: "text/html" }),
        "text/plain": new Blob([plainText], { type: "text/plain" }),
      }),
    ]);
    return;
  }

  const holder = document.createElement("div");
  holder.innerHTML = bodyHtml;
  holder.style.position = "fixed";
  holder.style.left = "-9999px";
  document.body.appendChild(holder);
  try {
    const range = document.createRange();
    range.selectNodeContents(holder);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    const copied = document.execCommand("copy");
    selection.removeAllRanges();
    if (!copied) throw new Error("The browser blocked clipboard access.");
  } finally {
    holder.remove();
  }
}

function downloadArchivedHtml(archive) {
  const blob = new Blob([archive.html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = archive.filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function ArchivePanel({
  open,
  onClose,
  initialArchiveId = "",
  variant = "overlay",
  closeLabel = "Close",
}) {
  const [query, setQuery] = useState("");
  const [records, setRecords] = useState([]);
  const [canDelete, setCanDelete] = useState(false);
  const [selected, setSelected] = useState(null);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [now, setNow] = useState(() => Date.now());

  const refresh = useCallback(async (search = "") => {
    setStatus("loading");
    setError("");
    setActionMessage("");
    try {
      const payload = await loadArchives(search);
      setRecords(Array.isArray(payload.archives) ? payload.archives : []);
      setCanDelete(payload.canDelete === true);
      setStatus("ready");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Archived emails could not be loaded.");
      setStatus("error");
    }
  }, []);

  const viewRecord = useCallback(async (record) => {
    setStatus("loading-detail");
    setError("");
    setActionMessage("");
    try {
      const archive = await loadArchive(record.id);
      if (!canReopenArchive(archive) || typeof archive.html !== "string") {
        throw new Error("The 24-hour read-only reopening window has expired.");
      }
      setSelected(archive);
      setStatus("ready");
    } catch (caught) {
      setSelected(null);
      setError(caught instanceof Error ? caught.message : "The archived email could not be loaded.");
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    if (!open) {
      setSelected(null);
      setActionMessage("");
      return undefined;
    }

    let cancelled = false;
    setNow(Date.now());
    void (async () => {
      await refresh("");
      if (!cancelled && initialArchiveId) await viewRecord({ id: initialArchiveId });
    })();
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [initialArchiveId, open, refresh, viewRecord]);

  useEffect(() => {
    if (selected && !canReopenArchive(selected, now)) {
      setSelected(null);
      setError("The 24-hour read-only reopening window has expired.");
    }
  }, [now, selected]);

  if (!open) return null;

  const deleteRecord = async (record) => {
    if (!canDelete || !window.confirm(`Permanently delete archive ${record.messageNumber}? This cannot be undone.`)) return;
    setStatus("deleting");
    setError("");
    setActionMessage("");
    try {
      await removeArchive(record.id);
      if (selected?.id === record.id) setSelected(null);
      await refresh(query);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The archived email could not be deleted.");
      setStatus("error");
    }
  };

  const runReadOnlyAction = async (action, successMessage) => {
    if (!selected || !canReopenArchive(selected)) {
      setSelected(null);
      setError("The 24-hour read-only reopening window has expired.");
      return;
    }
    setActionMessage("");
    setError("");
    try {
      await action();
      setActionMessage(successMessage);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The browser blocked this operation. Please try again.");
    }
  };

  const panel = (
    <section
      className={`archive-panel ${variant === "page" ? "archive-panel--page" : ""}`.trim()}
      role={variant === "page" ? "region" : "dialog"}
      aria-modal={variant === "page" ? undefined : "true"}
      aria-labelledby="archive-title"
    >
        <header className="archive-panel-header">
          <div>
            <p>IMMUTABLE AUDIT RECORDS</p>
            <h2 id="archive-title">Email backups</h2>
          </div>
          <button className="archive-back" type="button" onClick={onClose} aria-label={`${closeLabel} from email backups`}>
            <span aria-hidden="true">&#8592;</span>
            {closeLabel}
          </button>
        </header>

        <p className="archive-policy">Archived emails remain immutable. Their read-only preview and export tools are available to authorised team members for 24 hours from the first archive time.</p>

        <form className="archive-search" onSubmit={(event) => { event.preventDefault(); setSelected(null); void refresh(query); }}>
          <label htmlFor="archive-search">Search by email subject, message number, verification code or SHA-256</label>
          <div>
            <input id="archive-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Email subject, CHEM-SR-A1B2C3D4 or hash" />
            <button type="submit">Search</button>
          </div>
        </form>

        {error && <div className="archive-error" role="alert">{error}</div>}
        {actionMessage && <div className="archive-success" role="status">{actionMessage}</div>}
        {status === "loading" && <p className="archive-empty">Loading immutable backups...</p>}
        {status !== "loading" && records.length === 0 && <p className="archive-empty">No matching archived emails.</p>}
        <div className="archive-records">
          {records.map((record) => {
            const reopenAvailable = canReopenArchive(record, now);
            return (
              <article className="archive-record" key={record.id}>
                <div className="archive-record-main">
                  <strong className="archive-record-title">{record.subject?.trim() || "Untitled email"}</strong>
                  <span className="archive-record-number">Message No.: <code>{record.messageNumber}</code></span>
                  <span>Verification code: <code>{record.verificationCode}</code></span>
                  <code>{record.sha256}</code>
                  <span>{OPERATION_LABELS[record.operation] || record.operation} &middot; {formatDate(record.createdAt)}</span>
                  <span>{record.submittedBy.email} &middot; {record.submittedBy.role}</span>
                  <span className={reopenAvailable ? "archive-window archive-window--open" : "archive-window"}>
                    {reopenAvailable ? `Read-only access until ${formatDate(record.reopenExpiresAt)}` : "Read-only access expired"}
                  </span>
                </div>
                <div className="archive-record-actions">
                  <button
                    type="button"
                    onClick={() => void viewRecord(record)}
                    disabled={!reopenAvailable || status === "loading-detail"}
                    title={reopenAvailable ? "Open the immutable read-only copy" : "The 24-hour reopening window has expired"}
                  >
                    {reopenAvailable ? "Open" : "Expired"}
                  </button>
                  {canDelete && <button className="archive-delete" type="button" onClick={() => void deleteRecord(record)}>Delete</button>}
                </div>
              </article>
            );
          })}
        </div>

        {selected && (
          <section className="archive-detail" aria-label={`Archived email ${selected.messageNumber}`}>
            <div className="archive-detail-heading">
              <div><strong>{selected.subject}</strong><span>{selected.filename}</span></div>
              <button type="button" onClick={() => setSelected(null)}>Hide preview</button>
            </div>
            <div className="archive-detail-actions" aria-label="Read-only archived email actions">
              <button type="button" onClick={() => void runReadOnlyAction(() => copyHtmlForOutlook(selected.html), "Outlook email copied from the immutable backup.")}>Copy for Outlook</button>
              <button type="button" onClick={() => void runReadOnlyAction(() => copyHtmlSource(selected.html), "HTML copied from the immutable backup.")}>Copy HTML</button>
              <button type="button" onClick={() => void runReadOnlyAction(() => downloadArchivedHtml(selected), "HTML downloaded from the immutable backup.")}>Download HTML</button>
            </div>
            <p className="archive-readonly-notice">Read-only access expires {formatDate(selected.reopenExpiresAt)}. Copying or downloading does not create or modify an archive record.</p>
            <dl>
              <div><dt>Message number</dt><dd>{selected.messageNumber}</dd></div>
              <div><dt>SHA-256</dt><dd><code>{selected.sha256}</code></dd></div>
              <div><dt>Verification code</dt><dd><code>{selected.verificationCode}</code></dd></div>
              <div><dt>Submitted by</dt><dd>{selected.submittedBy.email} ({selected.submittedBy.id})</dd></div>
              <div><dt>First archived</dt><dd>{formatDate(selected.firstArchivedAt)}</dd></div>
            </dl>
            <iframe className="archive-preview" title={`Read-only preview of ${selected.messageNumber}`} srcDoc={selected.html} sandbox="" />
            <details className="archive-source">
              <summary>View read-only HTML source</summary>
              <textarea aria-label="Read-only archived HTML" value={selected.html} readOnly rows="12" />
            </details>
          </section>
        )}
    </section>
  );

  if (variant === "page") return panel;

  return (
    <div className="archive-overlay" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      {panel}
    </div>
  );
}
