CREATE TABLE IF NOT EXISTS email_archives (
  id TEXT PRIMARY KEY NOT NULL,
  message_number TEXT NOT NULL CHECK (length(message_number) = 16 AND message_number GLOB 'CHEM-SR-[0-9A-F][0-9A-F][0-9A-F][0-9A-F][0-9A-F][0-9A-F][0-9A-F][0-9A-F]'),
  sha256 TEXT NOT NULL CHECK (length(sha256) = 64 AND sha256 NOT GLOB '*[^0-9A-F]*'),
  verification_code TEXT NOT NULL CHECK (verification_code GLOB '[0-9A-F][0-9A-F][0-9A-F][0-9A-F]-[0-9A-F][0-9A-F][0-9A-F][0-9A-F]-[0-9A-F][0-9A-F][0-9A-F][0-9A-F]-[0-9A-F][0-9A-F][0-9A-F][0-9A-F]'),
  operation TEXT NOT NULL CHECK (operation IN ('copy_html', 'copy_outlook', 'download_html')),
  subject TEXT NOT NULL,
  filename TEXT NOT NULL,
  html TEXT NOT NULL,
  document_json TEXT NOT NULL CHECK (json_valid(document_json)),
  submitted_by_user_id TEXT NOT NULL,
  submitted_by_email TEXT NOT NULL,
  submitted_by_role TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_email_archives_message_number ON email_archives(message_number);
CREATE INDEX IF NOT EXISTS idx_email_archives_sha256 ON email_archives(sha256);
CREATE INDEX IF NOT EXISTS idx_email_archives_verification ON email_archives(message_number, verification_code);
CREATE INDEX IF NOT EXISTS idx_email_archives_created_at ON email_archives(created_at DESC);

CREATE TRIGGER IF NOT EXISTS email_archives_are_immutable
BEFORE UPDATE ON email_archives
BEGIN
  SELECT RAISE(ABORT, 'email archives are immutable');
END;
