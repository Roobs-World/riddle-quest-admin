import {z} from "zod";
import {HOSTED_PUSH_API_BASE, type HostedPushReceipt, type HostedPushSubscription, type HostedPushTarget} from "../../contracts/hostedPush";
import type {HostedPushTransport, HostedPushTransportFactory} from "./transport";

const MAX_RESPONSE_BYTES = 8192;
const Receipt = z.object({installationId: z.string().regex(/^[A-Za-z0-9_-]{1,128}$/), revision: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER)}).strict();

/** Routes are supplied by the service integration instead of guessed from its deployment host. */
export type HostedPushHttpRoutes = {
  configuration: string;
  subscribe: string;
  unsubscribe: string;
  activity: string;
};

function serviceOrigin(value: string): string {
  const url = new URL(value);
  const localNames = new Set(["localhost", "127.0.0.1", "[::1]"]);
  const localDevelopment = location.protocol === "http:" && localNames.has(location.hostname) && localNames.has(url.hostname);
  if (url.username || url.password || url.pathname !== "/" || url.search || url.hash ||
      !(url.protocol === "https:" || url.protocol === "http:" && localDevelopment)) {
    throw new Error("hosted-push-service-origin-invalid");
  }
  return url.origin;
}

/** A missing deployment URL leaves hosted delivery explicitly unconfigured. */
export function createConfiguredHostedPushTransportFactory(serviceUrl?: string): HostedPushTransportFactory | undefined {
  if (!serviceUrl?.trim()) return undefined;
  const origin = serviceOrigin(serviceUrl.trim());
  const routes: HostedPushHttpRoutes = {
    configuration: `${HOSTED_PUSH_API_BASE}/config`,
    subscribe: `${HOSTED_PUSH_API_BASE}/subscribe`,
    unsubscribe: `${HOSTED_PUSH_API_BASE}/unsubscribe`,
    activity: `${HOSTED_PUSH_API_BASE}/activity`,
  };
  return installation => createHostedPushApi({...installation, routes, serviceOrigin: origin});
}

async function readJson(response: Response): Promise<unknown> {
  if (!response.ok || !response.headers.get("Content-Type")?.toLowerCase().startsWith("application/json"))
    throw new Error("hosted-push-response-unavailable");
  const reader = response.body?.getReader();
  if (!reader) throw new Error("hosted-push-response-empty");
  const decoder = new TextDecoder();
  let text = "", bytes = 0;
  try {
    for (;;) {
      const part = await reader.read();
      if (part.done) break;
      bytes += part.value.byteLength;
      if (bytes > MAX_RESPONSE_BYTES) throw new Error("hosted-push-response-too-large");
      text += decoder.decode(part.value, {stream: true});
    }
    text += decoder.decode();
    const value: unknown = JSON.parse(text);
    return value;
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}

/** This is the only browser HTTP boundary admitted by hosted-notification builds. */
export function createHostedPushApi({target, token, routes, serviceOrigin: configuredOrigin}: {
  target: HostedPushTarget;
  token: string;
  routes: HostedPushHttpRoutes;
  serviceOrigin?: string;
}): HostedPushTransport {
  if (!/^[a-f0-9]{64}$/.test(token)) throw new Error("hosted-push-credential-invalid");
  const origin = configuredOrigin === undefined ? location.origin : serviceOrigin(configuredOrigin);
  const request = async (action: "config" | "subscribe" | "unsubscribe" | "activity", input: unknown, signal: AbortSignal): Promise<unknown> => {
    const route = routes[action === "config" ? "configuration" : action];
    if (!/^\/[A-Za-z0-9_./-]+$/u.test(route) || route.startsWith("//") || route.split("/").some(segment => segment === "." || segment === ".."))
      throw new Error("hosted-push-route-invalid");
    const url = new URL(route, origin);
    if (url.origin !== origin || url.pathname !== route)
      throw new Error("hosted-push-route-invalid");
    if (action === "config") url.searchParams.set("target", target);
    const controller = new AbortController();
    const abort = () => controller.abort();
    if (signal.aborted) controller.abort();
    else signal.addEventListener("abort", abort, {once: true});
    const timer = globalThis.setTimeout(abort, 8000);
    try {
      const response = await fetch(url, {
        method: action === "config" ? "GET" : "POST",
        mode: origin === location.origin ? "same-origin" : "cors", credentials: "omit", redirect: "error", cache: "no-store",
        headers: {Accept: "application/json", Authorization: `Bearer ${token}`, ...(action === "config" ? {} : {"Content-Type": "application/json"})},
        ...(action === "config" ? {} : {body: JSON.stringify(input)}), signal: controller.signal,
      });
      return await readJson(response);
    } finally {
      clearTimeout(timer);
      signal.removeEventListener("abort", abort);
    }
  };
  return {
    async configuration(signal: AbortSignal) {
      const schema = z.object({version: z.literal(1), target: z.literal(target), publicKey: z.string().regex(/^[A-Za-z0-9_-]{87}=?$/)}).strict();
      return schema.parse(await request("config", null, signal));
    },
    async subscribe(input: {revision: number; locale: string; subscription: HostedPushSubscription}, signal: AbortSignal): Promise<HostedPushReceipt> {
      return Receipt.parse(await request("subscribe", {target, ...input}, signal));
    },
    async unsubscribe(revision: number, signal: AbortSignal): Promise<HostedPushReceipt> {
      return Receipt.parse(await request("unsubscribe", {target, revision}, signal));
    },
    async activity(locale: string, signal: AbortSignal): Promise<void> {
      z.object({ok: z.literal(true)}).strict().parse(await request("activity", {target, locale}, signal));
    },
  };
}
