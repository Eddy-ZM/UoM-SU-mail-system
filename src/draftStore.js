export const DRAFT_STORAGE_KEY = "student-union-mail-studio:draft:v1";
export const DRAFT_STORAGE_NAMESPACE = "student-union-mail-studio:draft:v2";
export const LEGACY_DRAFT_STORAGE_KEY = "student-union-mail-studio:v6";
export const DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function normaliseOwner(owner) {
  return typeof owner === "string" ? owner.trim().toLowerCase() : "";
}

export function draftStorageKey(owner) {
  const normalisedOwner = normaliseOwner(owner);
  return normalisedOwner
    ? `${DRAFT_STORAGE_NAMESPACE}:${encodeURIComponent(normalisedOwner)}`
    : "";
}

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

export function clearDraft(storage = globalThis.localStorage, owner = "") {
  const scopedKey = draftStorageKey(owner);
  if (scopedKey) storage.removeItem(scopedKey);
  storage.removeItem(DRAFT_STORAGE_KEY);
  storage.removeItem(LEGACY_DRAFT_STORAGE_KEY);
}

export function saveDraft(storage = globalThis.localStorage, owner, value, now = Date.now()) {
  const normalisedOwner = normaliseOwner(owner);
  const scopedKey = draftStorageKey(normalisedOwner);
  if (!scopedKey) throw new Error("A signed-in draft owner is required.");
  const record = createDraftRecord({ ...value, owner: normalisedOwner }, now);
  storage.setItem(scopedKey, JSON.stringify(record));
  storage.removeItem(DRAFT_STORAGE_KEY);
  storage.removeItem(LEGACY_DRAFT_STORAGE_KEY);
  return record;
}

export function readDraft(storage = globalThis.localStorage, owner, now = Date.now()) {
  const normalisedOwner = normaliseOwner(owner);
  const scopedKey = draftStorageKey(normalisedOwner);
  if (!scopedKey) return null;

  for (const key of [scopedKey, DRAFT_STORAGE_KEY, LEGACY_DRAFT_STORAGE_KEY]) {
    const raw = storage.getItem(key);
    if (!raw) continue;

    let draft;
    try {
      draft = JSON.parse(raw);
    } catch {
      storage.removeItem(key);
      continue;
    }

    if (
      !draft
      || typeof draft.html !== "string"
      || isDraftExpired(draft, now)
      || (key === scopedKey && normaliseOwner(draft.owner) !== normalisedOwner)
    ) {
      clearDraft(storage, normalisedOwner);
      return null;
    }

    const record = {
      ...draft,
      owner: normalisedOwner,
      updatedAt: normaliseTimestamp(draft.updatedAt),
      expiresAt: draftExpiresAt(draft),
    };
    if (key !== scopedKey) {
      storage.setItem(scopedKey, JSON.stringify(record));
      storage.removeItem(key);
    }
    return record;
  }
  return null;
}
