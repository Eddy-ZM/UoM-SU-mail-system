import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const verifySource = readFileSync(new URL("../src/VerifyMessage.jsx", import.meta.url), "utf8");

test("the public verification masthead embeds and prioritises the University logo", () => {
  assert.match(verifySource, /university-of-manchester-logo\.png\?inline/);
  assert.match(verifySource, /src=\{universityLogo\}/);
  assert.match(verifySource, /loading="eager"/);
  assert.match(verifySource, /decoding="sync"/);
  assert.match(verifySource, /fetchPriority="high"/);
  assert.doesNotMatch(verifySource, /assets\.manchester\.ac\.uk\/logos/);
});
