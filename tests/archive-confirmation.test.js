import test from "node:test";
import assert from "node:assert/strict";
import { buildArchiveConfirmationDetails } from "../src/archiveConfirmation.js";

test("archive confirmation normalises and retains the critical audit details", () => {
  const details = buildArchiveConfirmationDetails({
    operation: "copy_outlook",
    subject: "  Chemistry student questionnaire  ",
    messageNumber: "CHEM-SR-89ABCDEF",
    filename: "questionnaire.html",
    presetLabel: "Questionnaire",
    moduleLabels: ["Opening copy", "Key points"],
    submittedByName: "Ziwen Mu",
    submittedByEmail: "ZIWEN.MU@CHEMVAULT.SCIENCE",
  });

  assert.equal(details.operationLabel, "Copy for Outlook");
  assert.equal(details.subject, "Chemistry student questionnaire");
  assert.equal(details.submittedByEmail, "ziwen.mu@chemvault.science");
  assert.deepEqual(details.moduleLabels, ["Opening copy", "Key points"]);
  assert.equal(details.ready, true);
  assert.deepEqual(details.issues, []);
});

test("archive confirmation blocks incomplete critical information", () => {
  const details = buildArchiveConfirmationDetails({
    operation: "download_html",
    subject: " ",
    messageNumber: "",
    filename: "",
    submittedByEmail: "",
  });

  assert.equal(details.ready, false);
  assert.equal(details.issues.length, 4);
});
