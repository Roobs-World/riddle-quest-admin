import {timingSafeEqual} from "node:crypto";
import type {ProviderBridgeConfiguration} from "./configuration.js";
import {ApiError, bearer, header, type ApiRequest} from "./http.js";
import {ManagerDispatchResult} from "../../src/notifications/contracts/managerBridge.js";
import type {AndroidDispatch} from "../../platforms/native/android/server/notificationManagerProtocol.js";
import type {FacebookDispatch} from "../../platforms/web/facebook/server/notifications/managerProtocol.js";

export function requireProviderBridge(request: ApiRequest, platform: "android" | "facebook", configuration: ProviderBridgeConfiguration | null): void {
  if (header(request, "origin")) throw new ApiError(403, `${platform}-server-origin-required`);
  if (!configuration) throw new ApiError(503, `${platform}-bridge-unconfigured`);
  const supplied = Buffer.from(bearer(request)), expected = Buffer.from(configuration.secret);
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
    throw new ApiError(401, `${platform}-bridge-authentication-required`);
  }
}

/** The caller validates a provider-specific payload before sending to its trusted endpoint. */
export async function sendProviderNotification(input: FacebookDispatch | AndroidDispatch, configuration: ProviderBridgeConfiguration,
  signal: AbortSignal): Promise<import("zod").infer<typeof ManagerDispatchResult>> {
  try {
    const response = await fetch(configuration.endpoint, {method: "POST", redirect: "error", signal,
      headers: {Authorization: `Bearer ${configuration.secret}`, "Content-Type": "application/json"},
      body: JSON.stringify(input)});
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
    return ManagerDispatchResult.parse(JSON.parse(new TextDecoder("utf-8", {fatal: true}).decode(bytes)));
  } catch {return {outcome: "uncertain"};}
}
