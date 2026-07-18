export const EDITOR_PHASE = Object.freeze({
  CHOOSER: "chooser",
  EDITING: "editing",
  ARCHIVING: "archiving",
  ARCHIVED: "archived",
});

export function canModifyDraft(phase) {
  return phase === EDITOR_PHASE.EDITING;
}

export function archiveReceiptFromExport(archived, operation) {
  const archive = archived?.archive;
  if (!archive?.id || !archive?.messageNumber || !archive?.verificationCode) {
    throw new Error("The archive service did not return a complete receipt.");
  }

  return Object.freeze({
    archiveId: archive.id,
    messageNumber: archive.messageNumber,
    verificationCode: archive.verificationCode,
    operation,
    subject: archive.subject || "Archived email",
    createdAt: archive.createdAt || new Date().toISOString(),
  });
}
