CREATE TABLE IF NOT EXISTS student_issue_reports (
  id TEXT PRIMARY KEY NOT NULL,
  reference TEXT UNIQUE NOT NULL CHECK (
    length(reference) = 20
    AND substr(reference, 1, 12) = 'CHEM-SR-RPT-'
    AND substr(reference, 13, 8) NOT GLOB '*[^0-9A-F]*'
  ),
  category TEXT NOT NULL CHECK (category IN (
    'teaching', 'assessment', 'laboratory', 'facilities', 'accessibility', 'student-support', 'conduct', 'other'
  )),
  summary TEXT NOT NULL CHECK (length(summary) BETWEEN 5 AND 120),
  details TEXT NOT NULL CHECK (length(details) BETWEEN 20 AND 3000),
  desired_outcome TEXT CHECK (desired_outcome IS NULL OR length(desired_outcome) <= 1200),
  study_stage TEXT CHECK (study_stage IS NULL OR study_stage IN (
    'undergraduate', 'postgraduate-taught', 'postgraduate-research', 'other'
  )),
  course_context TEXT CHECK (course_context IS NULL OR length(course_context) <= 120),
  impact TEXT NOT NULL CHECK (impact IN ('limited', 'moderate', 'significant')),
  contact_requested INTEGER NOT NULL CHECK (contact_requested IN (0, 1)),
  contact_email TEXT,
  created_at TEXT NOT NULL,
  CHECK (
    (contact_requested = 0 AND contact_email IS NULL)
    OR (contact_requested = 1 AND contact_email IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_student_issue_reports_created_at ON student_issue_reports(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_student_issue_reports_category ON student_issue_reports(category, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_student_issue_reports_impact ON student_issue_reports(impact, created_at DESC);
