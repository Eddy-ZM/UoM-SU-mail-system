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
  assert.match(page, /Survey reference<\/dt><dd>2610281/);
  assert.match(page, /Response received/);
  assert.match(page, /Information collected here<\/dt><dd>None/);
  assert.match(page, /Contact the team/);
  assert.match(page, /Privacy Notice/);
  assert.doesNotMatch(page, /CHEM-SR-|Verification code/i);
  assert.doesNotMatch(page, /<img|<form|returnTo/i);
});
