import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const verifySource = readFileSync(new URL("../src/VerifyMessage.jsx", import.meta.url), "utf8");
const privacySource = readFileSync(new URL("../src/PrivacyNotice.jsx", import.meta.url), "utf8");
const appSource = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
const emailTemplate = readFileSync(new URL("../src/templates/student-union-announcement.html", import.meta.url), "utf8");

test("public pages use the text-only department identity without a University logo", () => {
  for (const source of [verifySource, privacySource]) {
    assert.match(source, /Department of Chemistry Student Representatives/);
    assert.doesNotMatch(source, /universityLogo|university-of-manchester-logo|assets\.manchester\.ac\.uk\/logos/);
  }
});

test("the editor resolves the email-only logo to an absolute export URL", () => {
  assert.match(appSource, /import universityLogoUrl from "\.\/assets\/university-of-manchester-logo\.png\?no-inline"/);
  assert.match(appSource, /new URL\(universityLogoUrl, window\.location\.origin\)\.href/);
});

test("public-facing email links use the canonical service domain", () => {
  assert.match(emailTemplate, /https:\/\/mailsys\.uomsu\.chemvault\.science\/verify\//);
  assert.doesNotMatch(emailTemplate, /uom-su-mail-system\.pages\.dev/);
});
