import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  VERIFICATION_CODE_PLACEHOLDER,
  canonicalizeEmailHtml,
  ensureMessageNumber,
  extractMessageNumber,
  extractVerificationCode,
  prepareEmailForArchive,
  sha256Hex,
  verificationCodeFromSha256,
} from "../shared/email-integrity.js";

const baseEmail = `<!doctype html><html><body>
<div>No. <span data-message-number="true">CHEM-SR-A1B2C3D4</span></div>
<p>Formal announcement</p>
<div>Code: <span data-verification-code="true">${VERIFICATION_CODE_PLACEHOLDER}</span></div>
</body></html>`;

test("message numbers use four secure random bytes as eight uppercase hexadecimal digits", () => {
  const randomSource = { getRandomValues(bytes) { bytes.set([0, 15, 160, 255]); return bytes; } };
  const source = baseEmail.replace("CHEM-SR-A1B2C3D4", "CHEM-SR-00000000");
  const result = ensureMessageNumber(source, { forceNew: true, randomSource });
  assert.equal(result.messageNumber, "CHEM-SR-000FA0FF");
  assert.equal(extractMessageNumber(result.html), "CHEM-SR-000FA0FF");
});

test("archive hash stays internal while its first 64 bits form the displayed verification code", async () => {
  const prepared = await prepareEmailForArchive(baseEmail);
  assert.match(prepared.sha256, /^[0-9A-F]{64}$/);
  assert.equal(prepared.verificationCode, verificationCodeFromSha256(prepared.sha256));
  assert.match(prepared.verificationCode, /^[0-9A-F]{4}(?:-[0-9A-F]{4}){3}$/);
  assert.equal(extractVerificationCode(prepared.html), prepared.verificationCode);
  assert.equal(prepared.html.includes(prepared.sha256), false);
  assert.equal(canonicalizeEmailHtml(prepared.html), prepared.canonicalHtml);
  assert.equal(prepared.sha256, await sha256Hex(prepared.canonicalHtml));
});

test("changing canonical content invalidates an existing verification code", async () => {
  const prepared = await prepareEmailForArchive(baseEmail);
  const tampered = prepared.html.replace("Formal announcement", "Changed announcement");
  const recomputed = await sha256Hex(canonicalizeEmailHtml(tampered));
  assert.notEqual(verificationCodeFromSha256(recomputed), extractVerificationCode(tampered));
});

test("integrity helpers reject missing or duplicate protected fields", async () => {
  await assert.rejects(() => prepareEmailForArchive(baseEmail.replace("data-verification-code", "data-removed-code")), /exactly one verification code/);
  assert.throws(() => extractMessageNumber(baseEmail.replace("</body>", '<span data-message-number="true">CHEM-SR-FFFFFFFF</span></body>')), /exactly one message number/);
});

test("the production initial template can generate a message number and archive verification code", async () => {
  const template = await readFile(new URL("../src/templates/student-union-announcement.html", import.meta.url), "utf8");
  const identified = ensureMessageNumber(template, { forceNew: true });
  const prepared = await prepareEmailForArchive(identified.html);
  assert.match(prepared.messageNumber, /^CHEM-SR-[0-9A-F]{8}$/);
  assert.equal((prepared.html.match(new RegExp(prepared.messageNumber, "g")) || []).length, 2);
  assert.match(prepared.verificationCode, /^[0-9A-F]{4}(?:-[0-9A-F]{4}){3}$/);
  assert.equal(prepared.html.includes("data-message-hash"), false);
});

test("a footer message-number reference must match the primary message number", async () => {
  const mismatched = baseEmail.replace("</body>", '<span data-message-number-copy="true">CHEM-SR-FFFFFFFF</span></body>');
  await assert.rejects(() => prepareEmailForArchive(mismatched), /references do not match/);
});
