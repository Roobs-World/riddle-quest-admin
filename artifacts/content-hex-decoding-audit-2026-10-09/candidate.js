"use strict";
/// <reference lib="dom" />
Object.defineProperty(exports, "__esModule", { value: true });
exports.protectContent = protectContent;
exports.readProtectedContent = readProtectedContent;
exports.contentProtectionRequest = contentProtectionRequest;
/** Public client key: deliberately not a server secret or a competitive anti-cheat boundary. */
const keyBytes = new Uint8Array([173, 56, 219, 41, 7, 192, 101, 254, 38, 140, 77, 184, 209, 63, 116, 5,
    234, 90, 163, 21, 198, 44, 127, 240, 66, 159, 12, 182, 95, 228, 49, 137]);
/** Binds ciphertext to this protocol rather than another use of AES-GCM. */
const additionalData = new TextEncoder().encode("riddle-quest-content-v1");
/** Encodes bytes without Node, provider SDKs, or large argument lists. */
const hex = (bytes) => Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
/** Rejects malformed envelopes before Web Crypto or JSON parsing. */
const unhex = (value) => {
    if (typeof value !== "string" || !/^(?:[a-f0-9]{2})+$/u.test(value))
        throw new Error("content-protection-invalid");
    const bytes = new Uint8Array(value.length / 2);
  for (let index = 0; index < bytes.length; index++) {
    const high = value.charCodeAt(index * 2), low = value.charCodeAt(index * 2 + 1);
    bytes[index] = ((high < 58 ? high - 48 : high - 87) << 4) | (low < 58 ? low - 48 : low - 87);
  }
  return bytes;
};
/** Imports an unextractable runtime key; the published bytes remain recoverable from client code. */
const key = () => globalThis.crypto.subtle.importKey("raw", keyBytes, "AES-GCM", false, ["encrypt", "decrypt"]);
/** Encrypts trusted content with a fresh IV for every response or bundled locale. */
async function protectContent(value) {
    /** Unique per-message nonce. */
    const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
    /** Authenticated ciphertext including its tag. */
    const data = await globalThis.crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData }, await key(), new TextEncoder().encode(JSON.stringify(value)));
    return { contentProtection: 1, iv: hex(iv), data: hex(new Uint8Array(data)) };
}
/** Decodes protected content before ordinary domain validation; permits legacy plaintext responses. */
async function readProtectedContent(value) {
    if (!value || typeof value !== "object" || !("contentProtection" in value))
        return value;
    /** Untrusted serialized transport envelope. */
    const envelope = value;
    if (envelope.contentProtection !== 1 || Object.keys(envelope).sort().join(",") !== "contentProtection,data,iv")
        throw new Error("content-protection-invalid");
    /** Validated binary nonce and ciphertext. */
    const iv = unhex(envelope.iv), data = unhex(envelope.data);
    if (iv.length !== 12 || data.length < 17)
        throw new Error("content-protection-invalid");
    /** Authenticated UTF-8 bytes. */
    const plain = await globalThis.crypto.subtle.decrypt({ name: "AES-GCM", iv, additionalData }, await key(), data);
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(plain));
}
/** Removes transport negotiation before strict gameplay request validation. */
function contentProtectionRequest(data) {
    if (!data || typeof data !== "object" || !("contentProtection" in data))
        return { data, protected: false };
    /** Client wire-format selection and original domain input. */
    const { contentProtection, ...payload } = data;
    if (contentProtection !== 1)
        throw new Error("content-protection-version-unsupported");
    return { data: payload, protected: true };
}
