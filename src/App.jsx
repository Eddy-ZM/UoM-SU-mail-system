import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import initialTemplate from "./templates/student-union-announcement.html?raw";
import {
  CONTENT_BLOCK_TYPES,
  EMAIL_MODULES,
  PROTECTED_SECTIONS,
  addContentBlock,
  applyEmailPreset,
  cleanEmailHtml,
  ensureHiddenCredit,
  getEmailMetadata,
  getEmailModules,
  getProtectedContentIssues,
  isUsableEmailHtml,
  normaliseContactNames,
  removeContentBlock,
  repositionContentBlock,
  restoreProtectedContent,
  serializeEmailDocument,
  updateEmailMetadata,
  updateEmailModules,
} from "./emailUtils.js";
import { DEFAULT_PRESET_ID, EMAIL_PRESETS, getPresetById } from "./emailPresets.js";
import { ArchivePanel } from "./ArchivePanel.jsx";
import { archiveEmailExport } from "./archiveClient.js";
import {
  ensureMessageNumber,
  extractVerificationCode,
  markVerificationCodePending,
  prepareEmailForArchive,
  setVerificationCode,
} from "../shared/email-integrity.js";

const STORAGE_KEY = "student-union-mail-studio:v6";

const FONT_FAMILIES = ["Arial", "Verdana", "Tahoma", "Georgia", "Times New Roman"];
const FONT_SIZES = [12, 14, 16, 18, 22, 28, 34];
const DEFAULT_ACTIVE_FORMATS = { bold: false, italic: false, underline: false, alignment: "left" };

function commandState(doc, command) {
  try {
    return doc.queryCommandState(command);
  } catch {
    return false;
  }
}

function cssColourToHex(value, fallback = "#2b2430") {
  if (/^#[0-9a-f]{6}$/i.test(value || "")) return value.toLowerCase();
  const match = String(value || "").match(/rgba?\(\s*(\d+)\D+(\d+)\D+(\d+)/i);
  if (!match) return fallback;
  return `#${match.slice(1, 4).map((part) => Number(part).toString(16).padStart(2, "0")).join("")}`;
}

function readSelectionFormatting(doc, range) {
  const node = range.startContainer.nodeType === doc.defaultView.Node.ELEMENT_NODE
    ? range.startContainer
    : range.startContainer.parentElement;
  const element = node?.closest?.("[data-mail-studio-editable]") ? node : node?.parentElement;
  const computed = element ? doc.defaultView.getComputedStyle(element) : null;
  const fontWeight = Number.parseInt(computed?.fontWeight || "400", 10);
  const fontStyle = computed?.fontStyle || "normal";
  const decoration = computed?.textDecorationLine || computed?.textDecoration || "";
  const textAlign = computed?.textAlign || "left";
  const familyValue = computed?.fontFamily || "";
  const family = FONT_FAMILIES.find((font) => familyValue.toLowerCase().includes(font.toLowerCase())) || "Arial";
  const size = Math.round(Number.parseFloat(computed?.fontSize || "16"));
  const alignment = commandState(doc, "justifyCenter") || textAlign === "center"
    ? "center"
    : commandState(doc, "justifyRight") || textAlign === "right" || textAlign === "end"
      ? "right"
      : "left";

  return {
    bold: commandState(doc, "bold") || fontWeight >= 600 || computed?.fontWeight === "bold",
    italic: commandState(doc, "italic") || fontStyle === "italic" || fontStyle === "oblique",
    underline: commandState(doc, "underline") || decoration.includes("underline"),
    alignment,
    fontFamily: family,
    fontSize: String(Number.isFinite(size) ? size : 16),
    textColor: cssColourToHex(computed?.color),
  };
}

const EDITABLE_REGIONS = [
  { selector: ".publication-date", label: "Publication date" },
  { selector: ".category", label: "Announcement category" },
  { selector: ".headline", label: "Announcement title" },
  { selector: ".summary", label: "Announcement summary" },
  { selector: ".fact-label", label: "Information label" },
  { selector: ".fact-value", label: "Information value" },
  { selector: ".email-shell > tbody > tr:nth-child(5) > td > p", label: "Announcement paragraph" },
  { selector: ".key-points-heading", label: "Section heading" },
  { selector: ".key-point-row td:nth-child(2)", label: "Action item" },
  { selector: ".button-link", label: "Call-to-action label" },
  { selector: ".email-shell > tbody > tr:nth-child(6) > td > div", label: "Contact information" },
  { selector: '[data-content-block]:not([data-content-block-core="true"])[data-block-editable], [data-content-block]:not([data-content-block-core="true"]) [data-block-editable]', label: "Custom component text" },
];

function readSavedDraft() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (saved && isUsableEmailHtml(saved.html)) {
      const restored = getProtectedContentIssues(saved.html).length > 0
        ? restoreProtectedContent(saved.html, initialTemplate)
        : saved.html;
      const identified = ensureMessageNumber(restored);
      return {
        html: ensureHiddenCredit(normaliseContactNames(identified.html)),
        subject: saved.subject || "Department of Chemistry Student Representatives | Student Feedback Forum",
        filename: saved.filename || "manchester-chemistry-student-feedback-forum.html",
        preset: saved.preset || DEFAULT_PRESET_ID,
      };
    }
  } catch {
    // A corrupt or unavailable local draft should never block the editor.
  }

  const identified = ensureMessageNumber(initialTemplate, { forceNew: true });
  return {
    html: identified.html,
    subject: "Department of Chemistry Student Representatives | Student Feedback Forum",
    filename: "manchester-chemistry-student-feedback-forum.html",
    preset: DEFAULT_PRESET_ID,
  };
}

