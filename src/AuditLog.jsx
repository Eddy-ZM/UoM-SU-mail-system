import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown, ArrowSquareOut, CaretDown, CaretLeft, CaretRight,
  DeviceMobile, FileText, FunnelSimple, GearSix, House, MagnifyingGlass, Monitor,
  Question, ShieldCheck, SignOut, SquaresFour, Table, UsersThree, X,
} from "@phosphor-icons/react";
import { currentAuditSessionId } from "./auditClient.js";
import "./audit-log.css";

const PAGE_SIZE = 50;
const ONLINE_WINDOW_MS = 150_000;
const EMPTY_DATA = { events: [], sessions: [], accounts: [], pagination: { total: 0, limit: PAGE_SIZE, offset: 0 }, generatedAt: null };
const EMPTY_FILTERS = { query: "", outcome: "", category: "", actorEmail: "", timeRange: "7d" };

function formatDate(value) {
  if (!value) return "Not recorded";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).format(new Date(value));
}

function formatHeaderDate(value = new Date()) {
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(value);
}

function actionLabel(value = "") {
  const acronyms = { eml: "EML", html: "HTML" };
  return value.split(/[._]/).map((part) => acronyms[part] || part.charAt(0).toUpperCase() + part.slice(1)).join(" · ");
}

function categoryLabel(value = "") {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : "Activity";
}

function initialsFor(name, email) {
  const words = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (words.length > 1) return `${words[0][0]}${words.at(-1)[0]}`.toUpperCase();
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return String(email || "AU").slice(0, 2).toUpperCase();
}

function sessionState(session, now = Date.now()) {
  if (session.ended_at) return session.end_reason === "logout" ? "Signed out" : "Closed";
  return now - new Date(session.last_seen_at).getTime() <= ONLINE_WINDOW_MS ? "Online" : "Inactive";
}

function deviceLabel(session) {
  return session.client_class === "mobile" ? "Mobile · browser" : "Desktop · browser";
}

function emailTarget(event) {
  return event.target_type === "email" && event.target_id ? event.target_id : "—";
}

function timeRangeStart(range, now = Date.now()) {
  const duration = { "24h": 86_400_000, "7d": 604_800_000, "30d": 2_592_000_000 }[range];
  return duration ? new Date(now - duration).toISOString() : "";
}

function summariseAccounts(sessions) {
  const summaries = new Map();
  sessions.forEach((session) => {
    const key = String(session.actor_email || "unknown").toLowerCase();
    const existing = summaries.get(key) || {
      email: session.actor_email,
      name: session.actor_name || session.actor_email,
      active: 0,
      signedOut: 0,
      lastSeen: session.last_seen_at,
      sessions: [],
    };
    const state = sessionState(session);
    if (state === "Online") existing.active += 1;
    if (state === "Signed out" || state === "Closed") existing.signedOut += 1;
    if (new Date(session.last_seen_at) > new Date(existing.lastSeen)) existing.lastSeen = session.last_seen_at;
    existing.sessions.push(session);
    summaries.set(key, existing);
  });
  return [...summaries.values()].sort((a, b) => Number(b.active > 0) - Number(a.active > 0));
}

function StatusBadge({ value }) {
  const normalized = String(value || "success").toLowerCase();
  return <span className={`audit-status audit-status--${normalized.replaceAll(" ", "-")}`}><i aria-hidden="true" />{categoryLabel(normalized)}</span>;
}

function NavigationIcon({ label, active = false, children, onClick }) {
  return <button type="button" className={active ? "is-active" : ""} aria-label={label} title={label} onClick={onClick}>{children}</button>;
}

