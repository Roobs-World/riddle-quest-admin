/// <reference lib="dom" />
import {z} from "zod";

export const MAX_PAYLOAD_BYTES = 1024 * 1024;
const maximumCiphertextCharacters = 4 * Math.ceil((MAX_PAYLOAD_BYTES + 16) / 3);
const requestIdPattern = /^[a-f0-9]{32}$/u;
const base64Pattern = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u;

export const PayloadEnvelopeSchema = z.object({
  payloadProtection: z.literal(1),
  requestId: z.string().length(32).regex(requestIdPattern),
  iv: z.string().length(24).regex(/^[a-f0-9]{24}$/u),
  data: z.string().min(24).max(maximumCiphertextCharacters).regex(base64Pattern),
}).strict();
export type PayloadEnvelope = z.infer<typeof PayloadEnvelopeSchema>;
export type PayloadContext = Readonly<{
  operation: string;
  direction: "request" | "response" | "chunk";
  requestId: string;
}>;

// Published client material only deters casual inspection. TLS and server authorization remain required.
const keyBytes = new Uint8Array([54, 182, 93, 216, 171, 44, 18, 97, 208, 71, 239, 130, 163, 56, 202, 11,
  125, 31, 226, 69, 154, 240, 106, 195, 27, 188, 79, 213, 142, 9, 116, 233]);
let importedKey: Promise<CryptoKey> | undefined;
const key = () => importedKey ??= globalThis.crypto.subtle.importKey("raw", keyBytes, "AES-GCM", false, ["encrypt", "decrypt"]);
const hex = (bytes: Uint8Array): string => Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
const base64 = (bytes: Uint8Array): string => {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
};
const additionalData = (context: PayloadContext): Uint8Array<ArrayBuffer> => {
  if (!requestIdPattern.test(context.requestId) || !context.operation || context.operation.length > 512 ||
      !["request", "response", "chunk"].includes(context.direction)) throw new Error("payload-protection-context-invalid");
  return new TextEncoder().encode(JSON.stringify(["riddle-quest-payload-v1", context.operation, context.direction, context.requestId]));
};

export const createPayloadRequestId = (): string => hex(globalThis.crypto.getRandomValues(new Uint8Array(16)));

/** Detects negotiation only. Marked inputs must pass strict parsing before use. */
export function isProtectedPayload(value: unknown): boolean {
  return typeof value === "object" && value !== null && "payloadProtection" in value;
}

export function parsePayloadEnvelope(value: unknown): PayloadEnvelope {
  const parsed = PayloadEnvelopeSchema.safeParse(value);
  if (!parsed.success) throw new Error("payload-protection-invalid");
  return parsed.data;
}

export async function protectPayload(value: unknown, context: PayloadContext): Promise<PayloadEnvelope> {
  const serialized = JSON.stringify(value === undefined ? null : value);
  if (serialized === undefined || serialized.length > MAX_PAYLOAD_BYTES) throw new Error("payload-protection-too-large");
  const bytes = new TextEncoder().encode(serialized);
  if (bytes.byteLength > MAX_PAYLOAD_BYTES) throw new Error("payload-protection-too-large");
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await globalThis.crypto.subtle.encrypt({name: "AES-GCM", iv, additionalData: additionalData(context)}, await key(), bytes);
  return {payloadProtection: 1, requestId: context.requestId, iv: hex(iv), data: base64(new Uint8Array(encrypted))};
}

/** New callers reject plaintext, malformed envelopes and another request's response. */
export async function readProtectedPayload(value: unknown, context: PayloadContext): Promise<unknown> {
  const envelope = parsePayloadEnvelope(value);
  if (envelope.requestId !== context.requestId) throw new Error("payload-protection-request-mismatch");
  const binary = atob(envelope.data);
  const data = Uint8Array.from(binary, character => character.charCodeAt(0));
  if (data.byteLength < 17 || data.byteLength > MAX_PAYLOAD_BYTES + 16 || base64(data) !== envelope.data)
    throw new Error("payload-protection-invalid");
  const iv = new Uint8Array(12);
  for (let index = 0; index < iv.length; index++) iv[index] = Number.parseInt(envelope.iv.slice(index * 2, index * 2 + 2), 16);
  let plain: ArrayBuffer;
  try {
    plain = await globalThis.crypto.subtle.decrypt({name: "AES-GCM", iv, additionalData: additionalData(context)}, await key(), data);
  } catch {throw new Error("payload-protection-invalid");}
  if (plain.byteLength > MAX_PAYLOAD_BYTES) throw new Error("payload-protection-too-large");
  try {return JSON.parse(new TextDecoder("utf-8", {fatal: true}).decode(plain));}
  catch {throw new Error("payload-protection-invalid");}
}
