export const MESSAGE_NUMBER_PREFIX = "CHEM-SR-";
export const MESSAGE_NUMBER_PLACEHOLDER = `${MESSAGE_NUMBER_PREFIX}00000000`;
export const VERIFICATION_CODE_PLACEHOLDER = "PENDING-ARCHIVE";
export const SHA256_PLACEHOLDER = "PENDING-SHA256";

const MESSAGE_NUMBER_RE = /^CHEM-SR-[0-9A-F]{8}$/;
const SHA256_RE = /^[0-9A-F]{64}$/;
const MESSAGE_NUMBER_TAG_RE = /(<span\b(?=[^>]*\bdata-message-number\s*=\s*(?:"true"|'true'|true))[^>]*>)([\s\S]*?)(<\/span>)/gi;
const MESSAGE_NUMBER_COPY_TAG_RE = /(<span\b(?=[^>]*\bdata-message-number-copy\s*=\s*(?:"true"|'true'|true))[^>]*>)([\s\S]*?)(<\/span>)/gi;
const VERIFICATION_CODE_TAG_RE = /(<span\b(?=[^>]*\bdata-verification-code\s*=\s*(?:"true"|'true'|true))[^>]*>)([\s\S]*?)(<\/span>)/gi;
const VERIFICATION_CODE_RE = /^[0-9A-F]{4}(?:-[0-9A-F]{4}){3}$/;
const INTEGRITY_METADATA_TAG_RE = /(<!--\s*SRMS-METADATA\s+message-number=")([^"]+)("\s+sha256=")([^"]+)("\s*-->)/gi;
const INTEGRITY_METADATA_ANY_RE = /<!--\s*SRMS-METADATA\b[\s\S]*?-->/gi;
const INTEGRITY_METADATA_PRESENT_RE = /<!--\s*SRMS-METADATA\b/i;

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

function readIntegrityMetadataValue(html) {
  const values = [...String(html || "").matchAll(INTEGRITY_METADATA_TAG_RE)].map((match) => ({
    messageNumber: match[2].trim().toUpperCase(),
    sha256: match[4].trim().toUpperCase(),
  }));
  if (values.length !== 1) throw new Error("Email must contain exactly one hidden integrity metadata field.");
  return values[0];
}

export function ensureIntegrityMetadata(html) {
  const source = String(html || "");
  const matches = [...source.matchAll(INTEGRITY_METADATA_TAG_RE)];
  if (matches.length === 1) return source;
  if (matches.length > 1 || INTEGRITY_METADATA_PRESENT_RE.test(source)) {
    throw new Error("Email hidden integrity metadata is malformed or duplicated.");
  }
  const visibleMessageNumber = readSingleTaggedValue(source, MESSAGE_NUMBER_TAG_RE, "message number").trim().toUpperCase();
  if (!MESSAGE_NUMBER_RE.test(visibleMessageNumber)) throw new Error("Email message number is invalid.");
  const metadata = `<!-- SRMS-METADATA message-number="${visibleMessageNumber}" sha256="${SHA256_PLACEHOLDER}" -->`;
  if (!/<\/html>\s*$/i.test(source)) throw new Error("Email document closing tag is missing.");
  return source.replace(/<\/html>\s*$/i, `${metadata}\n</html>`);
}

export function resetIntegrityMetadata(html) {
  return ensureIntegrityMetadata(String(html || "").replace(INTEGRITY_METADATA_ANY_RE, ""));
}

export function extractIntegrityMetadata(html) {
  const metadata = readIntegrityMetadataValue(html);
  if (!isValidMessageNumber(metadata.messageNumber)) throw new Error("Email hidden message number is invalid.");
  if (metadata.sha256 !== SHA256_PLACEHOLDER && !SHA256_RE.test(metadata.sha256)) {
    throw new Error("Email hidden SHA-256 value is invalid.");
  }
  return metadata;
}

export function extractEmbeddedSha256(html) {
  const { sha256 } = extractIntegrityMetadata(html);
  if (!SHA256_RE.test(sha256)) throw new Error("Email hidden SHA-256 value is pending or invalid.");
  return sha256;
}

export function setEmbeddedSha256(html, sha256) {
  const normalized = String(sha256 || "").trim().toUpperCase();
  if (normalized !== SHA256_PLACEHOLDER && !SHA256_RE.test(normalized)) {
    throw new Error("Email SHA-256 value is invalid.");
  }
  let matches = 0;
  const next = String(html || "").replace(INTEGRITY_METADATA_TAG_RE, (_match, opening, messageNumber, middle, _current, closing) => {
    matches += 1;
    return `${opening}${messageNumber}${middle}${normalized}${closing}`;
  });
  if (matches !== 1) throw new Error("Email must contain exactly one hidden integrity metadata field.");
  return next;
}

export function generateMessageNumber(randomSource = globalThis.crypto) {
  if (!randomSource?.getRandomValues) throw new Error("A cryptographically secure random source is required.");
  const bytes = new Uint8Array(4);
  for (let attempt = 0; attempt < 8; attempt += 1) {
    randomSource.getRandomValues(bytes);
    const messageNumber = `${MESSAGE_NUMBER_PREFIX}${[...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("").toUpperCase()}`;
    if (messageNumber !== MESSAGE_NUMBER_PLACEHOLDER) return messageNumber;
  }
  throw new Error("The secure random source repeatedly produced the reserved message-number placeholder.");
}

export function isValidMessageNumber(value) {
  const normalized = String(value || "").trim();
  return normalized !== MESSAGE_NUMBER_PLACEHOLDER && MESSAGE_NUMBER_RE.test(normalized);
}

export function downloadFilenameForMessageNumber(messageNumber) {
  const normalized = String(messageNumber || "").trim().toUpperCase();
  if (!isValidMessageNumber(normalized)) throw new Error("Email message number is invalid.");
  return `UoM-${normalized}.html`;
}

export function extractMessageNumber(html) {
  const value = readSingleTaggedValue(html, MESSAGE_NUMBER_TAG_RE, "message number");
  if (!isValidMessageNumber(value)) throw new Error("Email message number is invalid.");
  const copies = [...String(html || "").matchAll(MESSAGE_NUMBER_COPY_TAG_RE)].map((match) => match[2].trim().toUpperCase());
  if (copies.some((copy) => copy !== value)) throw new Error("Email message-number references do not match.");
  if (extractIntegrityMetadata(html).messageNumber !== value) throw new Error("Email hidden message number does not match.");
  return value;
}

export function setMessageNumber(html, messageNumber) {
  const normalized = String(messageNumber || "").trim().toUpperCase();
  if (!isValidMessageNumber(normalized)) throw new Error("Email message number is invalid.");
  const source = ensureIntegrityMetadata(html);
  const visibleUpdated = replaceSingleTaggedValue(source, MESSAGE_NUMBER_TAG_RE, normalized, "message number")
    .replace(MESSAGE_NUMBER_COPY_TAG_RE, (_match, opening, _current, closing) => `${opening}${normalized}${closing}`);
  let matches = 0;
  const metadataUpdated = visibleUpdated.replace(INTEGRITY_METADATA_TAG_RE, (_match, opening, _current, middle, sha256, closing) => {
    matches += 1;
    return `${opening}${normalized}${middle}${sha256}${closing}`;
  });
  if (matches !== 1) throw new Error("Email must contain exactly one hidden integrity metadata field.");
  return metadataUpdated;
}

export function ensureMessageNumber(html, { forceNew = false, randomSource = globalThis.crypto } = {}) {
  const originalSource = String(html || "");
  let source = originalSource;
  try {
    source = ensureIntegrityMetadata(originalSource);
  } catch {
    // A legacy plain-text identifier is upgraded after it is converted below.
  }
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
    const upgraded = source.replace(legacyPattern, `No. <span data-message-number="true">${messageNumber}</span>`);
    return { html: ensureIntegrityMetadata(upgraded), messageNumber };
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
  const codePending = replaceSingleTaggedValue(html, VERIFICATION_CODE_TAG_RE, VERIFICATION_CODE_PLACEHOLDER, "verification code");
  return setEmbeddedSha256(codePending, SHA256_PLACEHOLDER);
}

export function canonicalizeEmailHtml(html) {
  const codePending = replaceSingleTaggedValue(
    String(html || ""),
    VERIFICATION_CODE_TAG_RE,
    VERIFICATION_CODE_PLACEHOLDER,
    "verification code",
  );
  return setEmbeddedSha256(codePending, SHA256_PLACEHOLDER);
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
    html: setEmbeddedSha256(setVerificationCode(canonicalHtml, verificationCode), sha256),
    messageNumber: extractMessageNumber(canonicalHtml),
  };
}