function normaliseFilename(value) {
  const cleaned = value.trim().replace(/[<>:"/\\|?*]+/g, "-") || "manchester-chemistry-student-announcement";
  return cleaned.toLowerCase().endsWith(".html") ? cleaned : `${cleaned}.html`;
}

function AppButton({ className = "", children, ...props }) {
  return (
    <button className={`app-button ${className}`.trim()} type="button" {...props}>
      {children}
    </button>
  );
}

export function App() {
  const initialDraft = useMemo(readSavedDraft, []);
  const [html, setHtml] = useState(initialDraft.html);
  const [previewHtml, setPreviewHtml] = useState(initialDraft.html);
  const [subject, setSubject] = useState(initialDraft.subject);
  const [filename, setFilename] = useState(initialDraft.filename);
  const [activePreset, setActivePreset] = useState(initialDraft.preset);
  const [previewMode, setPreviewMode] = useState("desktop");
  const [saveState, setSaveState] = useState("Saved locally");
  const [syncState, setSyncState] = useState("Visual and HTML are in sync");
  const [notice, setNotice] = useState("");
  const [codeError, setCodeError] = useState("");
  const [formatTargetReady, setFormatTargetReady] = useState(false);
  const [fontFamily, setFontFamily] = useState("Arial");
  const [fontSize, setFontSize] = useState("16");
  const [textColor, setTextColor] = useState("#2b2430");
  const [activeFormats, setActiveFormats] = useState(DEFAULT_ACTIVE_FORMATS);
  const [currentTime, setCurrentTime] = useState(() => new Date());
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [exportBusy, setExportBusy] = useState("");
  const iframeRef = useRef(null);
  const savedSelectionRef = useRef(null);
  const paletteDragTypeRef = useRef(null);
  const updateOrigin = useRef("initial");
  const noticeTimer = useRef(null);

  const metadata = useMemo(() => getEmailMetadata(html), [html]);
  const modules = useMemo(() => getEmailModules(html), [html]);
  const protectionIssues = useMemo(() => getProtectedContentIssues(html), [html]);
  const availableFontSizes = useMemo(() => {
    const selectedSize = Number(fontSize);
    return [...new Set([...FONT_SIZES, selectedSize])].filter(Number.isFinite).sort((a, b) => a - b);
  }, [fontSize]);
  const liveTime = useMemo(() => new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZoneName: "short",
  }).format(currentTime), [currentTime]);

  const showNotice = useCallback((message) => {
    window.clearTimeout(noticeTimer.current);
    setNotice(message);
    noticeTimer.current = window.setTimeout(() => setNotice(""), 2800);
  }, []);

  useEffect(() => () => window.clearTimeout(noticeTimer.current), []);

  useEffect(() => {
    const timer = window.setInterval(() => setCurrentTime(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      let embedded;
      try {
        embedded = extractVerificationCode(html);
      } catch {
        return;
      }
      try {
        const current = await prepareEmailForArchive(cleanEmailHtml(html));
        if (cancelled || current.verificationCode === embedded) return;
        const pending = markVerificationCodePending(html);
        updateOrigin.current = "integrity-stale";
        setHtml(pending);
        setPreviewHtml(pending);
        setSyncState("Message changed; the verification code will be regenerated on export");
      } catch {
        // Existing validation reports malformed protected content separately.
      }
    }, 650);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [html]);

  useEffect(() => {
    setSaveState("Saving locally…");
    const timer = window.setTimeout(() => {
      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ html, subject, filename: normaliseFilename(filename), preset: activePreset, updatedAt: Date.now() }),
        );
        setSaveState("Saved locally");
      } catch {
        setSaveState("Local save unavailable");
      }
    }, 500);
    return () => window.clearTimeout(timer);
  }, [activePreset, filename, html, subject]);

  useEffect(() => {
    if (updateOrigin.current === "visual") {
      updateOrigin.current = "idle";
      return undefined;
    }

    setSyncState("Checking HTML…");
    const timer = window.setTimeout(() => {
      if (!isUsableEmailHtml(html)) {
        setCodeError("Keep a complete <html> document containing .email-shell. The last valid preview is still shown.");
        setSyncState("HTML needs attention");
        return;
      }
      const protectedIssues = getProtectedContentIssues(html);
      if (protectedIssues.length > 0) {
        setCodeError(`Protected Manchester content cannot be removed: ${protectedIssues.join(", ")}.`);
        setSyncState("Protected content must be restored");
        return;
      }
      const normalisedHtml = ensureHiddenCredit(normaliseContactNames(html));
      if (normalisedHtml !== html) {
        updateOrigin.current = "source-normalisation";
        setHtml(normalisedHtml);
        setPreviewHtml(normalisedHtml);
        setCodeError("");
        setSyncState("Required source metadata restored");
        return;
      }
      setCodeError("");
      setPreviewHtml(html);
      setSyncState("Visual and HTML are in sync");
    }, 420);
    return () => window.clearTimeout(timer);
  }, [html]);

  const handleFrameLoad = useCallback(() => {
    const frame = iframeRef.current;
    const doc = frame?.contentDocument;
    if (!doc) return;

    savedSelectionRef.current = null;
    setFormatTargetReady(false);
    setActiveFormats(DEFAULT_ACTIVE_FORMATS);

    const editorStyle = doc.createElement("style");
    editorStyle.id = "mail-studio-editor-style";
    editorStyle.textContent = `
      [data-mail-studio-editable] { cursor: text; border-radius: 3px; transition: outline-color 120ms ease, background-color 120ms ease; }
      [data-mail-studio-editable]:hover { outline: 2px solid rgba(102,0,153,.20); outline-offset: 3px; }
      [data-mail-studio-editable]:focus { outline: 2px solid #660099; outline-offset: 3px; background: rgba(244,235,248,.45); }
      [data-mail-studio-editor-only] { box-sizing: border-box !important; font-family: Arial, 'Segoe UI', sans-serif !important; }
      .mail-studio-block-toolbar { display: flex !important; align-items: center !important; gap: 5px !important; min-height: 30px !important; margin: 7px 0 4px !important; padding: 4px 6px !important; color: #514657 !important; background: #f6f2f8 !important; border: 1px solid #d9cde0 !important; border-radius: 4px !important; font-size: 10px !important; line-height: 16px !important; }
      .mail-studio-block-toolbar .block-label { min-width: 0 !important; flex: 1 !important; overflow: hidden !important; font-weight: 700 !important; text-overflow: ellipsis !important; white-space: nowrap !important; }
      .mail-studio-block-toolbar button { min-width: 28px !important; height: 22px !important; margin: 0 !important; padding: 0 6px !important; color: #514657 !important; background: #ffffff !important; border: 1px solid #d2c7d7 !important; border-radius: 3px !important; cursor: pointer !important; font: 700 9px/20px Arial, sans-serif !important; }
      .mail-studio-block-toolbar button:hover { color: #660099 !important; border-color: #9e6db2 !important; }
      .mail-studio-block-toolbar button:disabled { cursor: not-allowed !important; opacity: .35 !important; }
      .mail-studio-block-toolbar .drag-handle { cursor: grab !important; color: #660099 !important; }
      .mail-studio-block-toolbar .add-point-control { color: #660099 !important; }
      .mail-studio-block-toolbar .delete-control { color: #8b3232 !important; }
      .mail-studio-list-point-control { width: 62px !important; padding: 3px 0 9px 8px !important; text-align: right !important; vertical-align: top !important; }
      .mail-studio-list-point-control button { height: 22px !important; margin: 0 !important; padding: 0 6px !important; color: #8b3232 !important; background: #ffffff !important; border: 1px solid #d2c7d7 !important; border-radius: 3px !important; cursor: pointer !important; font: 700 9px/20px Arial, sans-serif !important; white-space: nowrap !important; }
      .mail-studio-list-point-control button:hover { color: #660099 !important; border-color: #9e6db2 !important; }
      .mail-studio-list-point-control button:disabled { cursor: not-allowed !important; opacity: .35 !important; }
      .mail-studio-protected-toolbar { background: #fff8e8 !important; border-color: #e2ce91 !important; color: #5c4c25 !important; }
      .mail-studio-protected-toolbar .locked-badge { color: #7d5d00 !important; font-size: 9px !important; font-weight: 800 !important; letter-spacing: .4px !important; text-transform: uppercase !important; }
      .mail-studio-drop-zone { height: 5px !important; margin: 0 !important; border: 1px dashed transparent !important; border-radius: 4px !important; transition: height 100ms ease, background-color 100ms ease, border-color 100ms ease !important; }
      body.mail-studio-dragging .mail-studio-drop-zone { height: 24px !important; margin: 3px 0 !important; background: rgba(102,0,153,.07) !important; border-color: rgba(102,0,153,.38) !important; }
      body.mail-studio-dragging .mail-studio-drop-zone::after { display: block !important; color: #660099 !important; content: 'Drop component here' !important; font: 700 9px/22px Arial, sans-serif !important; text-align: center !important; }
      body.mail-studio-dragging .mail-studio-drop-zone.active { background: rgba(102,0,153,.16) !important; border-color: #660099 !important; }
    `;
    doc.head.appendChild(editorStyle);

    EDITABLE_REGIONS.forEach((region, regionIndex) => {
      doc.querySelectorAll(region.selector).forEach((element, itemIndex) => {
        element.contentEditable = "true";
        element.spellcheck = true;
        element.dataset.mailStudioEditable = "true";
        element.dataset.mailStudioLabel = `${region.label} ${itemIndex + 1}`;
        element.dataset.mailStudioRegion = `${regionIndex}-${itemIndex}`;
        if (region.field) element.dataset.mailStudioField = region.field;
        element.setAttribute("aria-label", region.label);
        element.setAttribute("role", "textbox");
      });
    });

    doc.querySelectorAll("a").forEach((anchor) => {
      anchor.addEventListener("click", (event) => event.preventDefault());
    });

    const getVisibleBlocks = () => {
      const bodyContent = doc.querySelector(".email-body-content");
      if (!bodyContent) return [];
      return [...bodyContent.children].filter((element) => (
        element.hasAttribute("data-content-block")
        && element.dataset.contentBlockDeleted !== "true"
        && element.dataset.moduleEnabled !== "false"
        && !element.hasAttribute("hidden")
      ));
    };

    const clearDragState = () => {
      paletteDragTypeRef.current = null;
      doc.body.classList.remove("mail-studio-dragging");
      doc.querySelectorAll(".mail-studio-drop-zone.active").forEach((zone) => zone.classList.remove("active"));
    };

    const commitBuilderChange = (next, syncMessage, noticeMessage) => {
      clearDragState();
      updateOrigin.current = "preview-builder";
      setHtml(next);
      setPreviewHtml(next);
      setActivePreset("custom");
      setCodeError("");
      setSyncState(syncMessage);
      if (noticeMessage) showNotice(noticeMessage);
    };

    const createControlButton = (label, title, onClick, className = "") => {
      const button = doc.createElement("button");
      button.type = "button";
      button.textContent = label;
      button.title = title;
      button.setAttribute("aria-label", title);
      button.className = className;
      button.contentEditable = "false";
      button.addEventListener("mousedown", (event) => event.preventDefault());
      button.addEventListener("click", onClick);
      return button;
    };

    const listPointEditorAttributes = [
      "contenteditable",
      "spellcheck",
      "data-mail-studio-editable",
      "data-mail-studio-label",
      "data-mail-studio-region",
      "data-mail-studio-field",
      "aria-label",
      "role",
    ];

    const getListRows = (block) => {
      const tableBody = block.tBodies?.[0];
      if (!tableBody) return [];
      return [...tableBody.rows].filter((row) => !row.hasAttribute("data-mail-studio-editor-only"));
    };

    const removeListPointEditorMetadata = (row) => {
      row.querySelectorAll("[data-mail-studio-editor-only]").forEach((element) => element.remove());
      [row, ...row.querySelectorAll("*")].forEach((element) => {
        listPointEditorAttributes.forEach((attribute) => element.removeAttribute(attribute));
      });
    };

    const renumberListRows = (block) => {
      if (!block.querySelector(".key-point-row")) return;
      getListRows(block).forEach((row, rowIndex) => {
        if (row.cells[0]) row.cells[0].textContent = String(rowIndex + 1).padStart(2, "0");
      });
    };

    const addListPoint = (block, blockLabel) => {
      const rows = getListRows(block);
      const sourceRow = rows.at(-1);
      const tableBody = block.tBodies?.[0];
      if (!sourceRow || !tableBody) return;

      const newRow = sourceRow.cloneNode(true);
      removeListPointEditorMetadata(newRow);
      const contentCell = newRow.cells[1];
      const title = contentCell?.querySelector(".key-point-title");
      const detail = contentCell?.querySelector(".key-point-detail");

      if (title && detail) {
        title.textContent = "New key point";
        detail.textContent = "Add supporting information here.";
      } else if (contentCell) {
        contentCell.textContent = "New bullet point.";
      }

      tableBody.appendChild(newRow);
      renumberListRows(block);
      const next = serializeEmailDocument(doc);
      commitBuilderChange(next, "List point added in preview", `Point added to ${blockLabel}`);
    };

    const addListPointControls = (block, blockLabel) => {
      const rows = getListRows(block);
      rows.forEach((row, rowIndex) => {
        const controlCell = doc.createElement("td");
        controlCell.dataset.mailStudioEditorOnly = "true";
        controlCell.className = "mail-studio-list-point-control";
        controlCell.contentEditable = "false";
        const removePoint = createControlButton("Delete", `Delete point ${rowIndex + 1} from ${blockLabel}`, () => {
          const currentRows = getListRows(block);
          if (currentRows.length <= 1) return;
          row.remove();
          renumberListRows(block);
          const next = serializeEmailDocument(doc);
          commitBuilderChange(next, "List point removed in preview", `Point removed from ${blockLabel}`);
        }, "delete-control");
        removePoint.disabled = rows.length <= 1;
        if (removePoint.disabled) removePoint.title = "Delete the whole component to remove its final point";
        controlCell.appendChild(removePoint);
        row.appendChild(controlCell);
      });
    };

    const handleDrop = (event, beforeBlockId = null) => {
      event.preventDefault();
      event.stopPropagation();
      const existingBlockId = event.dataTransfer?.getData("application/x-mail-studio-existing-block") || "";
      const blockType = event.dataTransfer?.getData("application/x-mail-studio-block") || paletteDragTypeRef.current || "";
      const source = serializeEmailDocument(doc);

      if (existingBlockId) {
        const next = repositionContentBlock(source, existingBlockId, beforeBlockId || null);
        commitBuilderChange(next, "Component order updated in preview", "Component moved");
        return;
      }

      if (!CONTENT_BLOCK_TYPES.some((item) => item.id === blockType)) {
        clearDragState();
        return;
      }

      const id = `block-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
      const next = addContentBlock(source, blockType, id, {
        beforeBlockId: beforeBlockId || undefined,
        atEnd: !beforeBlockId,
      });
      const label = CONTENT_BLOCK_TYPES.find((item) => item.id === blockType)?.label || "Component";
      commitBuilderChange(next, "Component dropped into the email", `${label} added`);
    };

    const createDropZone = (beforeBlockId = null) => {
      const zone = doc.createElement("div");
      zone.dataset.mailStudioEditorOnly = "true";
      zone.dataset.mailStudioDropZone = "true";
      zone.dataset.beforeBlock = beforeBlockId || "";
      zone.className = "mail-studio-drop-zone";
      zone.contentEditable = "false";
      zone.addEventListener("dragenter", (event) => {
        event.preventDefault();
        zone.classList.add("active");
      });
      zone.addEventListener("dragover", (event) => {
        event.preventDefault();
        if (event.dataTransfer) event.dataTransfer.dropEffect = event.dataTransfer.types.includes("application/x-mail-studio-existing-block") ? "move" : "copy";
      });
      zone.addEventListener("dragleave", () => zone.classList.remove("active"));
      zone.addEventListener("drop", (event) => handleDrop(event, beforeBlockId));
      return zone;
    };

    const bodyContent = doc.querySelector(".email-body-content");
    const blocks = getVisibleBlocks();
    blocks.forEach((block, index) => {
      const blockId = block.dataset.contentBlock;
      const blockLabel = block.dataset.contentBlockLabel || "Content block";
      const dropZone = createDropZone(blockId);
      const toolbar = doc.createElement("div");
      toolbar.dataset.mailStudioEditorOnly = "true";
      toolbar.dataset.mailStudioBlockToolbar = blockId;
      toolbar.className = "mail-studio-block-toolbar";
      toolbar.contentEditable = "false";

      const dragHandle = createControlButton("Drag", `Drag ${blockLabel} to reorder it`, () => {}, "drag-handle");
      dragHandle.draggable = true;
      dragHandle.addEventListener("dragstart", (event) => {
        paletteDragTypeRef.current = null;
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("application/x-mail-studio-existing-block", blockId);
        doc.body.classList.add("mail-studio-dragging");
      });
      dragHandle.addEventListener("dragend", clearDragState);

      const label = doc.createElement("span");
      label.className = "block-label";
      label.textContent = blockLabel;
      const isListBlock = block.dataset.contentBlockType === "bullets";
      const addPoint = isListBlock
        ? createControlButton("Add point", `Add a point to ${blockLabel}`, () => addListPoint(block, blockLabel), "add-point-control")
        : null;
      const up = createControlButton("Up", `Move ${blockLabel} up`, () => {
        const current = getVisibleBlocks();
        const currentIndex = current.findIndex((item) => item.dataset.contentBlock === blockId);
        if (currentIndex <= 0) return;
        const source = serializeEmailDocument(doc);
        const next = repositionContentBlock(source, blockId, current[currentIndex - 1].dataset.contentBlock);
        commitBuilderChange(next, "Component order updated in preview", `${blockLabel} moved up`);
      });
      up.disabled = index === 0;
      const down = createControlButton("Down", `Move ${blockLabel} down`, () => {
        const current = getVisibleBlocks();
        const currentIndex = current.findIndex((item) => item.dataset.contentBlock === blockId);
        if (currentIndex < 0 || currentIndex === current.length - 1) return;
        const beforeBlockId = current[currentIndex + 2]?.dataset.contentBlock || null;
        const source = serializeEmailDocument(doc);
        const next = repositionContentBlock(source, blockId, beforeBlockId);
        commitBuilderChange(next, "Component order updated in preview", `${blockLabel} moved down`);
      });
      down.disabled = index === blocks.length - 1;
      const remove = createControlButton("Delete", `Delete ${blockLabel}`, () => {
        const source = serializeEmailDocument(doc);
        const next = removeContentBlock(source, blockId);
        commitBuilderChange(next, "Component removed in preview", `${blockLabel} removed`);
      }, "delete-control");

      toolbar.append(dragHandle, label);
      if (addPoint) toolbar.appendChild(addPoint);
      toolbar.append(up, down, remove);
      bodyContent.insertBefore(dropZone, block);
      bodyContent.insertBefore(toolbar, block);
      if (isListBlock) addListPointControls(block, blockLabel);
    });
    if (bodyContent) bodyContent.appendChild(createDropZone());

    PROTECTED_SECTIONS.forEach((section) => {
      const protectedSection = doc.querySelector(`[data-protected-section="${section.id}"]`);
      const destination = protectedSection?.matches("tr") ? protectedSection.querySelector("td") : protectedSection;
      if (!destination) return;
      const toolbar = doc.createElement("div");
      toolbar.dataset.mailStudioEditorOnly = "true";
      toolbar.dataset.mailStudioProtectedToolbar = section.id;
      toolbar.className = "mail-studio-block-toolbar mail-studio-protected-toolbar";
      toolbar.contentEditable = "false";
      const badge = doc.createElement("span");
      badge.className = "locked-badge";
      badge.textContent = "Locked";
      const label = doc.createElement("span");
      label.className = "block-label";
      label.textContent = section.label;
      const remove = createControlButton("Delete", `Delete ${section.label}`, () => {
        showNotice(`${section.label} is protected and cannot be deleted`);
      }, "delete-control");
      toolbar.append(badge, label, remove);
      destination.prepend(toolbar);
    });

    doc.addEventListener("dragend", clearDragState);

    const handleInput = (event) => {
      const editable = event.target.closest?.("[data-mail-studio-editable]");
      const linkedField = editable?.dataset.mailStudioField;
      if (linkedField) {
        doc.querySelectorAll(`[data-mail-studio-field="${linkedField}"]`).forEach((target) => {
          if (target !== editable) target.innerHTML = editable.innerHTML;
        });
      }
      updateOrigin.current = "visual";
      setHtml(serializeEmailDocument(doc));
      setSyncState("Visual edit synced to HTML");
    };

    const handleSelectionChange = () => {
      const selection = doc.getSelection();
      if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
        savedSelectionRef.current = null;
        setFormatTargetReady(false);
        setActiveFormats(DEFAULT_ACTIVE_FORMATS);
        return;
      }

      const range = selection.getRangeAt(0);
      const container = range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE
        ? range.commonAncestorContainer
        : range.commonAncestorContainer.parentElement;
      const editable = container?.closest?.("[data-mail-studio-editable]");
      if (!editable || !editable.contains(range.startContainer) || !editable.contains(range.endContainer)) {
        savedSelectionRef.current = null;
        setFormatTargetReady(false);
        setActiveFormats(DEFAULT_ACTIVE_FORMATS);
        return;
      }

      savedSelectionRef.current = range.cloneRange();
      const currentFormatting = readSelectionFormatting(doc, range);
      setActiveFormats(currentFormatting);
      setFontFamily(currentFormatting.fontFamily);
      setFontSize(currentFormatting.fontSize);
      setTextColor(currentFormatting.textColor);
      setFormatTargetReady(true);
    };

    doc.addEventListener("input", handleInput);
    doc.addEventListener("selectionchange", handleSelectionChange);
  }, [showNotice]);

  const applyFormatting = useCallback((command, value) => {
    const doc = iframeRef.current?.contentDocument;
    const range = savedSelectionRef.current;
    if (!doc || !range || range.startContainer.ownerDocument !== doc) {
      showNotice("Select text inside the email first");
      return;
    }

    const selection = doc.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    doc.execCommand(command, false, command === "fontSize" ? "7" : (value ?? null));

    if (command === "fontSize") {
      doc.querySelectorAll('font[size="7"]').forEach((font) => {
        font.removeAttribute("size");
        font.style.fontSize = `${value}px`;
      });
    }

    if (selection.rangeCount > 0) savedSelectionRef.current = selection.getRangeAt(0).cloneRange();
    const currentFormatting = readSelectionFormatting(doc, savedSelectionRef.current || range);
    setActiveFormats(currentFormatting);
    setFontFamily(currentFormatting.fontFamily);
    setFontSize(currentFormatting.fontSize);
    setTextColor(currentFormatting.textColor);
    updateOrigin.current = "visual";
    setHtml(serializeEmailDocument(doc));
    setSyncState("Text formatting synced to HTML");
  }, [showNotice]);

  const applyQuickSetting = useCallback((changes) => {
    const next = updateEmailMetadata(html, changes);
    updateOrigin.current = "quick-setting";
    setHtml(next);
    setPreviewHtml(next);
    setCodeError("");
    setSyncState("Quick setting applied");
  }, [html]);

  const applyPreset = useCallback((presetId) => {
    const preset = getPresetById(presetId);
    const next = applyEmailPreset(html, preset);
    updateOrigin.current = "preset";
    setHtml(next);
    setPreviewHtml(next);
    setSubject(preset.subject);
    setFilename(preset.filename);
    setActivePreset(preset.id);
    setCodeError("");
    setSyncState(`${preset.label} preset applied`);
    showNotice(`${preset.label} modules applied`);
  }, [html, showNotice]);

  const applyModuleSetting = useCallback((moduleId, enabled) => {
    const next = updateEmailModules(html, { [moduleId]: enabled });
    updateOrigin.current = "module-setting";
    setHtml(next);
    setPreviewHtml(next);
    setActivePreset("custom");
    setCodeError("");
    setSyncState("Module selection applied");
  }, [html]);

  const addBlock = useCallback((type) => {
    const id = `block-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
    const next = addContentBlock(html, type, id);
    updateOrigin.current = "content-builder";
    setHtml(next);
    setPreviewHtml(next);
    setActivePreset("custom");
    setCodeError("");
    setSyncState("Component added to the email");
    showNotice(`${CONTENT_BLOCK_TYPES.find((item) => item.id === type)?.label || "Component"} added`);
  }, [html, showNotice]);

  const handlePaletteDragStart = useCallback((event, type) => {
    paletteDragTypeRef.current = type;
    event.dataTransfer.effectAllowed = "copy";
    event.dataTransfer.setData("application/x-mail-studio-block", type);
    iframeRef.current?.contentDocument?.body.classList.add("mail-studio-dragging");
  }, []);

  const handlePaletteDragEnd = useCallback(() => {
    paletteDragTypeRef.current = null;
    const doc = iframeRef.current?.contentDocument;
    doc?.body.classList.remove("mail-studio-dragging");
    doc?.querySelectorAll(".mail-studio-drop-zone.active").forEach((zone) => zone.classList.remove("active"));
  }, []);

  const handleCodeChange = (event) => {
    const next = event.target.value;
    updateOrigin.current = "code";
    setHtml(next);
    const issues = getProtectedContentIssues(next);
    if (issues.length > 0) {
      setCodeError(`Protected Manchester content cannot be removed: ${issues.join(", ")}.`);
      setSyncState("Protected content must be restored");
    }
  };

  const restoreProtected = useCallback(() => {
    const next = restoreProtectedContent(html, initialTemplate);
    updateOrigin.current = "protected-restore";
    setHtml(next);
    setPreviewHtml(next);
    setCodeError("");
    setSyncState("Protected Manchester content restored");
    showNotice("Protected Manchester content restored");
  }, [html, showNotice]);

  const exportIsAllowed = useCallback(() => {
    const issues = getProtectedContentIssues(html);
    if (!isUsableEmailHtml(html) || issues.length > 0) {
      setCodeError(issues.length > 0
        ? `Protected Manchester content cannot be removed: ${issues.join(", ")}.`
        : "Keep a complete <html> document containing .email-shell. The last valid preview is still shown.");
      showNotice("Restore the protected Manchester content before exporting");
      return false;
    }
    return true;
  }, [html, showNotice]);

  const prepareArchivedExport = useCallback(async (operation) => {
    if (!exportIsAllowed() || exportBusy) return null;
    setExportBusy(operation);
    setSyncState("Creating immutable email backup...");
    try {
      const cleaned = cleanEmailHtml(html);
      const archived = await archiveEmailExport({
        html: cleaned,
        subject,
        filename: normaliseFilename(filename),
        preset: activePreset,
        modules,
        operation,
      });
      updateOrigin.current = "archive-created";
      setHtml((current) => setVerificationCode(current, archived.verificationCode));
      setPreviewHtml((current) => setVerificationCode(current, archived.verificationCode));
      setSyncState(`Immutable backup ${archived.archive.id} created`);
      return archived;
    } catch (error) {
      setSyncState("Export stopped because the backup failed");
      showNotice(error instanceof Error ? error.message : "Immutable backup failed; nothing was copied or downloaded");
      return null;
    } finally {
      setExportBusy("");
    }
  }, [activePreset, exportBusy, exportIsAllowed, filename, html, modules, showNotice, subject]);

  const copySource = async () => {
    const archived = await prepareArchivedExport("copy_html");
    if (!archived) return;
    try {
      await navigator.clipboard.writeText(archived.html);
      showNotice(`HTML copied and archived as ${archived.messageNumber}`);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = archived.html;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      textarea.remove();
      showNotice(`HTML copied and archived as ${archived.messageNumber}`);
    }
  };

  const copyForOutlook = async () => {
    const archived = await prepareArchivedExport("copy_outlook");
    if (!archived) return;
    const parsed = new DOMParser().parseFromString(archived.html, "text/html");
    const bodyHtml = parsed.body.innerHTML;
    const plainText = parsed.body.innerText.replace(/\n{3,}/g, "\n\n").trim();

    try {
      if (window.ClipboardItem && navigator.clipboard?.write) {
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/html": new Blob([bodyHtml], { type: "text/html" }),
            "text/plain": new Blob([plainText], { type: "text/plain" }),
          }),
        ]);
      } else {
        const holder = document.createElement("div");
        holder.innerHTML = bodyHtml;
        holder.style.position = "fixed";
        holder.style.left = "-9999px";
        document.body.appendChild(holder);
        const range = document.createRange();
        range.selectNodeContents(holder);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
        document.execCommand("copy");
        selection.removeAllRanges();
        holder.remove();
      }
      showNotice(`Outlook email copied and archived as ${archived.messageNumber}`);
    } catch {
      showNotice("Copy was blocked. Use Copy HTML instead.");
    }
  };

  const downloadHtml = async () => {
    const archived = await prepareArchivedExport("download_html");
    if (!archived) return;
    const blob = new Blob([archived.html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = normaliseFilename(filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showNotice(`HTML downloaded and archived as ${archived.messageNumber}`);
  };

  const resetTemplate = () => {
    if (!window.confirm("Reset the email to the original Manchester Chemistry template? Your current local draft will be replaced.")) return;
    updateOrigin.current = "reset";
    const identified = ensureMessageNumber(initialTemplate, { forceNew: true });
    setHtml(identified.html);
    setPreviewHtml(identified.html);
    setSubject("Department of Chemistry Student Representatives | Student Feedback Forum");
    setFilename("manchester-chemistry-student-feedback-forum.html");
    setActivePreset(DEFAULT_PRESET_ID);
    setCodeError("");
    showNotice("Template reset");
  };

  return (
    <div className="studio-shell">
      <header className="studio-header">
        <div className="studio-brand">
          <div className="brand-kicker">THE UNIVERSITY OF MANCHESTER</div>
          <div className="brand-title">Chemistry Representative Mail Studio</div>
        </div>
        <div className="header-status" aria-live="polite">
          <span className="status-dot" aria-hidden="true" />
          {saveState}
        </div>
        <div className="header-actions">
          <AppButton className="secondary-on-dark" onClick={() => setArchiveOpen(true)}>Backups</AppButton>
          <AppButton className="secondary-on-dark" onClick={resetTemplate}>Reset</AppButton>
          <AppButton className="secondary-on-dark" onClick={copySource} disabled={Boolean(exportBusy || codeError || protectionIssues.length)}>{exportBusy === "copy_html" ? "Archiving..." : "Copy HTML"}</AppButton>
          <AppButton className="primary" onClick={copyForOutlook} disabled={Boolean(exportBusy || codeError || protectionIssues.length)}>{exportBusy === "copy_outlook" ? "Archiving..." : "Copy for Outlook"}</AppButton>
          <AppButton className="primary-light" onClick={downloadHtml} disabled={Boolean(exportBusy || codeError || protectionIssues.length)}>{exportBusy === "download_html" ? "Archiving..." : "Download HTML"}</AppButton>
        </div>
      </header>

      <ArchivePanel open={archiveOpen} onClose={() => setArchiveOpen(false)} />

      <main className="studio-workspace">
        <aside className="settings-panel" aria-label="Email settings">
          <div className="panel-heading">
            <span className="panel-number">01</span>
            <div>
              <h2>Email details</h2>
              <p>Saved only in this browser.</p>
            </div>
          </div>

          <label className="field-label" htmlFor="email-subject">Outlook subject</label>
          <textarea
            id="email-subject"
            className="text-field compact-textarea"
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            rows="3"
          />

          <label className="field-label" htmlFor="download-name">Download filename</label>
          <input
            id="download-name"
            className="text-field"
            value={filename}
            onChange={(event) => setFilename(event.target.value)}
          />

          <div className="section-rule" />

          <fieldset className="preset-fieldset">
            <legend className="field-label">Announcement type</legend>
            <p className="field-help">Presets replace the sample copy and select a useful module mix.</p>
            <div className="preset-grid">
              {EMAIL_PRESETS.map((preset) => (
                <button
                  className={`preset-button ${activePreset === preset.id ? "active" : ""}`}
                  type="button"
                  key={preset.id}
                  onClick={() => applyPreset(preset.id)}
                  disabled={Boolean(codeError)}
                  title={preset.description}
                >
                  {preset.label}
                </button>
              ))}
            </div>
            {activePreset === "custom" && <p className="custom-state">Custom module selection</p>}
          </fieldset>

          <div className="module-heading">
            <span className="field-label">Content modules</span>
            <span>Switch off anything this email does not need.</span>
          </div>
          <div className="module-list">
            {EMAIL_MODULES.map((module) => (
              <label className="module-toggle" key={module.id} htmlFor={`module-${module.id}`}>
                <span>
                  <strong>{module.label}</strong>
                  <small>{module.description}</small>
                </span>
                <input
                  id={`module-${module.id}`}
                  type="checkbox"
                  checked={Boolean(modules[module.id])}
                  onChange={(event) => applyModuleSetting(module.id, event.target.checked)}
                  disabled={Boolean(codeError)}
                />
              </label>
            ))}
          </div>

          <div className="section-rule" />

          <label className="field-label" htmlFor="cta-url">Button destination</label>
          <input
            id="cta-url"
            className="text-field"
            value={metadata.ctaUrl}
            onChange={(event) => applyQuickSetting({ ctaUrl: event.target.value })}
            placeholder="https://"
          />
          {!metadata.ctaUrl.startsWith("https://") && (
            <p className="field-warning">Use a full https:// link before sending.</p>
          )}

          <label className="field-label" htmlFor="contact-email-1">Contact email 1</label>
          <input
            id="contact-email-1"
            className="text-field"
            value={metadata.contactEmail1}
            onChange={(event) => applyQuickSetting({ contactEmail1: event.target.value })}
            placeholder="name@student.manchester.ac.uk"
          />

          <label className="field-label" htmlFor="contact-email-2">Contact email 2</label>
          <input
            id="contact-email-2"
            className="text-field"
            value={metadata.contactEmail2}
            onChange={(event) => applyQuickSetting({ contactEmail2: event.target.value })}
            placeholder="name@student.manchester.ac.uk"
          />

          <div className="editing-note">
            <strong>Edit the email itself</strong>
            <p>Click any highlighted text in the preview and type. The HTML panel updates automatically.</p>
          </div>
        </aside>

        <section className="preview-panel" aria-label="Visual email editor">
          <div className="panel-toolbar">
            <div className="panel-heading compact">
              <span className="panel-number">02</span>
              <div>
                <h2>Visual editor</h2>
                <p>{syncState}</p>
              </div>
            </div>
            <div className="segmented-control" aria-label="Preview width">
              <button className={previewMode === "desktop" ? "active" : ""} type="button" onClick={() => setPreviewMode("desktop")}>Desktop</button>
              <button className={previewMode === "narrow" ? "active" : ""} type="button" onClick={() => setPreviewMode("narrow")}>Narrow</button>
            </div>
          </div>
          <div className="component-palette" aria-label="Draggable email components">
            <div className="component-palette-copy">
              <strong>Add components</strong>
              <span>Drag a component into a purple drop line in the email. Click to add before the sign-off.</span>
            </div>
            <div className="component-palette-items">
              {CONTENT_BLOCK_TYPES.map((blockType) => (
                <button
                  className="component-palette-button"
                  type="button"
                  draggable={!codeError}
                  key={blockType.id}
                  onDragStart={(event) => handlePaletteDragStart(event, blockType.id)}
                  onDragEnd={handlePaletteDragEnd}
                  onClick={() => addBlock(blockType.id)}
                  disabled={Boolean(codeError)}
                  title={`Drag to add ${blockType.label}. ${blockType.description}`}
                >
                  <span aria-hidden="true">&#8942;&#8942;</span>
                  {blockType.label}
                </button>
              ))}
            </div>
          </div>
          <div className="format-toolbar" aria-label="Text formatting toolbar">
            <span className={`format-guidance ${formatTargetReady ? "ready" : ""}`}>
              {formatTargetReady ? "Selected text ready" : "Select text in the email to format it"}
            </span>
            <label className="format-control">
              <span>Font</span>
              <select
                aria-label="Font family"
                value={fontFamily}
                disabled={!formatTargetReady || Boolean(codeError)}
                onChange={(event) => {
                  setFontFamily(event.target.value);
                  applyFormatting("fontName", event.target.value);
                }}
              >
                {FONT_FAMILIES.map((font) => <option value={font} key={font}>{font}</option>)}
              </select>
            </label>
            <label className="format-control size-control">
              <span>Size</span>
              <select
                aria-label="Font size"
                value={fontSize}
                disabled={!formatTargetReady || Boolean(codeError)}
                onChange={(event) => {
                  setFontSize(event.target.value);
                  applyFormatting("fontSize", event.target.value);
                }}
              >
                {availableFontSizes.map((size) => <option value={String(size)} key={size}>{size}px</option>)}
              </select>
            </label>
            <div className="format-button-group" aria-label="Text emphasis">
              <button className={activeFormats.bold ? "active" : ""} type="button" aria-label="Bold" aria-pressed={activeFormats.bold} title="Bold" disabled={!formatTargetReady || Boolean(codeError)} onMouseDown={(event) => event.preventDefault()} onClick={() => applyFormatting("bold")}><strong>B</strong></button>
              <button className={activeFormats.italic ? "active" : ""} type="button" aria-label="Italic" aria-pressed={activeFormats.italic} title="Italic" disabled={!formatTargetReady || Boolean(codeError)} onMouseDown={(event) => event.preventDefault()} onClick={() => applyFormatting("italic")}><em>I</em></button>
              <button className={`underline-button ${activeFormats.underline ? "active" : ""}`.trim()} type="button" aria-label="Underline" aria-pressed={activeFormats.underline} title="Underline" disabled={!formatTargetReady || Boolean(codeError)} onMouseDown={(event) => event.preventDefault()} onClick={() => applyFormatting("underline")}>U</button>
            </div>
            <label className="colour-control" title="Text colour">
              <span>Colour</span>
              <input
                type="color"
                aria-label="Text colour"
                value={textColor}
                disabled={!formatTargetReady || Boolean(codeError)}
                onChange={(event) => {
                  setTextColor(event.target.value);
                  applyFormatting("foreColor", event.target.value);
                }}
              />
            </label>
            <div className="format-button-group alignment-group" aria-label="Text alignment">
              <button className={activeFormats.alignment === "left" ? "active" : ""} type="button" aria-pressed={activeFormats.alignment === "left"} disabled={!formatTargetReady || Boolean(codeError)} onMouseDown={(event) => event.preventDefault()} onClick={() => applyFormatting("justifyLeft")}>Left</button>
              <button className={activeFormats.alignment === "center" ? "active" : ""} type="button" aria-pressed={activeFormats.alignment === "center"} disabled={!formatTargetReady || Boolean(codeError)} onMouseDown={(event) => event.preventDefault()} onClick={() => applyFormatting("justifyCenter")}>Centre</button>
              <button className={activeFormats.alignment === "right" ? "active" : ""} type="button" aria-pressed={activeFormats.alignment === "right"} disabled={!formatTargetReady || Boolean(codeError)} onMouseDown={(event) => event.preventDefault()} onClick={() => applyFormatting("justifyRight")}>Right</button>
            </div>
            <button className="clear-format-button" type="button" disabled={!formatTargetReady || Boolean(codeError)} onMouseDown={(event) => event.preventDefault()} onClick={() => applyFormatting("removeFormat")}>Clear</button>
          </div>
          <div className="preview-stage">
            <div className={`preview-frame ${previewMode}`}>
              <iframe
                ref={iframeRef}
                title="Editable email preview"
                srcDoc={previewHtml}
                sandbox="allow-same-origin"
                onLoad={handleFrameLoad}
              />
            </div>
          </div>
        </section>

        <section className="code-panel" aria-label="HTML code editor">
          <div className="panel-heading compact code-heading">
            <span className="panel-number">03</span>
            <div>
              <h2>HTML code</h2>
              <p>Code edits refresh the preview after a short pause.</p>
            </div>
          </div>
          {codeError && (
            <div className="code-error" role="alert">
              <span>{codeError}</span>
              {protectionIssues.length > 0 && (
                <button type="button" onClick={restoreProtected}>Restore protected content</button>
              )}
            </div>
          )}
          <textarea
            className="code-editor"
            aria-label="Email HTML code"
            spellCheck="false"
            value={html}
            onChange={handleCodeChange}
          />
          <div className="code-footer">
            <span>{html.split("\n").length} lines</span>
            <span>UTF-8 · Outlook-safe tables</span>
          </div>
        </section>
      </main>

      <footer className="studio-footer" aria-label="Copyright and technical support">
        <span>&copy; {currentTime.getFullYear()} Student Representatives Team, The University of Manchester</span>
        <span aria-hidden="true">&middot;</span>
        <span>Technical support provided by Ziwen M.</span>
        <span aria-hidden="true">&middot;</span>
        <time dateTime={currentTime.toISOString()}>{liveTime}</time>
      </footer>

      {notice && <div className="toast" role="status" aria-live="polite">{notice}</div>}
    </div>
  );
}
