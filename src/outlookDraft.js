function base64Utf8(value) {
  const bytes = new TextEncoder().encode(String(value ?? ""));
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

function wrapBase64(value) {
  return value.match(/.{1,76}/g)?.join("\r\n") || "";
}

function safeSubject(value) {
  return String(value || "Archived email").replace(/[\r\n]+/g, " ").trim() || "Archived email";
}

export function buildOutlookDraft({ html, subject, messageNumber }) {
  if (typeof html !== "string" || !html.trim()) {
    throw new Error("The archived email content is unavailable.");
  }
  const normalizedMessageNumber = String(messageNumber || "email").replace(/[^A-Za-z0-9_-]/g, "") || "email";
  const headers = [
    "X-Unsent: 1",
    "To:",
    `Subject: =?UTF-8?B?${base64Utf8(safeSubject(subject))}?=`,
    "MIME-Version: 1.0",
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
  ];

  return {
    content: `${headers.join("\r\n")}\r\n\r\n${wrapBase64(base64Utf8(html))}\r\n`,
    filename: `${normalizedMessageNumber}.eml`,
  };
}

export function downloadOutlookDraft(draft, documentRef = document, urlApi = URL) {
  const blob = new Blob([draft.content], { type: "message/rfc822;charset=utf-8" });
  const url = urlApi.createObjectURL(blob);
  const link = documentRef.createElement("a");
  link.href = url;
  link.download = draft.filename;
  documentRef.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => urlApi.revokeObjectURL(url), 0);
}
