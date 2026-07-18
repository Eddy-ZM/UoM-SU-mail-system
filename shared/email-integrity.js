export const MESSAGE_NUMBER_PREFIX = "CHEM-SR-";
export const VERIFICATION_CODE_PLACEHOLDER = "PENDING-ARCHIVE";

const MESSAGE_NUMBER_RE = /^CHEM-SR-[0-9A-F]{8}$/;
const SHA256_RE = /^[0-9A-F]{64}$/;
const MESSAGE_NUMBER_TAG_RE = /(<span\b(?=[^>]*\bdata-message-number\s*=\s*(?:"true"|'true'|true))[^>]*>)([\s\S]*?)(<\/span>)/gi;
const MESSAGE_NUMBER_COPY_TAG_RE = /(<span\b(?=[^>]*\bdata-message-number-copy\s*=\s*(?:"true"|'true'|true))[^>]*>)([\s\S]*?)(<\/span>)/gi;
const VERIFICATION_CODE_TAG_RE = /(<span\b(?=[^>]*\bdata-verification-code\s*=\s*(?:"true"|'true'|true))[^>]*>)([\s\S]*?)(<\/span>)/gi;
const VERIFICATION_CODE_RE = /^[0-9A-F]{4}(?:-[0-9A-F]{4}){3}$/;

function replaceSingleTaggedValue(html, pattern, value, fieldName) {
  let matches = 0;
  const next = String(html || "").replace(pattern, (_match, opening, _current, closing) => {
    matches += 1;
    return `${opening}${value}${closing}`;
  });
  if (matches !== 1) throw new Error(`Email must contain exactly one ${fieldName} field.`);
  return next;
}

function readSingleTaggedValue(html, pattern, fieldName) {
  const values = [...String(html || "").matchAll(pattern)].map((match) => match[2].trim());
  if (values.length !== 1) throw new Error(`Email must contain exactly one ${fieldName} field.`);
  return values[0];
}

export function generateMessageNumber(randomSource = globalThis.crypto) {
  if (!randomSource?.getRandomValues) throw new Error("A cryptographically secure random source is required.");
  const bytes = new Uint8Array(4);
  randomSource.getRandomValues(bytes);
  return `${MESSAGE_NUMBER_PREFIX}${[...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("").toUpperCase()}`;
}

export function isValidMessageNumber(value) {
  return MESSAGE_NUMBER_RE.test(String(value || "").trim());
}

export function extractMessageNumber(html) {
  const value = readSingleTaggedValue(html, MESSAGE_NUMBER_TAG_RE, "message number");
  if (!isValidMessageNumber(value)) throw new Error("Email message number is invalid.");
  const copies = [...String(html || "").matchAll(MESSAGE_NUMBER_COPY_TAG_RE)].map((match) => match[2].trim().toUpperCase());
  if (copies.some((copy) => copy !== value)) throw new Error("Email message-number references do not match.");
  return value;
}

export function setMessageNumber(html, messageNumber) {
  const normalized = String(messageNumber || "").trim().toUpperCase();
  if (!isValidMessageNumber(normalized)) throw new Error("Email message number is invalid.");
  return replaceSingleTaggedValue(html, MESSAGE_NUMBER_TAG_RE, normalized, "message number")
    .replace(MESSAGE_NUMBER_COPY_TAG_RE, (_match, opening, _current, closing) => `${opening}${normalized}${closing}`);
}

export function ensureMessageNumber(html, { forceNew = false, randomSource = globalThis.crypto } = {}) {
  const source = String(html || "");
  if (!forceNew) {
    try {
      const existing = extractMessageNumber(source);
      return { html: source, messageNumber: existing };
    } catch {
      // Missing and legacy identifiers are replaced below.
    }
  }

  const messageNumber = generateMessageNumber(randomSource);
  try {
    return { html: setMessageNumber(source, messageNumber), messageNumber };
  } catch {
    const legacyPattern = /(?:Notice|No\.)\s+CHEM-SR-[A-Z0-9-]+/i;
    if (!legacyPattern.test(source)) throw new Error("Email message-number field is missing.");
    return {
      html: source.replace(legacyPattern, `No. <span data-message-number="true">${messageNumber}</span>`),
      messageNumber,
    };
  }
}

export function verificationCodeFromSha256(sha256) {
  const normalized = String(sha256 || "").trim().toUpperCase();
  if (!SHA256_RE.test(normalized)) throw new Error("Email SHA-256 value is invalid.");
  return normalized.slice(0, 16).match(/.{4}/g).join("-");
}

export function isValidVerificationCode(value) {
  return VERIFICATION_CODE_RE.test(String(value || "").trim().toUpperCase());
}

export function extractVerificationCode(html) {
  const value = readSingleTaggedValue(html, VERIFICATION_CODE_TAG_RE, "verification code").toUpperCase();
  if (!isValidVerificationCode(value)) throw new Error("Email verification code is invalid.");
  return value;
}

export function setVerificationCode(html, verificationCode) {
  const normalized = String(verificationCode || "").trim().toUpperCase();
  if (!isValidVerificationCode(normalized)) throw new Error("Email verification code is invalid.");
  return replaceSingleTaggedValue(html, VERIFICATION_CODE_TAG_RE, normalized, "verification code");
}

export function markVerificationCodePending(html) {
  return replaceSingleTaggedValue(html, VERIFICATION_CODE_TAG_RE, VERIFICATION_CODE_PLACEHOLDER, "verification code");
}

export function canonicalizeEmailHtml(html) {
  return replaceSingleTaggedValue(
    String(html || ""),
    VERIFICATION_CODE_TAG_RE,
    VERIFICATION_CODE_PLACEHOLDER,
    "verification code",
  );
}

export async function sha256Hex(value, cryptoImplementation = globalThis.crypto) {
  if (!cryptoImplementation?.subtle?.digest) throw new Error("SHA-256 is unavailable.");
  const bytes = new TextEncoder().encode(String(value));
  const digest = await cryptoImplementation.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("").toUpperCase();
}

export async function prepareEmailForArchive(html, cryptoImplementation = globalThis.crypto) {
  const canonicalHtml = canonicalizeEmailHtml(html);
  const sha256 = await sha256Hex(canonicalHtml, cryptoImplementation);
  const verificationCode = verificationCodeFromSha256(sha256);
  return {
    canonicalHtml,
    sha256,
    verificationCode,
    html: setVerificationCode(canonicalHtml, verificationCode),
    messageNumber: extractMessageNumber(canonicalHtml),
  };
}
