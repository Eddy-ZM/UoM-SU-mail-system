import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const appSource = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
const chooserSource = readFileSync(new URL("../src/WorkspaceChooser.jsx", import.meta.url), "utf8");
const archiveSource = readFileSync(new URL("../src/ReportArchive.jsx", import.meta.url), "utf8");
const clientSource = readFileSync(new URL("../src/reportArchiveClient.js", import.meta.url), "utf8");

test("the protected workspace exposes a dedicated student report viewer", () => {
  assert.match(chooserSource, /<strong>Student reports<\/strong>/);
  assert.match(chooserSource, /View submitted reports and follow-up requests\./);
  assert.match(chooserSource, /onOpenReportArchive/);
  assert.match(appSource, /<ReportArchive onClose=\{closeReportArchive\}/);
  assert.match(archiveSource, /CONFIDENTIAL STUDENT SUBMISSIONS/);
});

test("the report viewer reads through distinct protected endpoints", () => {
  assert.match(clientSource, /new URL\("\/api\/report-archive"/);
  assert.match(clientSource, /\/api\/report-archive\/\$\{encodeURIComponent\(reportId\)\}/);
  assert.doesNotMatch(clientSource, /\/api\/reports/);
});

test("the report viewer exposes search, pagination and full record sections", () => {
  assert.match(archiveSource, /Search submitted reports/);
  assert.match(archiveSource, /Page \{pagination\.page\} of \{pagination\.totalPages\}/);
  assert.match(archiveSource, /Issue description/);
  assert.match(archiveSource, /Requested improvement/);
  assert.match(archiveSource, /Contact instruction/);
});

test("authorised representatives can update handling status from the archive", () => {
  assert.match(clientSource, /method: "PATCH"/);
  assert.match(clientSource, /JSON\.stringify\(\{ status \}\)/);
  assert.match(archiveSource, /In progress/);
  assert.match(archiveSource, /Replied/);
  assert.match(archiveSource, /Resolved/);
  assert.match(archiveSource, /statusUpdatedBy/);
});
