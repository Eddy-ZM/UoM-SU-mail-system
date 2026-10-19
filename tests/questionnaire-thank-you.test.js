import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("the public questionnaire ending thanks students without collecting another response", async () => {
  const [page, main] = await Promise.all([
    readFile(new URL("../src/QuestionnaireThankYou.jsx", import.meta.url), "utf8"),
    readFile(new URL("../src/main.jsx", import.meta.url), "utf8"),
  ]);
  assert.match(main, /\/questionnaire\/thank-you/);
  assert.match(main, /<QuestionnaireThankYou \/>/);
  assert.match(page, /Thank you for your feedback/);
  assert.match(page, /Year 2 Chemistry Student Voice Survey/);
  assert.match(page, /Survey reference 2610281/);
  assert.match(page, /Your response has been recorded/);
  assert.match(page, /Contact the team/);
  assert.match(page, /Privacy notice/);
  assert.match(page, /questionnaire-complete-links/);
  assert.match(page, />Close<\/button>/);
  assert.match(page, /window\.close\(\)/);
  assert.match(page, /You can close it manually/);
  assert.match(page, /Technical support provided by Ziwen M\./);
  assert.match(page, /CheckCircle/);
  assert.doesNotMatch(page, /CHEM-SR-|Verification code/i);
  assert.doesNotMatch(page, /<img|<form|returnTo/i);
});
