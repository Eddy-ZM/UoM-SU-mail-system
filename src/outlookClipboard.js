const TEXT_NODE = 3;
const ELEMENT_NODE = 1;
const OUTLOOK_BACKGROUND_ELEMENTS = new Set(["TABLE", "TD", "TH"]);

function normaliseOutlookColour(value) {
  const colour = String(value || "").trim().toLowerCase();
  if (!colour || colour === "transparent") return "";

  const shortHex = colour.match(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/i);
  if (shortHex) {
    return `#${shortHex.slice(1).map((part) => `${part}${part}`).join("")}`;
  }
  if (/^#[0-9a-f]{6}$/i.test(colour)) return colour;

  const rgb = colour.match(/^rgba?\(\s*(\d+)\D+(\d+)\D+(\d+)(?:\D+([\d.]+))?\s*\)$/i);
  if (!rgb || (rgb[4] !== undefined && Number(rgb[4]) === 0)) return colour;
  return `#${rgb.slice(1, 4).map((part) => Math.min(255, Number(part)).toString(16).padStart(2, "0")).join("")}`;
}

function materialiseElementColours(element, inheritedColour = "") {
  const inlineColour = element.style?.getPropertyValue("color") || "";
  const hasTransparentColour = inlineColour.trim().toLowerCase() === "transparent";
  const colour = hasTransparentColour
    ? ""
    : normaliseOutlookColour(inlineColour) || inheritedColour;

  if (colour) {
    element.style.setProperty("color", colour);
    if (element.tagName === "FONT") element.setAttribute("color", colour);
  }

  const backgroundColour = normaliseOutlookColour(
    element.style?.getPropertyValue("background-color") || "",
  );
  if (backgroundColour && OUTLOOK_BACKGROUND_ELEMENTS.has(element.tagName)) {
    element.setAttribute("bgcolor", backgroundColour);
  }

  for (const node of [...element.childNodes]) {
    if (node.nodeType === TEXT_NODE) {
      if (!colour || !node.textContent?.trim()) continue;

      // Outlook preserves colour most reliably when it is direct formatting on
      // the text itself. Use both an inline span and the legacy font attribute:
      // Word-based Outlook versions may discard either inherited CSS or one of
      // these representations while converting clipboard HTML.
      const span = element.ownerDocument.createElement("span");
      span.style.setProperty("color", colour);
      const font = element.ownerDocument.createElement("font");
      font.setAttribute("color", colour);
      font.style.setProperty("color", colour);
      node.replaceWith(span);
      span.appendChild(font);
      font.appendChild(node);
      continue;
    }
    if (node.nodeType === ELEMENT_NODE) materialiseElementColours(node, colour);
  }
}

function copyRenderedHtml(bodyHtml) {
  const holder = document.createElement("div");
  holder.innerHTML = bodyHtml;
  holder.setAttribute("contenteditable", "true");
  holder.setAttribute("aria-hidden", "true");
  holder.style.position = "fixed";
  holder.style.left = "-10000px";
  holder.style.top = "0";
  holder.style.width = "800px";
  holder.style.background = "#ffffff";
  document.body.appendChild(holder);

  const previousFocus = document.activeElement;
  const selection = window.getSelection();
  const savedRanges = selection
    ? Array.from({ length: selection.rangeCount }, (_, index) => selection.getRangeAt(index).cloneRange())
    : [];

  try {
    holder.focus({ preventScroll: true });
    const range = document.createRange();
    range.selectNodeContents(holder);
    selection?.removeAllRanges();
    selection?.addRange(range);
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    selection?.removeAllRanges();
    for (const range of savedRanges) selection?.addRange(range);
    holder.remove();
    if (previousFocus instanceof HTMLElement && previousFocus.isConnected) {
      previousFocus.focus({ preventScroll: true });
    }
  }
}

export function prepareOutlookClipboardContent(html) {
  const parsed = new DOMParser().parseFromString(html, "text/html");
  materialiseElementColours(parsed.body);
  return {
    bodyHtml: parsed.body.innerHTML,
    plainText: parsed.body.innerText.replace(/\n{3,}/g, "\n\n").trim(),
  };
}

export async function copyHtmlForOutlook(html) {
  const { bodyHtml, plainText } = prepareOutlookClipboardContent(html);

  // A native selection copy lets Chromium create Windows' formatted HTML
  // clipboard representation, which Outlook consumes more faithfully than a
  // raw fragment written through the asynchronous Clipboard API.
  if (copyRenderedHtml(bodyHtml)) return "native";

  if (window.ClipboardItem && navigator.clipboard?.write) {
    await navigator.clipboard.write([
      new window.ClipboardItem({
        "text/html": new Blob([bodyHtml], { type: "text/html" }),
        "text/plain": new Blob([plainText], { type: "text/plain" }),
      }),
    ]);
    return "async";
  }

  throw new Error("The browser blocked clipboard access.");
}
