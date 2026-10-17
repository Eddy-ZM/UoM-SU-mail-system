import { useEffect, useState } from "react";

const SESSION_KEY = "uom_su_mail_audit_session";

function sessionId() {
  let value = sessionStorage.getItem(SESSION_KEY);
  if (!value) {
    value = crypto.randomUUID();
    sessionStorage.setItem(SESSION_KEY, value);
  }
  return value;
}

async function post(path, body, keepalive = false) {
  return fetch(path, {
    method: "POST",
    credentials: "same-origin",
    cache: "no-store",
    keepalive,
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify(body),
  });
}

export function useAuditSession() {
  useEffect(() => {
    const id = sessionId();
    const heartbeat = () => {
      if (document.visibilityState === "visible") void post("/api/audit/session", { sessionId: id, state: "online" }).catch(() => undefined);
    };
    heartbeat();
    const timer = window.setInterval(heartbeat, 60_000);
    document.addEventListener("visibilitychange", heartbeat);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", heartbeat);
    };
  }, []);
}

export function recordAuditAction(action) {
  try {
    void post("/api/audit/events", {
      eventId: crypto.randomUUID(),
      sessionId: sessionId(),
      action,
    }, true).catch(() => undefined);
  } catch {
    // Audit telemetry is deliberately non-blocking.
  }
}

export function currentAuditSessionId() {
  try { return sessionId(); } catch { return ""; }
}

export function useMobileEditorBlocked() {
  const query = "(max-width: 760px)";
  const [blocked, setBlocked] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const media = window.matchMedia(query);
    const update = () => setBlocked(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return blocked;
}
