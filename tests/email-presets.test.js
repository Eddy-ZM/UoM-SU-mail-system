import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DEFAULT_PRESET_ID, getPresetById } from "../src/emailPresets.js";

const appSource = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");

test("new emails use the questionnaire preset and apply it to the initial template", () => {
  assert.equal(DEFAULT_PRESET_ID, "survey");
  assert.equal(getPresetById(DEFAULT_PRESET_ID).label, "Questionnaire");
  assert.match(appSource, /const initialTemplate = applyEmailPreset\(brandedTemplate, DEFAULT_EMAIL_PRESET\)/);
  assert.match(appSource, /setSubject\(DEFAULT_EMAIL_PRESET\.subject\)/);
});

test("the questionnaire body uses approachable student-facing language", () => {
  const questionnaire = getPresetById("survey");
  assert.equal(questionnaire.content.salutation, "Hi everyone,");
  assert.deepEqual(questionnaire.content.signoff.slice(0, 2), ["Thanks again,", "Your Student Representatives"]);
  assert.match(questionnaire.content.introPrimary, /^We would really like/);
  assert.match(questionnaire.content.summary, /Got a few minutes\?/);
  assert.match(questionnaire.content.followUp, /Thanks for sharing your thoughts/);
  assert.equal(questionnaire.content.buttonLabel, "Share your feedback →");
});
