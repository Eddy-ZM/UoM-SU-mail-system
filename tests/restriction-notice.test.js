import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  ACCESS_RESTRICTION_MESSAGE,
  ACCESS_RESTRICTION_TITLE,
  PUBLIC_ACCESS_RESTRICTION_MESSAGE,
  PUBLIC_ACCESS_RESTRICTION_TITLE,
} from "../shared/service-restriction.js";

const accessGateSource = readFileSync(new URL("../src/AccessGate.jsx", import.meta.url), "utf8");
const mainSource = readFileSync(new URL("../src/main.jsx", import.meta.url), "utf8");
const publicNoticeSource = readFileSync(new URL("../src/PublicAccessNotice.jsx", import.meta.url), "utf8");

test("restricted access copy explains the pending University approval", () => {
  assert.equal(ACCESS_RESTRICTION_TITLE, "Limited pre-release access");
  assert.equal(PUBLIC_ACCESS_RESTRICTION_TITLE, "Public services remain available");
  assert.match(ACCESS_RESTRICTION_MESSAGE, /Pending approval/);
  assert.match(ACCESS_RESTRICTION_MESSAGE, /University of Manchester Department of Chemistry/);
  assert.match(PUBLIC_ACCESS_RESTRICTION_MESSAGE, /public page remains available/);
  assert.match(accessGateSource, /ACCESS_RESTRICTION_MESSAGE/);
  assert.match(accessGateSource, /Pre-release service notice/);
  assert.match(accessGateSource, /Open public verification/);
});

test("both public pages keep their content and show a dismissible modal notice", () => {
  assert.match(mainSource, /<PublicAccessNotice><PrivacyNotice \/><\/PublicAccessNotice>/);
  assert.match(mainSource, /<PublicAccessNotice><VerifyMessage \/><\/PublicAccessNotice>/);
  assert.match(publicNoticeSource, /role="dialog"/);
  assert.match(publicNoticeSource, /aria-modal="true"/);
  assert.match(publicNoticeSource, /Acknowledge and continue/);
  assert.match(publicNoticeSource, /Main workspace and archives/);
  assert.match(publicNoticeSource, /className="is-restricted">Restricted/);
  assert.match(publicNoticeSource, /This public page/);
  assert.match(publicNoticeSource, />Pre-release access<\/span>/);
  assert.doesNotMatch(publicNoticeSource, /Pre-release access position/);
  assert.match(publicNoticeSource, /event\.key === "Escape"/);
});
