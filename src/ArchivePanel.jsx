import { useCallback, useEffect, useState } from "react";
import { loadArchive, loadArchives, removeArchive } from "./archiveClient.js";

const OPERATION_LABELS = {
  copy_html: "Copy HTML",
  copy_outlook: "Copy for Outlook",
  download_html: "Download HTML",
};

export function ArchivePanel({ open, onClose }) {
  const [query, setQuery] = useState("");
  const [records, setRecords] = useState([]);
  const [canDelete, setCanDelete] = useState(false);
  const [selected, setSelected] = useState(null);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");

  const refresh = useCallback(async (search = "") => {
    setStatus("loading");
    setError("");
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

  useEffect(() => {
    if (open) void refresh("");
  }, [open, refresh]);

  if (!open) return null;

  const viewRecord = async (record) => {
    setStatus("loading-detail");
    setError("");
    try {
      setSelected(await loadArchive(record.id));
      setStatus("ready");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The archived email could not be loaded.");
      setStatus("error");
    }
  };

  const deleteRecord = async (record) => {
    if (!canDelete || !window.confirm(`Permanently delete archive ${record.messageNumber}? This cannot be undone.`)) return;
    setStatus("deleting");
    setError("");
    try {
      await removeArchive(record.id);
      if (selected?.id === record.id) setSelected(null);
      await refresh(query);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The archived email could not be deleted.");
      setStatus("error");
    }
  };

  return (
    <div className="archive-overlay" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="archive-panel" role="dialog" aria-modal="true" aria-labelledby="archive-title">
        <header className="archive-panel-header">
          <div>
            <p>IMMUTABLE AUDIT RECORDS</p>
            <h2 id="archive-title">Email backups</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close email backups">Close</button>
        </header>

        <form className="archive-search" onSubmit={(event) => { event.preventDefault(); void refresh(query); }}>
          <label htmlFor="archive-search">Search by message number, verification code or SHA-256</label>
          <div>
            <input id="archive-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="CHEM-SR-A1B2C3D4 or hash" />
            <button type="submit">Search</button>
          </div>
        </form>

        {error && <div className="archive-error" role="alert">{error}</div>}
        {status === "loading" && <p className="archive-empty">Loading immutable backups...</p>}
        {status !== "loading" && records.length === 0 && <p className="archive-empty">No matching archived emails.</p>}
        <div className="archive-records">
          {records.map((record) => (
            <article className="archive-record" key={record.id}>
              <div className="archive-record-main">
                <strong>{record.messageNumber}</strong>
                <span>Verification code: <code>{record.verificationCode}</code></span>
                <code>{record.sha256}</code>
                <span>{OPERATION_LABELS[record.operation] || record.operation} &middot; {new Date(record.createdAt).toLocaleString("en-GB")}</span>
                <span>{record.submittedBy.email} &middot; {record.submittedBy.role}</span>
              </div>
              <div className="archive-record-actions">
                <button type="button" onClick={() => void viewRecord(record)}>View</button>
                {canDelete && <button className="archive-delete" type="button" onClick={() => void deleteRecord(record)}>Delete</button>}
              </div>
            </article>
          ))}
        </div>

        {selected && (
          <section className="archive-detail" aria-label={`Archived email ${selected.messageNumber}`}>
            <div className="archive-detail-heading">
              <div><strong>{selected.subject}</strong><span>{selected.filename}</span></div>
              <button type="button" onClick={() => setSelected(null)}>Hide details</button>
            </div>
            <dl>
              <div><dt>Message number</dt><dd>{selected.messageNumber}</dd></div>
              <div><dt>SHA-256</dt><dd><code>{selected.sha256}</code></dd></div>
              <div><dt>Verification code</dt><dd><code>{selected.verificationCode}</code></dd></div>
              <div><dt>Submitted by</dt><dd>{selected.submittedBy.email} ({selected.submittedBy.id})</dd></div>
              <div><dt>Created</dt><dd>{new Date(selected.createdAt).toLocaleString("en-GB")}</dd></div>
            </dl>
            <label htmlFor="archived-html">Read-only archived HTML</label>
            <textarea id="archived-html" value={selected.html} readOnly rows="12" />
          </section>
        )}
      </section>
    </div>
  );
}
