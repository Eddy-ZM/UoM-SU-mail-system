export const DRAFT_STORAGE_KEY = "student-union-mail-studio:draft:v1";
export const LEGACY_DRAFT_STORAGE_KEY = "student-union-mail-studio:v6";
export const DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function normaliseTimestamp(value) {
  const timestamp = Number(value);
  return Number.isFinite(timestamp) && timestamp > 0 ? timestamp : 0;
}

export function draftExpiresAt(draft) {
  const explicitExpiry = normaliseTimestamp(draft?.expiresAt);
  if (explicitExpiry) return explicitExpiry;
  const updatedAt = normaliseTimestamp(draft?.updatedAt);
  return updatedAt ? updatedAt + DRAFT_TTL_MS : 0;
}

export function isDraftExpired(draft, now = Date.now()) {
  const expiresAt = draftExpiresAt(draft);
  return !expiresAt || expiresAt <= now;
}

export function createDraftRecord(value, now = Date.now()) {
  return {
    ...value,
    updatedAt: now,
    expiresAt: now + DRAFT_TTL_MS,
  };
}

export function clearDraft(storage = globalThis.localStorage) {
  storage.removeItem(DRAFT_STORAGE_KEY);
  storage.removeItem(LEGACY_DRAFT_STORAGE_KEY);
}

export function saveDraft(storage = globalThis.localStorage, value, now = Date.now()) {
  const record = createDraftRecord(value, now);
  storage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(record));
  storage.removeItem(LEGACY_DRAFT_STORAGE_KEY);
  return record;
}

export function readDraft(storage = globalThis.localStorage, now = Date.now()) {
  for (const key of [DRAFT_STORAGE_KEY, LEGACY_DRAFT_STORAGE_KEY]) {
    const raw = storage.getItem(key);
    if (!raw) continue;

    let draft;
    try {
      draft = JSON.parse(raw);
    } catch {
      storage.removeItem(key);
      continue;
    }

    if (!draft || typeof draft.html !== "string" || isDraftExpired(draft, now)) {
      clearDraft(storage);
      return null;
    }

    const record = {
      ...draft,
      updatedAt: normaliseTimestamp(draft.updatedAt),
      expiresAt: draftExpiresAt(draft),
    };
    if (key === LEGACY_DRAFT_STORAGE_KEY) {
      storage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(record));
      storage.removeItem(LEGACY_DRAFT_STORAGE_KEY);
    }
    return record;
  }
  return null;
}
