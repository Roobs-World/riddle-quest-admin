/** Decoded budgets match the signed Firebase gateway's existing limits. */
export const REDDIT_REQUEST_BYTES = 72 * 1024;
export const REDDIT_RESPONSE_BYTES = 64 * 1024;

/** Base64 ciphertext includes a 16-byte GCM tag and a bounded JSON envelope. */
export const redditProtectedWireBytes = (decodedBytes: number): number => Math.ceil((decodedBytes + 16) / 3) * 4 + 256;

/** Rejects oversized bodies while reading, without trusting content-length. */
export async function readRedditJson(body: ReadableStream<Uint8Array> | null, maximumBytes: number): Promise<unknown> {
  if (!body) throw new Error("reddit-payload-invalid");
  const reader = body.getReader();
  const decoder = new TextDecoder("utf-8", {fatal: true});
  const chunks: string[] = [];
  let bytes = 0;
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > maximumBytes) throw new Error("reddit-payload-too-large");
      chunks.push(decoder.decode(chunk.value, {stream: true}));
    }
    chunks.push(decoder.decode());
    return JSON.parse(chunks.join(""));
  } finally {
    void reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}

/** Checks the decoded UTF-8 JSON budget before encryption or gateway signing. */
export function serializeRedditPayload(value: unknown, maximumBytes: number): string {
  const text = JSON.stringify(value);
  if (typeof text !== "string") throw new Error("reddit-payload-invalid");
  if (new TextEncoder().encode(text).byteLength > maximumBytes) throw new Error("reddit-payload-too-large");
  return text;
}
