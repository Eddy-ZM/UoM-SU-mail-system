DROP TRIGGER IF EXISTS email_archives_are_immutable;

ALTER TABLE email_archives RENAME TO email_archives_legacy;

CREATE TABLE email_archives (
  id TEXT PRIMARY KEY NOT NULL,
  message_number TEXT NOT NULL CHECK (
    length(message_number) = 16
    AND substr(message_number, 1, 8) = 'CHEM-SR-'
    AND substr(message_number, 9, 8) NOT GLOB '*[^0-9A-F]*'
  ),
  sha256 TEXT NOT NULL CHECK (
    length(sha256) = 64
    AND sha256 NOT GLOB '*[^0-9A-F]*'
  ),
  verification_code TEXT NOT NULL CHECK (
    length(verification_code) = 19
    AND substr(verification_code, 5, 1) = '-'
    AND substr(verification_code, 10, 1) = '-'
    AND substr(verification_code, 15, 1) = '-'
    AND length(replace(verification_code, '-', '')) = 16
    AND replace(verification_code, '-', '') NOT GLOB '*[^0-9A-F]*'
  ),
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

INSERT INTO email_archives (
  id, message_number, sha256, verification_code, operation, subject, filename, html, document_json,
  submitted_by_user_id, submitted_by_email, submitted_by_role, created_at
)
SELECT
  id, message_number, sha256, verification_code, operation, subject, filename, html, document_json,
  submitted_by_user_id, submitted_by_email, submitted_by_role, created_at
FROM email_archives_legacy;

DROP TABLE email_archives_legacy;

CREATE INDEX idx_email_archives_message_number ON email_archives(message_number);
CREATE INDEX idx_email_archives_sha256 ON email_archives(sha256);
CREATE INDEX idx_email_archives_verification ON email_archives(message_number, verification_code);
CREATE INDEX idx_email_archives_created_at ON email_archives(created_at DESC);

CREATE TRIGGER email_archives_are_immutable
BEFORE UPDATE ON email_archives
BEGIN
  SELECT RAISE(ABORT, 'email archives are immutable');
END;
