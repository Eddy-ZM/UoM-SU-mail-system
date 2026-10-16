import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const outlookClipboardSource = readFileSync(
  new URL("../src/outlookClipboard.js", import.meta.url),
  "utf8",
);
const appSource = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
const archivePanelSource = readFileSync(new URL("../src/ArchivePanel.jsx", import.meta.url), "utf8");
const workspaceChooserSource = readFileSync(
  new URL("../src/WorkspaceChooser.jsx", import.meta.url),
  "utf8",
);

test("both Outlook copy paths use the shared colour-safe clipboard writer", () => {
  assert.match(appSource, /import \{ copyHtmlForOutlook \} from "\.\/outlookClipboard\.js"/);
  assert.match(appSource, /const copyArchivedForOutlook = useCallback/);
  assert.match(appSource, /await copyHtmlForOutlook\(html\)/);
  assert.match(archivePanelSource, /import \{ copyHtmlForOutlook \} from "\.\/outlookClipboard\.js"/);
  assert.match(archivePanelSource, /copyHtmlForOutlook\(selected\.html\)/);
});

test("the main archive flow requires a fresh user click before Outlook copy", () => {
  assert.match(appSource, /Select Copy to Outlook on the receipt/);
  assert.match(appSource, /onCopyOutlook=\{copyArchivedForOutlook\}/);
  assert.match(workspaceChooserSource, /outlookCopyReady/);
  assert.match(workspaceChooserSource, /onClick=\{onCopyOutlook\}>Copy to Outlook<\/button>/);
});

test("the Outlook clipboard fragment materialises text and background colours", () => {
  assert.match(outlookClipboardSource, /createElement\("span"\)/);
  assert.match(outlookClipboardSource, /INHERITED_TEXT_PROPERTIES/);
  assert.match(outlookClipboardSource, /"font-size"/);
  assert.match(outlookClipboardSource, /"line-height"/);
  assert.match(outlookClipboardSource, /span\.style\.setProperty\(property, presentation\[property\]\)/);
  assert.match(outlookClipboardSource, /font\.setAttribute\("color", colour\)/);
  assert.match(outlookClipboardSource, /font\.style\.setProperty\(property, presentation\[property\]\)/);
  assert.match(outlookClipboardSource, /font\.setAttribute\("face", presentation\["font-family"\]\)/);
  assert.match(outlookClipboardSource, /element\.setAttribute\("bgcolor", backgroundColour\)/);
  assert.match(outlookClipboardSource, /"text\/html": new Blob\(\[bodyHtml\]/);
  assert.match(outlookClipboardSource, /"text\/plain": new Blob\(\[plainText\]/);
});

test("Outlook copy isolates the materialised fragment before native selection copy", () => {
  assert.match(outlookClipboardSource, /holder\.style\.all = "initial"/);
  assert.match(outlookClipboardSource, /holder\.style\.contain = "layout paint style"/);
  assert.match(outlookClipboardSource, /function copyRenderedHtml\(bodyHtml\)/);
  assert.match(outlookClipboardSource, /range\.selectNodeContents\(holder\)/);
  assert.match(outlookClipboardSource, /if \(copyRenderedHtml\(bodyHtml\)\) return "native";/);
  assert.ok(
    outlookClipboardSource.indexOf("copyRenderedHtml(bodyHtml)")
      < outlookClipboardSource.indexOf("navigator.clipboard?.write"),
  );
});
