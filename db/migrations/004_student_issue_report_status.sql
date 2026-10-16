ALTER TABLE student_issue_reports
ADD COLUMN status TEXT NOT NULL DEFAULT 'new'
CHECK (status IN ('new', 'in-progress', 'replied', 'resolved'));

ALTER TABLE student_issue_reports
ADD COLUMN status_updated_at TEXT;

ALTER TABLE student_issue_reports
ADD COLUMN status_updated_by_user_id TEXT;

ALTER TABLE student_issue_reports
ADD COLUMN status_updated_by_name TEXT;

ALTER TABLE student_issue_reports
ADD COLUMN status_updated_by_email TEXT;

ALTER TABLE student_issue_reports
ADD COLUMN status_updated_by_role TEXT;

CREATE INDEX IF NOT EXISTS idx_student_issue_reports_status_created_at
ON student_issue_reports(status, created_at DESC);
