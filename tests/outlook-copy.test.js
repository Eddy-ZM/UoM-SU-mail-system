import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const outlookClipboardSource = readFileSync(
  new URL("../src/outlookClipboard.js", import.meta.url),
  "utf8",
);
const appSource = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
const archivePanelSource = readFileSync(new URL("../src/ArchivePanel.jsx", import.meta.url), "utf8");

test("both Outlook copy paths use the shared colour-safe clipboard writer", () => {
  assert.match(appSource, /import \{ copyHtmlForOutlook \} from "\.\/outlookClipboard\.js"/);
  assert.match(appSource, /await copyHtmlForOutlook\(archived\.html\)/);
  assert.match(archivePanelSource, /import \{ copyHtmlForOutlook \} from "\.\/outlookClipboard\.js"/);
  assert.match(archivePanelSource, /copyHtmlForOutlook\(selected\.html\)/);
});

test("the Outlook clipboard fragment materialises text and background colours", () => {
  assert.match(outlookClipboardSource, /font\.setAttribute\("color", colour\)/);
  assert.match(outlookClipboardSource, /font\.style\.setProperty\("color", colour, "important"\)/);
  assert.match(outlookClipboardSource, /element\.setAttribute\("bgcolor", backgroundColour\)/);
  assert.match(outlookClipboardSource, /"text\/html": new Blob\(\[bodyHtml\]/);
  assert.match(outlookClipboardSource, /"text\/plain": new Blob\(\[plainText\]/);
});
