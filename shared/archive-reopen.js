export const ARCHIVE_REOPEN_WINDOW_MS = 24 * 60 * 60 * 1000;

function timestamp(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

export function archiveReopenWindow(firstArchivedAt, now = Date.now()) {
  const firstArchivedTimestamp = timestamp(firstArchivedAt);
  const nowTimestamp = timestamp(now);
  if (firstArchivedTimestamp === null || nowTimestamp === null) {
    return Object.freeze({
      firstArchivedAt: firstArchivedAt || null,
      reopenExpiresAt: null,
      canReopen: false,
    });
  }

  const reopenExpiresAt = new Date(firstArchivedTimestamp + ARCHIVE_REOPEN_WINDOW_MS).toISOString();
  return Object.freeze({
    firstArchivedAt: new Date(firstArchivedTimestamp).toISOString(),
    reopenExpiresAt,
    canReopen: nowTimestamp >= firstArchivedTimestamp && nowTimestamp < firstArchivedTimestamp + ARCHIVE_REOPEN_WINDOW_MS,
  });
}

export function canReopenArchive(archive, now = Date.now()) {
  if (!archive?.canReopen) return false;
  const expiresAt = timestamp(archive.reopenExpiresAt);
  const nowTimestamp = timestamp(now);
  return expiresAt !== null && nowTimestamp !== null && nowTimestamp < expiresAt;
}
