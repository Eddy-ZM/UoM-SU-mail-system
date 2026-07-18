import test from "node:test";
import assert from "node:assert/strict";
import {
  DRAFT_STORAGE_KEY,
  DRAFT_TTL_MS,
  LEGACY_DRAFT_STORAGE_KEY,
  clearDraft,
  draftStorageKey,
  isDraftExpired,
  readDraft,
  saveDraft,
} from "../src/draftStore.js";

class MemoryStorage {
  constructor(entries = []) {
    this.values = new Map(entries);
  }

  getItem(key) {
    return this.values.has(key) ? this.values.get(key) : null;
  }

  setItem(key, value) {
    this.values.set(key, String(value));
  }

  removeItem(key) {
    this.values.delete(key);
  }
}

const draftValue = {
  html: "<!doctype html><html><body>Draft</body></html>",
  subject: "Chemistry draft",
  filename: "chemistry-draft.html",
  preset: "general",
};
const owner = "representative@manchester.ac.uk";

test("a saved draft expires exactly seven days after its most recent save", () => {
  const storage = new MemoryStorage();
  const now = Date.UTC(2026, 6, 18, 12, 0, 0);
  const draft = saveDraft(storage, owner, draftValue, now);

  assert.equal(draft.expiresAt, now + DRAFT_TTL_MS);
  assert.equal(isDraftExpired(draft, now + DRAFT_TTL_MS - 1), false);
  assert.equal(isDraftExpired(draft, now + DRAFT_TTL_MS), true);
  assert.equal(readDraft(storage, owner, now + DRAFT_TTL_MS - 1)?.subject, "Chemistry draft");
});

test("reading an expired draft removes it from browser storage", () => {
  const storage = new MemoryStorage();
  const now = Date.UTC(2026, 6, 18, 12, 0, 0);
  saveDraft(storage, owner, draftValue, now);

  assert.equal(readDraft(storage, owner, now + DRAFT_TTL_MS), null);
  assert.equal(storage.getItem(draftStorageKey(owner)), null);
  assert.equal(storage.getItem(DRAFT_STORAGE_KEY), null);
  assert.equal(storage.getItem(LEGACY_DRAFT_STORAGE_KEY), null);
});

test("a legacy local draft is migrated with the same seven-day deadline", () => {
  const updatedAt = Date.UTC(2026, 6, 18, 12, 0, 0);
  const storage = new MemoryStorage([
    [LEGACY_DRAFT_STORAGE_KEY, JSON.stringify({ ...draftValue, updatedAt })],
  ]);

  const draft = readDraft(storage, owner, updatedAt + 1);
  assert.equal(draft.expiresAt, updatedAt + DRAFT_TTL_MS);
  assert.equal(storage.getItem(LEGACY_DRAFT_STORAGE_KEY), null);
  assert.ok(storage.getItem(draftStorageKey(owner)));

  clearDraft(storage, owner);
  assert.equal(storage.getItem(draftStorageKey(owner)), null);
});

test("drafts are isolated between signed-in team members", () => {
  const storage = new MemoryStorage();
  const now = Date.UTC(2026, 6, 18, 12, 0, 0);
  saveDraft(storage, owner, draftValue, now);

  assert.equal(readDraft(storage, "another.representative@manchester.ac.uk", now + 1), null);
  assert.equal(readDraft(storage, owner, now + 1)?.subject, "Chemistry draft");
});
