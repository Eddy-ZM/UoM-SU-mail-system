import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("the public duplicate-submission page gives a clear non-collection notice", async () => {
  const [page, main] = await Promise.all([
    readFile(new URL("../src/DuplicateSubmission.jsx", import.meta.url), "utf8"),
    readFile(new URL("../src/main.jsx", import.meta.url), "utf8"),
  ]);
  assert.match(main, /\/questionnaire\/already-submitted/);
  assert.match(main, /<DuplicateSubmission \/>/);
  assert.match(page, /This questionnaire has already been submitted/);
  assert.match(page, /No further submission is required/);
  assert.match(page, /does not change or replace your earlier response/);
  assert.match(page, /does not collect questionnaire answers/);
  assert.match(page, /Contact the team/);
  assert.doesNotMatch(page, /Privacy notice|agreement\/privacy-notice/i);
  assert.match(page, /questionnaire-complete-links/);
  assert.match(page, />Close<\/button>/);
  assert.match(page, /window\.close\(\)/);
  assert.match(page, /You can close it manually/);
  assert.match(page, /Technical support provided by Ziwen M\./);
  assert.match(page, /CheckCircle/);
  assert.doesNotMatch(page, /<img/i);
  assert.doesNotMatch(page, /<form/i);
  assert.doesNotMatch(page, /returnTo/);
});
