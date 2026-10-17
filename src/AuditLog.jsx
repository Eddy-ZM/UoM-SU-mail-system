import { useCallback, useEffect, useMemo, useState } from "react";
import { currentAuditSessionId } from "./auditClient.js";
import "./audit-log.css";

const PAGE_SIZE = 40;

function formatDate(value) {
  if (!value) return "Not recorded";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).format(new Date(value));
}

function actionLabel(value = "") {
  return value.split(".").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" · ");
}

function sessionState(session, now = Date.now()) {
  if (session.ended_at) return session.end_reason === "logout" ? "Signed out" : "Closed";
  return now - new Date(session.last_seen_at).getTime() <= 150_000 ? "Online" : "Inactive";
}

export function AuditLog({ onClose }) {
  const [query, setQuery] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const [outcome, setOutcome] = useState("");
  const [offset, setOffset] = useState(0);
  const [data, setData] = useState({ events: [], sessions: [], pagination: { total: 0, limit: PAGE_SIZE, offset: 0 }, generatedAt: null });
  const [selectedId, setSelectedId] = useState("");
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");

  const refresh = useCallback(async ({ quiet = false } = {}) => {
    if (!quiet) setStatus("loading");
    try {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(offset), sessionId: currentAuditSessionId() });
      if (activeQuery) params.set("q", activeQuery);
      if (outcome) params.set("outcome", outcome);
      const response = await fetch(`/api/admin/audit-logs?${params}`, { credentials: "same-origin", cache: "no-store", headers: { accept: "application/json" } });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || "The audit log could not be loaded.");
      setData(payload);
      setSelectedId((current) => payload.events.some((event) => event.id === current) ? current : payload.events[0]?.id || "");
      setError("");
      setStatus("ready");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The audit log could not be loaded.");
      setStatus("error");
    }
  }, [activeQuery, offset, outcome]);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    const tick = () => { if (document.visibilityState === "visible") void refresh({ quiet: true }); };
    const timer = window.setInterval(tick, 5_000);
    document.addEventListener("visibilitychange", tick);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", tick); };
  }, [refresh]);

  const selected = useMemo(() => data.events.find((event) => event.id === selectedId) || null, [data.events, selectedId]);
  const onlineCount = data.sessions.filter((session) => sessionState(session) === "Online").length;
  const submitSearch = (event) => { event.preventDefault(); setOffset(0); setActiveQuery(query.trim()); };

  return (
    <section className="audit-log" aria-labelledby="audit-log-title">
      <header className="audit-log__header">
        <div><span>System audit</span><h1 id="audit-log-title">Activity log</h1><p>Near-real-time accountability records for authorised Mail Studio use.</p></div>
        <button type="button" onClick={onClose}>Back to workspace</button>
      </header>

      <div className="audit-log__policy">
        <div><span>Access classification</span><strong>Owner only</strong></div>
        <p>This view is restricted to Ziwen Mu. It records account activity and session state, never email bodies, subjects, student report text, cookies or access tokens.</p>
      </div>

      <div className="audit-log__summary" aria-label="Audit summary">
        <div><span>Online now</span><strong>{onlineCount}</strong><small>Heartbeat within 150 seconds</small></div>
        <div><span>Recorded events</span><strong>{data.pagination.total}</strong><small>Matching current filters</small></div>
        <div><span>Last refreshed</span><strong>{data.generatedAt ? formatDate(data.generatedAt) : "Loading…"}</strong><small>Automatic refresh every 5 seconds</small></div>
      </div>

      <form className="audit-log__filters" onSubmit={submitSearch}>
        <label>Search account or action<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Email, name or action" /></label>
        <label>Result<select value={outcome} onChange={(event) => { setOffset(0); setOutcome(event.target.value); }}><option value="">All results</option><option value="success">Success</option><option value="failure">Failure</option><option value="denied">Denied</option></select></label>
        <button type="submit">Apply filters</button>
        <button type="button" onClick={() => void refresh()}>Refresh now</button>
      </form>

      {error && <p className="audit-log__error" role="alert">{error}</p>}
      <div className="audit-log__layout">
        <section className="audit-log__index" aria-label="Recorded events">
          <div className="audit-log__index-heading"><strong>Events</strong><span>{data.pagination.total}</span></div>
          {status === "loading" && !data.events.length ? <p className="audit-log__empty">Loading secure activity records…</p> : null}
          {!data.events.length && status !== "loading" ? <p className="audit-log__empty">No events match these filters.</p> : null}
          <div className="audit-log__records">
            {data.events.map((event) => (
              <button key={event.id} type="button" className={event.id === selectedId ? "is-selected" : ""} onClick={() => setSelectedId(event.id)}>
                <span className="audit-log__record-topline"><strong>{actionLabel(event.action)}</strong><em className={`is-${event.outcome}`}>{event.outcome}</em></span>
                <span className="audit-log__record-actor">{event.actor_name || event.actor_email}</span>
                <span className="audit-log__record-meta">{event.actor_email} · {formatDate(event.occurred_at)}</span>
              </button>
            ))}
          </div>
          <div className="audit-log__pagination"><button type="button" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}>Previous</button><span>{data.pagination.total ? `${offset + 1}–${Math.min(offset + PAGE_SIZE, data.pagination.total)} of ${data.pagination.total}` : "0 records"}</span><button type="button" disabled={offset + PAGE_SIZE >= data.pagination.total} onClick={() => setOffset(offset + PAGE_SIZE)}>Next</button></div>
        </section>

        <article className="audit-log__detail">
          {!selected ? <div className="audit-log__detail-empty"><h2>Select an event</h2><p>Account, outcome and technical request details will appear here.</p></div> : <>
            <span className="audit-log__detail-kicker">{selected.category}</span>
            <h2>{actionLabel(selected.action)}</h2>
            <dl>
              <div><dt>Account</dt><dd>{selected.actor_name || "Name unavailable"}<br /><small>{selected.actor_email}</small></dd></div>
              <div><dt>Result</dt><dd className={`is-${selected.outcome}`}>{selected.outcome}</dd></div>
              <div><dt>Time</dt><dd>{formatDate(selected.occurred_at)}</dd></div>
              <div><dt>Role</dt><dd>{selected.actor_role || "Not recorded"}</dd></div>
              <div><dt>Request</dt><dd>{selected.request_method || "—"} {selected.request_path || "—"}</dd></div>
              <div><dt>HTTP status</dt><dd>{selected.http_status || "Not applicable"}</dd></div>
              <div><dt>Session</dt><dd><code>{selected.session_id || "Not linked"}</code></dd></div>
              <div><dt>Event ID</dt><dd><code>{selected.id}</code></dd></div>
            </dl>
          </>}
        </article>
      </div>

      <section className="audit-log__sessions" aria-labelledby="audit-session-title">
        <div><span>Session monitor</span><h2 id="audit-session-title">Current and recent presence</h2></div>
        <div className="audit-log__session-table" role="table">
          {data.sessions.map((session) => { const state = sessionState(session); return <div role="row" key={session.id}><span role="cell"><strong>{session.actor_name || session.actor_email}</strong><small>{session.actor_email}</small></span><span role="cell" className={`is-${state.toLowerCase().replaceAll(" ", "-")}`}>{state}</span><span role="cell">Last seen {formatDate(session.last_seen_at)}</span></div>; })}
        </div>
      </section>
    </section>
  );
}
