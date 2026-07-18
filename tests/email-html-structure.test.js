import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { hasCompleteEmailDocumentStructure } from "../src/emailUtils.js";

const template = readFileSync(new URL("../src/templates/student-union-announcement.html", import.meta.url), "utf8");

test("the production email template has a complete balanced document structure", () => {
  assert.equal(hasCompleteEmailDocumentStructure(template), true);
});

test("missing, duplicated or crossed structural tags are rejected", () => {
  assert.equal(hasCompleteEmailDocumentStructure(template.replace("</body>", "")), false);
  assert.equal(hasCompleteEmailDocumentStructure(template.replace("<body ", "<body><body ")), false);
  assert.equal(hasCompleteEmailDocumentStructure(template.replace("</td></tr>", "</tr></td>")), false);
  assert.equal(hasCompleteEmailDocumentStructure(template.replace("</table>", "")), false);
});