export function AuditLog({ onClose, user, onLogout, isLoggingOut = false }) {
  const [draftFilters, setDraftFilters] = useState(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState(EMPTY_FILTERS);
  const [offset, setOffset] = useState(0);
  const [data, setData] = useState(EMPTY_DATA);
  const [selectedId, setSelectedId] = useState(null);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [moreFiltersOpen, setMoreFiltersOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [rawOpen, setRawOpen] = useState(false);
  const requestSequenceRef = useRef(0);
  const inspectorRef = useRef(null);

  const refresh = useCallback(async ({ quiet = false } = {}) => {
    const requestSequence = requestSequenceRef.current + 1;
    requestSequenceRef.current = requestSequence;
    if (!quiet) setStatus("loading");
    try {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(offset), sessionId: currentAuditSessionId() });
      if (appliedFilters.query) params.set("q", appliedFilters.query);
      if (appliedFilters.outcome) params.set("outcome", appliedFilters.outcome);
      if (appliedFilters.category) params.set("category", appliedFilters.category);
      if (appliedFilters.actorEmail) params.set("actorEmail", appliedFilters.actorEmail);
      const since = timeRangeStart(appliedFilters.timeRange);
      if (since) params.set("since", since);
      const response = await fetch(`/api/admin/audit-logs?${params}`, { credentials: "same-origin", cache: "no-store", headers: { accept: "application/json" } });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || "The audit log could not be loaded.");
      if (requestSequence !== requestSequenceRef.current) return;
      setData(payload);
      setSelectedId((current) => {
        if (current === "") return "";
        return payload.events.some((event) => event.id === current) ? current : payload.events[0]?.id || null;
      });
      setError("");
      setStatus("ready");
    } catch (caught) {
      if (requestSequence !== requestSequenceRef.current) return;
      setError(caught instanceof Error ? caught.message : "The audit log could not be loaded.");
      setStatus("error");
    }
  }, [appliedFilters, offset]);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    const tick = () => { if (document.visibilityState === "visible") void refresh({ quiet: true }); };
    const timer = window.setInterval(tick, 5_000);
    document.addEventListener("visibilitychange", tick);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", tick); };
  }, [refresh]);

  const selected = useMemo(() => data.events.find((event) => event.id === selectedId) || null, [data.events, selectedId]);
  const accounts = useMemo(() => data.accounts?.length ? data.accounts.map((account) => ({
    email: account.actor_email,
    name: account.actor_name || account.actor_email,
    active: Number(account.online_session_count || 0),
    signedOut: Number(account.signed_out_session_count || 0),
    lastSeen: account.last_seen_at,
  })) : summariseAccounts(data.sessions), [data.accounts, data.sessions]);
  const categories = useMemo(() => data.facets?.categories?.length
    ? data.facets.categories
    : [...new Set(data.events.map((event) => event.category).filter(Boolean))].sort(), [data.events, data.facets?.categories]);
  const actors = useMemo(() => {
    const entries = new Map((data.facets?.actors || []).map((actor) => [actor.email, actor.name || actor.email]));
    data.sessions.forEach((session) => entries.set(session.actor_email, session.actor_name || session.actor_email));
    data.events.forEach((event) => entries.set(event.actor_email, event.actor_name || event.actor_email));
    return [...entries.entries()].filter(([email]) => email).sort((a, b) => a[1].localeCompare(b[1]));
  }, [data.events, data.facets?.actors, data.sessions]);
  const selectedSessions = useMemo(() => data.sessions
    .filter((session) => session.actor_email === selected?.actor_email)
    .sort((a, b) => Number(sessionState(b) === "Online") - Number(sessionState(a) === "Online") || new Date(b.last_seen_at) - new Date(a.last_seen_at)), [data.sessions, selected?.actor_email]);
  const selectedAccount = accounts.find((account) => account.email === selected?.actor_email) || accounts[0] || null;
  const firstRecord = data.pagination.total ? offset + 1 : 0;
  const lastRecord = Math.min(offset + PAGE_SIZE, data.pagination.total);

  const applyFilters = (event) => {
    event.preventDefault();
    setOffset(0);
    setSelectedId(null);
    setAppliedFilters({ ...draftFilters, query: draftFilters.query.trim() });
  };
  const clearFilters = () => { setDraftFilters(EMPTY_FILTERS); setAppliedFilters(EMPTY_FILTERS); setOffset(0); setSelectedId(null); };
  const selectEvent = (eventId) => {
    setSelectedId(eventId);
    setRawOpen(false);
    if (window.matchMedia("(max-width: 820px)").matches) {
      window.requestAnimationFrame(() => {
        inspectorRef.current?.focus({ preventScroll: true });
        inspectorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  };

  return (
    <main className="audit-console" aria-labelledby="audit-log-title">
      <aside className="audit-console__rail" aria-label="System navigation">
        <NavigationIcon label="Activity overview" active><SquaresFour weight="fill" /></NavigationIcon>
        <NavigationIcon label="Search activity" onClick={() => setMoreFiltersOpen(true)}><MagnifyingGlass /></NavigationIcon>
        <NavigationIcon label="Activity table"><Table /></NavigationIcon>
        <NavigationIcon label="Accounts"><UsersThree /></NavigationIcon>
        <NavigationIcon label="Access controls"><ShieldCheck /></NavigationIcon>
        <NavigationIcon label="Records"><FileText /></NavigationIcon>
        <NavigationIcon label="Settings"><GearSix /></NavigationIcon>
        <span />
        <NavigationIcon label="Help"><Question /></NavigationIcon>
      </aside>

      <aside className="audit-console__sidebar">
        <strong className="audit-console__nav-title">Audit</strong>
        <nav aria-label="Audit sections"><button className="is-active" type="button">Activity log</button><button type="button" disabled>Access control</button><button type="button" disabled>Data exports</button><button type="button" disabled>Retention</button></nav>
        <strong className="audit-console__nav-title">Accounts</strong>
        <nav aria-label="Account sections"><button type="button" disabled>Users</button><button type="button" disabled>Roles</button><button type="button" disabled>Groups</button></nav>
        <strong className="audit-console__nav-title">System</strong>
        <nav aria-label="System sections"><button type="button" disabled>Configuration</button><button type="button" disabled>API tokens</button><button type="button" disabled>Integrations</button><button type="button" disabled>Monitoring</button></nav>
        <button className="audit-console__workspace-link" type="button" onClick={onClose}><House />Back to workspace</button>
      </aside>

      <section className="audit-console__workspace">
        <header className="audit-console__topbar">
          <div><h1 id="audit-log-title">Forensic Data Grid</h1><p>Account activity and audit records for the Chemistry Representative Mail Studio.</p></div>
          <div className="audit-console__account">
            <time>{formatHeaderDate()}</time>
            <button type="button" className="audit-console__account-button" aria-haspopup="menu" aria-expanded={accountMenuOpen} onClick={() => setAccountMenuOpen((open) => !open)}><span>{initialsFor(user?.name, user?.email)}</span><strong>{user?.name || "Ziwen Mu"}</strong><CaretDown /></button>
            {accountMenuOpen ? <div className="audit-console__account-menu" role="menu"><button type="button" role="menuitem" onClick={onClose}><House />Back to workspace</button><button type="button" role="menuitem" onClick={onLogout} disabled={isLoggingOut}><SignOut />{isLoggingOut ? "Signing out…" : "Sign out"}</button></div> : null}
          </div>
        </header>

        <div className="audit-console__body">
          <section className="audit-presence" aria-labelledby="audit-presence-title">
            <header><h2 id="audit-presence-title">Account presence</h2><span><i />Live · refreshes every 5 seconds</span></header>
            <div className="audit-presence__table" role="table" aria-label="Account presence summary">
              <div className="audit-presence__row audit-presence__row--header" role="row"><span role="columnheader">Account</span><span role="columnheader">Account state</span><span role="columnheader">Active sessions</span><span role="columnheader">Signed-out sessions</span><span role="columnheader">Last seen</span></div>
              {accounts.length ? accounts.map((account) => <div className="audit-presence__row" role="row" key={account.email}>
                <span className="audit-presence__identity" role="cell"><i>{initialsFor(account.name, account.email)}</i><span><strong>{account.name}</strong><small>{account.email}</small></span></span>
                <span role="cell"><StatusBadge value={account.active > 0 ? "online" : "inactive"} /></span><strong role="cell">{account.active}</strong><strong role="cell">{account.signedOut}</strong><span role="cell"><StatusBadge value={account.active > 0 ? "now" : "inactive"} /><small>{formatDate(account.lastSeen)}</small></span>
              </div>) : <p className="audit-console__empty">No account sessions have been recorded.</p>}
            </div>
          </section>

          <form className="audit-filters" onSubmit={applyFilters}>
            <label><span>Saved view</span><select aria-label="Saved view"><option>All activity</option></select></label>
            <label><span>Time range</span><select value={draftFilters.timeRange} onChange={(event) => setDraftFilters((current) => ({ ...current, timeRange: event.target.value }))}><option value="24h">Last 24 hours</option><option value="7d">Last 7 days</option><option value="30d">Last 30 days</option><option value="">All time</option></select></label>
            <label><span>Category</span><select value={draftFilters.category} onChange={(event) => setDraftFilters((current) => ({ ...current, category: event.target.value }))}><option value="">All categories</option>{categories.map((category) => <option value={category} key={category}>{categoryLabel(category)}</option>)}</select></label>
            <label><span>Actor</span><select value={draftFilters.actorEmail} onChange={(event) => setDraftFilters((current) => ({ ...current, actorEmail: event.target.value }))}><option value="">All users</option>{actors.map(([email, name]) => <option value={email} key={email}>{name}</option>)}</select></label>
            <label><span>Status</span><select value={draftFilters.outcome} onChange={(event) => setDraftFilters((current) => ({ ...current, outcome: event.target.value }))}><option value="">All status</option><option value="success">Success</option><option value="failure">Failure</option><option value="denied">Denied</option></select></label>
            <button type="button" className="audit-filters__more" onClick={() => setMoreFiltersOpen((open) => !open)}><FunnelSimple />More filters</button><button type="submit" className="audit-filters__apply">Apply</button>
            {moreFiltersOpen ? <label className="audit-filters__search"><span>Search account, action or email target</span><div><MagnifyingGlass /><input value={draftFilters.query} onChange={(event) => setDraftFilters((current) => ({ ...current, query: event.target.value }))} placeholder="Name, action, Message No. or Archive ID" autoFocus /><button type="button" aria-label="Close search" onClick={() => setMoreFiltersOpen(false)}><X /></button></div></label> : null}
            {Object.values(appliedFilters).some((value) => value && value !== "7d") ? <div className="audit-filters__active"><span>Custom filters applied</span><button type="button" onClick={clearFilters}>Clear all</button></div> : null}
          </form>

          {error ? <p className="audit-console__error" role="alert">{error}</p> : null}
          <div className="audit-grid">
            <section className="audit-grid__events" aria-label="Recorded audit events">
              <div className="audit-grid__scroll"><table><thead><tr><th>Time <ArrowDown /></th><th>Actor</th><th>Category</th><th>Action</th><th>Email target</th><th>Device</th><th>Path</th><th>Status</th><th><span className="sr-only">Inspect</span></th></tr></thead><tbody>
                {data.events.map((event) => { const linkedSession = data.sessions.find((session) => session.id === event.session_id); const eventDevice = linkedSession || (event.client_class ? { client_class: event.client_class } : null); return <tr key={event.id} className={event.id === selectedId ? "is-selected" : ""} onClick={() => selectEvent(event.id)}><td>{formatDate(event.occurred_at)}</td><td>{event.actor_name || event.actor_email}</td><td>{categoryLabel(event.category)}</td><td>{actionLabel(event.action)}</td><td className="audit-grid__target"><code>{emailTarget(event)}</code></td><td>{eventDevice ? deviceLabel(eventDevice) : "—"}</td><td><code>{event.request_path || "—"}</code></td><td><StatusBadge value={event.outcome} /></td><td><button type="button" aria-label={`Inspect ${actionLabel(event.action)}`} onClick={(clickEvent) => { clickEvent.stopPropagation(); selectEvent(event.id); }}><ArrowSquareOut /></button></td></tr>; })}
              </tbody></table>{status === "loading" && !data.events.length ? <p className="audit-console__empty">Loading secure activity records…</p> : null}{!data.events.length && status !== "loading" ? <p className="audit-console__empty">No events match these filters.</p> : null}</div>
              <footer className="audit-grid__pagination"><span>{firstRecord}–{lastRecord} of {data.pagination.total} records</span><span>Rows per page <strong>{PAGE_SIZE}</strong><button type="button" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}><CaretLeft /></button><b>{Math.floor(offset / PAGE_SIZE) + 1}</b><button type="button" disabled={offset + PAGE_SIZE >= data.pagination.total} onClick={() => setOffset(offset + PAGE_SIZE)}><CaretRight /></button></span></footer>
            </section>

            <aside className="audit-inspector" aria-label="Event details" ref={inspectorRef} tabIndex="-1">
              <header><h2>Event details</h2><button type="button" aria-label="Close event details" onClick={() => setSelectedId("")}><X /></button></header>
              {!selected ? <div className="audit-inspector__empty"><h3>Select an event</h3><p>Account, status and technical request details will appear here.</p></div> : <>
                <section className="audit-inspector__summary"><div><StatusBadge value={selected.outcome} /><h3>{actionLabel(selected.action)}</h3><time>{formatDate(selected.occurred_at)}</time></div><ArrowSquareOut /></section>
                <dl className="audit-inspector__fields"><div><dt>Actor</dt><dd>{selected.actor_name || "Name unavailable"}<small>{selected.actor_email}</small></dd></div><div><dt>Category</dt><dd>{categoryLabel(selected.category)}</dd></div><div><dt>Action</dt><dd>{actionLabel(selected.action)}</dd></div><div><dt>Email target</dt><dd><code>{emailTarget(selected)}</code></dd></div><div><dt>Archive ID</dt><dd><code>{selected.metadata?.archiveId || "—"}</code></dd></div><div><dt>Status</dt><dd><StatusBadge value={selected.outcome} /></dd></div><div><dt>Request</dt><dd>{selected.request_method || "—"} {selected.request_path || "—"}</dd></div><div><dt>HTTP status</dt><dd>{selected.http_status || "Not applicable"}</dd></div><div><dt>Role</dt><dd>{selected.actor_role || "Not recorded"}</dd></div><div><dt>Event ID</dt><dd><code>{selected.id}</code></dd></div></dl>
                <section className="audit-inspector__sessions"><header><h3>Session and devices</h3><span><StatusBadge value={selectedAccount?.active > 0 ? "online" : "inactive"} /></span></header><p><span>Active sessions <strong>{selectedAccount?.active || 0}</strong></span><span>Signed-out sessions <strong>{selectedAccount?.signedOut || 0}</strong></span></p><div>{selectedSessions.map((session) => { const state = sessionState(session); const DeviceIcon = session.client_class === "mobile" ? DeviceMobile : Monitor; return <article className={state === "Online" ? "is-online" : ""} key={session.id}><DeviceIcon /><div><strong>{deviceLabel(session)}</strong><small>{state === "Online" ? `Started ${formatDate(session.started_at)}` : `${state} ${formatDate(session.ended_at || session.last_seen_at)}`}</small></div><StatusBadge value={state} /></article>; })}</div></section>
                <section className="audit-inspector__raw"><button type="button" aria-expanded={rawOpen} onClick={() => setRawOpen((open) => !open)}>Raw event data <CaretDown /></button>{rawOpen ? <pre>{JSON.stringify({ ...selected, metadata: selected.metadata || {} }, null, 2)}</pre> : null}</section>
              </>}
            </aside>
          </div>
          <p className="audit-console__privacy">Owner-only audit records · email bodies, subjects, student report content and credentials are never recorded.</p>
        </div>
      </section>
    </main>
  );
}
