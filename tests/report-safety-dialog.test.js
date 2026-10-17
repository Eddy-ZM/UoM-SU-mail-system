import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const reportSource = readFileSync(new URL("../src/ReportIssue.jsx", import.meta.url), "utf8");
const reportStyles = readFileSync(new URL("../src/report-issue.css", import.meta.url), "utf8");

test("the report page opens with a mandatory urgent-help alert dialog", () => {
  assert.match(reportSource, /useState\(true\)/);
  assert.match(reportSource, /role="alertdialog"/);
  assert.match(reportSource, /aria-modal="true"/);
  assert.match(reportSource, /This is not an emergency service\./);
  assert.match(reportSource, /I understand — continue to the report form/);
  assert.match(reportSource, /inert=\{urgentHelpOpen \? "" : undefined\}/);
});

test("the safety dialog keeps both support routes and can be reopened", () => {
  assert.match(reportSource, /studentsupport\.manchester\.ac\.uk\/taking-care\/emergency/);
  assert.match(reportSource, /reportandsupport\.manchester\.ac\.uk/);
  assert.match(reportSource, /View support options/);
  assert.match(reportSource, /event\.key === "Escape"/);
  assert.doesNotMatch(reportSource, /report-safety-overlay[^>]*onClick=/);
});

test("the safety overlay contains its own scrolling without changing root page geometry", () => {
  assert.match(reportStyles, /\.report-safety-overlay\s*\{[^}]*position:\s*fixed;[^}]*overflow-y:\s*auto;[^}]*overscroll-behavior:\s*contain;/s);
  assert.doesNotMatch(reportSource, /document\.body\.style\.overflow/);
});
