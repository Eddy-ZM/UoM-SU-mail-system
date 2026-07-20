import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  ACCESS_RESTRICTION_MESSAGE,
  ACCESS_RESTRICTION_TITLE,
  publicPathFromRestriction,
  PUBLIC_ACCESS_RESTRICTION_MESSAGE,
  PUBLIC_ACCESS_RESTRICTION_TITLE,
  shouldBypassRepeatedPublicNotice,
  WORKSPACE_PRE_RELEASE_MESSAGE,
  WORKSPACE_PRE_RELEASE_TITLE,
} from "../shared/service-restriction.js";

const accessGateSource = readFileSync(new URL("../src/AccessGate.jsx", import.meta.url), "utf8");
const mainSource = readFileSync(new URL("../src/main.jsx", import.meta.url), "utf8");
const publicNoticeSource = readFileSync(new URL("../src/PublicAccessNotice.jsx", import.meta.url), "utf8");
const stylesSource = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");

test("restricted access copy explains the pending University approval", () => {
  assert.equal(ACCESS_RESTRICTION_TITLE, "Limited pre-release access");
  assert.equal(PUBLIC_ACCESS_RESTRICTION_TITLE, "Public services remain available");
  assert.match(ACCESS_RESTRICTION_MESSAGE, /Pending approval/);
  assert.match(ACCESS_RESTRICTION_MESSAGE, /University of Manchester Department of Chemistry/);
  assert.match(PUBLIC_ACCESS_RESTRICTION_MESSAGE, /public page remains available/);
  assert.match(accessGateSource, /ACCESS_RESTRICTION_MESSAGE/);
  assert.match(accessGateSource, /Pre-release service notice/);
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

test("all public pages keep their content and show a dismissible modal notice", () => {
  assert.match(mainSource, /<PublicAccessNotice><PrivacyNotice \/><\/PublicAccessNotice>/);
  assert.match(mainSource, /<PublicAccessNotice><VerifyMessage \/><\/PublicAccessNotice>/);
  assert.match(mainSource, /<PublicAccessNotice><ReportIssue \/><\/PublicAccessNotice>/);
  assert.match(publicNoticeSource, /role="dialog"/);
  assert.match(publicNoticeSource, /aria-modal="true"/);
  assert.match(publicNoticeSource, /Acknowledge and continue/);
  assert.match(publicNoticeSource, /Main workspace and archives/);
  assert.match(publicNoticeSource, /value: "Restricted", tone: "restricted"/);
  assert.match(publicNoticeSource, /This public page/);
  assert.match(publicNoticeSource, />Pre-release access<\/span>/);
  assert.doesNotMatch(publicNoticeSource, /Pre-release access position/);
  assert.match(publicNoticeSource, /event\.key === "Escape"/);
});

test("notice keeps the background geometry unchanged while it is open", () => {
  assert.doesNotMatch(publicNoticeSource, /document\.body\.style\.(?:overflow|paddingRight)/);
  assert.match(publicNoticeSource, /focus\(\{ preventScroll: true \}\)/);
  assert.match(stylesSource, /\.public-restriction-backdrop\s*\{[^}]*overflow: auto;[^}]*overscroll-behavior: none;/s);
  assert.match(stylesSource, /\.public-restriction-dialog\s*\{[^}]*overscroll-behavior: contain;/s);
});

test("allowed accounts acknowledge a full-screen pre-release notice before entering the workspace", () => {
  assert.equal(WORKSPACE_PRE_RELEASE_TITLE, "Authorised pre-release access");
  assert.match(WORKSPACE_PRE_RELEASE_MESSAGE, /awaiting approval/);
  assert.match(WORKSPACE_PRE_RELEASE_MESSAGE, /granted pre-release access to all service features/);
  assert.match(mainSource, /<WorkspaceAccessNotice>/);
  assert.match(mainSource, /<App currentUser=\{currentUser\} \/>/);
  assert.match(publicNoticeSource, /Acknowledge and enter workspace/);
  assert.match(publicNoticeSource, /Full workspace/);
  assert.match(publicNoticeSource, /Archive services/);
  assert.match(publicNoticeSource, /Viewing and creation available/);
  assert.match(publicNoticeSource, /Authorised access/);
});

test("public links from the restricted gate suppress the repeated notice once", () => {
  assert.equal(publicPathFromRestriction("/verify/"), "/verify/?restrictionNotice=shown");
  assert.equal(
    publicPathFromRestriction("/agreement/privacy-notice/"),
    "/agreement/privacy-notice/?restrictionNotice=shown",
  );
  assert.equal(shouldBypassRepeatedPublicNotice("?restrictionNotice=shown"), true);
  assert.equal(shouldBypassRepeatedPublicNotice("?restrictionNotice=other"), false);
  assert.match(accessGateSource, /publicPathFromRestriction\("\/verify\/"\)/);
  assert.match(publicNoticeSource, /if \(skipNotice\) return children/);
  assert.match(publicNoticeSource, /window\.history\.replaceState/);
  assert.match(publicNoticeSource, /url\.searchParams\.delete\(RESTRICTION_NOTICE_BYPASS_PARAM\)/);
});
