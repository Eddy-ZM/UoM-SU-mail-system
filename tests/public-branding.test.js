import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const verifySource = readFileSync(new URL("../src/VerifyMessage.jsx", import.meta.url), "utf8");
const privacySource = readFileSync(new URL("../src/PrivacyNotice.jsx", import.meta.url), "utf8");

test("public pages use the text-only department identity without a University logo", () => {
  for (const source of [verifySource, privacySource]) {
    assert.match(source, /Department of Chemistry Student Representatives/);
    assert.doesNotMatch(source, /universityLogo|university-of-manchester-logo|assets\.manchester\.ac\.uk\/logos/);
  }
});
