import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildOutlookDraft } from "../src/outlookDraft.js";

function decodeBase64(value) {
  return Buffer.from(value.replace(/\r\n/g, ""), "base64").toString("utf8");
}

test("an Outlook draft opens as an unsent editable HTML message", () => {
  const html = "<!doctype html><html><body><p>Hello Manchester</p></body></html>";
  const draft = buildOutlookDraft({
    html,
    subject: "Questionnaire – autumn term",
    messageNumber: "CHEM-SR-A1B2C3D4",
  });

  const [headers, encodedBody] = draft.content.split("\r\n\r\n");
  assert.match(headers, /^X-Unsent: 1\r\nTo:\r\n/);
  assert.match(headers, /Content-Type: text\/html; charset=UTF-8/);
  assert.match(headers, /Content-Transfer-Encoding: base64/);
  const encodedSubject = headers.match(/Subject: =\?UTF-8\?B\?([^?]+)\?=/)?.[1];
  assert.equal(Buffer.from(encodedSubject, "base64").toString("utf8"), "Questionnaire – autumn term");
  assert.equal(decodeBase64(encodedBody), html);
  assert.ok(encodedBody.trimEnd().split("\r\n").every((line) => line.length <= 76));
  assert.equal(draft.filename, "CHEM-SR-A1B2C3D4.eml");
});

test("draft headers cannot be extended through the subject or filename", () => {
  const draft = buildOutlookDraft({
    html: "<html><body>Safe</body></html>",
    subject: "Student update\r\nBcc: attacker@example.test",
    messageNumber: "CHEM-SR-A1/B2",
  });

  const headers = draft.content.split("\r\n\r\n")[0];
  assert.doesNotMatch(headers, /\r\nBcc:/);
  assert.equal(draft.filename, "CHEM-SR-A1B2.eml");
});

test("the archive receipt explains Graph draft creation and keeps manual fallbacks", () => {
  const source = readFileSync(new URL("../src/WorkspaceChooser.jsx", import.meta.url), "utf8");
  assert.match(source, /<dt>Subject<\/dt>/);
  assert.match(source, /has been downloaded automatically/);
  assert.match(source, /Create Outlook draft/);
  assert.match(source, /Download \.eml backup/);
  assert.match(source, /Download \.eml again/);
  assert.match(source, />Copy to Outlook<\/button>/);
  assert.match(source, /onAutoDownloadOutlook\(\)/);
});
