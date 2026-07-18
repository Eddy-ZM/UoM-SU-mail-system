export const ARCHIVE_OPERATION_LABELS = Object.freeze({
  copy_html: "Copy HTML",
  copy_outlook: "Copy for Outlook",
  download_html: "Download HTML",
});

export function buildArchiveConfirmationDetails({
  operation,
  subject,
  messageNumber,
  filename,
  presetLabel,
  moduleLabels,
  submittedByName,
  submittedByEmail,
}) {
  const operationLabel = ARCHIVE_OPERATION_LABELS[operation];
  if (!operationLabel) throw new Error("Unsupported archive operation.");

  const details = {
    operation,
    operationLabel,
    subject: String(subject || "").trim(),
    messageNumber: String(messageNumber || "").trim(),
    filename: String(filename || "").trim(),
    presetLabel: String(presetLabel || "Custom").trim() || "Custom",
    moduleLabels: Array.isArray(moduleLabels) ? moduleLabels.filter(Boolean) : [],
    submittedByName: String(submittedByName || "").trim(),
    submittedByEmail: String(submittedByEmail || "").trim().toLowerCase(),
  };
  const issues = [];
  if (!details.subject) issues.push("Add an Outlook email title before archiving.");
  if (details.subject.length > 500) issues.push("Shorten the Outlook email title to 500 characters or fewer.");
  if (!details.messageNumber) issues.push("The protected message number is unavailable.");
  if (!details.filename) issues.push("Add a download filename before archiving.");
  if (details.filename.length > 255) issues.push("Shorten the download filename to 255 characters or fewer.");
  if (!details.submittedByEmail) issues.push("The signed-in user identity is unavailable.");

  return { ...details, issues, ready: issues.length === 0 };
}
