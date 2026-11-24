import {z} from "zod";
import {AndroidDispatch, AndroidDispatchResult} from "./notificationManagerProtocol.js";

/** The hosted manager sees opaque references; Firebase alone resolves tokens and rechecks consent. */
export async function sendAndroidManagerNotification(input: z.infer<typeof AndroidDispatch>,
  configuration: Readonly<{endpoint: string; secret: string}>, signal: AbortSignal): Promise<z.infer<typeof AndroidDispatchResult>> {
  try {
    const response = await fetch(configuration.endpoint, {method: "POST", redirect: "error", signal,
      headers: {Authorization: `Bearer ${configuration.secret}`, "Content-Type": "application/json"},
      body: JSON.stringify(AndroidDispatch.parse(input))});
    if (!response.ok) {
      void response.body?.cancel().catch(() => undefined);
      return {outcome: response.status >= 500 || response.status === 408 ? "uncertain" : "failed"};
    }
    const reader = response.body?.getReader();
    if (!reader) return {outcome: "uncertain"};
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      for (;;) {
        const next = await reader.read();
        if (next.done) break;
        size += next.value.byteLength;
        if (size > 2048) {void reader.cancel().catch(() => undefined); return {outcome: "uncertain"};}
        chunks.push(next.value);
      }
    } finally {reader.releaseLock();}
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {bytes.set(chunk, offset); offset += chunk.byteLength;}
    return AndroidDispatchResult.parse(JSON.parse(new TextDecoder("utf-8", {fatal: true}).decode(bytes)));
  } catch {return {outcome: "uncertain"};}
}
