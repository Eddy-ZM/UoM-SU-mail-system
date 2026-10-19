import { useEffect, useState } from "react";

const SESSION_KEY = "uom_su_mail_audit_session";
let volatileSessionId = "";

function randomId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `session-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function sessionId() {
  try {
    let value = sessionStorage.getItem(SESSION_KEY);
    if (!value) {
      value = randomId();
      sessionStorage.setItem(SESSION_KEY, value);
    }
    return value;
  } catch {
    if (!volatileSessionId) volatileSessionId = randomId();
    return volatileSessionId;
  }
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

export function recordAuditAction(action, target = {}) {
  try {
    const safeTarget = {};
    if (typeof target.messageNumber === "string") safeTarget.messageNumber = target.messageNumber;
    if (typeof target.archiveId === "string") safeTarget.archiveId = target.archiveId;
    if (typeof target.automatic === "boolean") safeTarget.automatic = target.automatic;
    void post("/api/audit/events", {
      eventId: randomId(),
      sessionId: sessionId(),
      action,
      ...safeTarget,
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
