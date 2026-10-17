CREATE TABLE IF NOT EXISTS audit_sessions (
  id TEXT PRIMARY KEY,
  actor_user_id TEXT NOT NULL,
  actor_email TEXT NOT NULL,
  actor_name TEXT,
  actor_role TEXT,
  started_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  ended_at TEXT,
  end_reason TEXT,
  client_class TEXT NOT NULL DEFAULT 'web'
);

CREATE INDEX IF NOT EXISTS idx_audit_sessions_actor_started
  ON audit_sessions (actor_email, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_sessions_last_seen
  ON audit_sessions (last_seen_at DESC);

CREATE TABLE IF NOT EXISTS audit_events (
  id TEXT PRIMARY KEY,
  session_id TEXT,
  actor_user_id TEXT NOT NULL,
  actor_email TEXT NOT NULL,
  actor_name TEXT,
  actor_role TEXT,
  category TEXT NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  request_method TEXT,
  request_path TEXT,
  http_status INTEGER,
  outcome TEXT NOT NULL CHECK (outcome IN ('success', 'failure', 'denied')),
  metadata_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(metadata_json)),
  occurred_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_events_occurred
  ON audit_events (occurred_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_audit_events_actor
  ON audit_events (actor_email, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_events_action
  ON audit_events (action, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_events_session
  ON audit_events (session_id, occurred_at DESC);

CREATE TRIGGER IF NOT EXISTS audit_events_are_immutable
BEFORE UPDATE ON audit_events
BEGIN
  SELECT RAISE(ABORT, 'audit events are immutable');
END;
