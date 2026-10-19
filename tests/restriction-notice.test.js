import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  ACCESS_RESTRICTION_MESSAGE,
  ACCESS_RESTRICTION_TITLE,
} from "../shared/service-restriction.js";

const accessGateSource = readFileSync(new URL("../src/AccessGate.jsx", import.meta.url), "utf8");
const mainSource = readFileSync(new URL("../src/main.jsx", import.meta.url), "utf8");

test("an explicit content deny remains a clear account restriction", () => {
  assert.equal(ACCESS_RESTRICTION_TITLE, "Account access restricted");
  assert.match(ACCESS_RESTRICTION_MESSAGE, /not currently permitted/);
  assert.match(ACCESS_RESTRICTION_MESSAGE, /main workspace or archive services/);
  assert.doesNotMatch(ACCESS_RESTRICTION_MESSAGE, /pre-release|pending approval/i);
  assert.match(accessGateSource, /ACCESS_RESTRICTION_MESSAGE/);
  assert.match(accessGateSource, /Account access notice/);
  assert.match(accessGateSource, /Restricted access/);
  assert.match(accessGateSource, /Open public verification/);
  assert.match(accessGateSource, /<form method="post" action="\/api\/access\/logout">/);
  assert.match(accessGateSource, /<button type="submit">Sign out<\/button>/);
});

test("access verification uses only a minimal animation while the check is in progress", () => {
  assert.match(accessGateSource, /if \(isBusy\)/);
  assert.match(accessGateSource, /className="access-checking"/);
  assert.match(accessGateSource, /className="access-checking-indicator"/);
  assert.match(accessGateSource, /aria-label="Verifying access"/);
  assert.doesNotMatch(accessGateSource, /Checking your access/);
  assert.doesNotMatch(accessGateSource, /Redirecting to sign in/);
});

test("public services open directly without a pre-release acknowledgement", () => {
  assert.match(mainSource, /\? <PrivacyNotice \/>/);
  assert.match(mainSource, /\? <VerifyMessage \/>/);
  assert.match(mainSource, /\? <ReportIssue \/>/);
  assert.match(mainSource, /\? <DuplicateSubmission \/>/);
  assert.doesNotMatch(mainSource, /PublicAccessNotice/);
  assert.doesNotMatch(mainSource, /pre-release/i);
});

test("an allowed account enters the workspace without a pre-release acknowledgement", () => {
  assert.match(mainSource, /\{\(currentUser\) => <App currentUser=\{currentUser\} \/>\}/);
  assert.doesNotMatch(mainSource, /WorkspaceAccessNotice/);
  assert.doesNotMatch(mainSource, /pre-release/i);
});

test("restricted-account links open public services directly", () => {
  assert.match(accessGateSource, /href="\/verify\/"/);
  assert.match(accessGateSource, /href="\/agreement\/privacy-notice\/"/);
  assert.doesNotMatch(accessGateSource, /restrictionNotice/);
  assert.doesNotMatch(accessGateSource, /publicPathFromRestriction/);
});
