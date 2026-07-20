const TEXT_NODE = 3;
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
    element.style.setProperty("color", colour, "important");
  }

  const backgroundColour = normaliseOutlookColour(
    element.style?.getPropertyValue("background-color") || "",
  );
  if (backgroundColour && OUTLOOK_BACKGROUND_ELEMENTS.has(element.tagName)) {
    element.setAttribute("bgcolor", backgroundColour);
  }

  for (const node of [...element.childNodes]) {
    if (node.nodeType === TEXT_NODE) {
      if (!colour || !node.textContent?.trim() || element.tagName === "FONT") continue;
      // Outlook Classic uses Word's HTML engine, so retain the legacy colour
      // attribute as a fallback when pasted content loses inherited CSS.
      const font = element.ownerDocument.createElement("font");
      font.setAttribute("color", colour);
      font.style.setProperty("color", colour, "important");
      node.replaceWith(font);
      font.appendChild(node);
      continue;
    }
    if (node.nodeType === 1) materialiseElementColours(node, colour);
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

  if (window.ClipboardItem && navigator.clipboard?.write) {
    await navigator.clipboard.write([
      new window.ClipboardItem({
        "text/html": new Blob([bodyHtml], { type: "text/html" }),
        "text/plain": new Blob([plainText], { type: "text/plain" }),
      }),
    ]);
    return;
  }

  const holder = document.createElement("div");
  holder.innerHTML = bodyHtml;
  holder.style.position = "fixed";
  holder.style.left = "-9999px";
  document.body.appendChild(holder);
  try {
    const range = document.createRange();
    range.selectNodeContents(holder);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    const copied = document.execCommand("copy");
    selection.removeAllRanges();
    if (!copied) throw new Error("The browser blocked clipboard access.");
  } finally {
    holder.remove();
  }
}
