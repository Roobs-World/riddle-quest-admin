import {CampaignEnvelope, CampaignList, ManagementConfiguration, type CampaignRequest} from "./contracts";
import type {ManagementConnection} from "./supabase";
import {z} from "zod";

const errorMessages: Record<string, string> = {
  "operator-forbidden": "Your account does not have permission to manage notifications.",
  "admin-forbidden": "Your account does not have permission to manage notifications.",
  "admin-authentication-required": "Your sign-in has expired. Sign in again.",
  "authentication-required": "Your sign-in has expired. Sign in again.",
  "campaign-request-conflict": "This request was already used for a different message. Start a new notification.",
  "campaign-platform-not-admitted": "This platform is no longer available. Refresh the audience list.",
  "campaign-not-found": "This notification is no longer available. Refresh the list.",
  "notification-service-unavailable": "The push service is unavailable. Your draft is safe; please try again.",
  "operator-authentication-unavailable": "The server could not verify your sign-in. Please try again shortly. Signing out is not required.",
  "operator-membership-unavailable": "The server could not check workspace access. Please try again shortly.",
};

class WorkspaceAccessError extends Error {}

async function readResponse(response: Response): Promise<unknown> {
  const jsonResponse = response.headers.get("Content-Type")?.toLowerCase().startsWith("application/json");
  if (!jsonResponse) {
    void response.body?.cancel().catch(() => undefined);
    throw new Error(response.status === 401 || response.status === 403
      ? "Vercel blocked access to this deployment. Open the production website or renew your Vercel deployment sign-in."
      : "The management API is unavailable. Check the service deployment and try again.");
  }
  if (response.status === 401 || response.status === 403) {
    void response.body?.cancel().catch(() => undefined);
    throw new WorkspaceAccessError(response.status === 401 ? "Your sign-in has expired. Sign in again." : "Your account does not have permission to manage notifications.");
  }
  const reader = response.body?.getReader();
  if (!reader) throw new Error("The notification service returned an empty response.");
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    for (;;) {
      const part = await reader.read();
      if (part.done) break;
      bytes += part.value.byteLength;
      if (bytes > 512 * 1024) throw new Error("The notification service response was too large.");
      chunks.push(part.value);
    }
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
  const all = new Uint8Array(bytes);
  let offset = 0;
  chunks.forEach(chunk => {all.set(chunk, offset); offset += chunk.byteLength;});
  let value: unknown;
  try {value = JSON.parse(new TextDecoder().decode(all));}
  catch {throw new Error("The notification service returned an invalid response. Check the service deployment and try again.");}
  if (!response.ok) {
    const code = value && typeof value === "object" && "error" in value && typeof value.error === "string" ? value.error : "";
    throw new Error(errorMessages[code] ?? (response.status === 401 ? "Your sign-in has expired. Sign in again." :
      response.status === 403 ? "Your account does not have permission to manage notifications." :
        response.status === 429 ? "Too many requests. Please wait a moment and try again." :
          "The request could not be completed. Your draft is safe; please try again."));
  }
  return value;
}

function parseResponse<T extends z.ZodType>(schema: T, value: unknown): z.output<T> {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new Error("The notification service returned an unexpected response. Check that the website and service versions match, then try again.");
  return parsed.data;
}

/** Credentials never leave this same-origin management boundary. */
export function createManagementApi(connection: ManagementConnection, expectedUid: string, onAccessDenied?: (message: string) => void) {
  const request = async (path: string, signal: AbortSignal, method = "GET", input?: CampaignRequest) => {
    const url = new URL(path, window.location.origin);
    if (url.origin !== window.location.origin || !/^\/api\/management\/(?:config|campaigns(?:\/[a-f0-9]{64})?)$/u.test(url.pathname))
      throw new Error("Invalid management API route.");
    const controller = new AbortController();
    const abort = () => controller.abort();
    if (signal.aborted) abort(); else signal.addEventListener("abort", abort, {once: true});
    const timeout = window.setTimeout(abort, method === "POST" ? 55_000 : 25_000);
    try {
      const headers = await connection.requestHeaders(expectedUid);
      if (!connection.isCurrentUser(expectedUid) || signal.aborted) throw new Error("The signed-in account changed. Please try again.");
      const response = await fetch(url, {
        method, signal: controller.signal, credentials: "same-origin", redirect: "error", cache: "no-store",
        headers: {...headers, Accept: "application/json", ...(input ? {"Content-Type": "application/json"} : {})},
        ...(input ? {body: JSON.stringify(input)} : {}),
      });
      if (!connection.isCurrentUser(expectedUid) || signal.aborted) throw new Error("The signed-in account changed. Please try again.");
      return await readResponse(response);
    } catch (error) {
      if (error instanceof WorkspaceAccessError && !signal.aborted) onAccessDenied?.(error.message);
      if (controller.signal.aborted && !signal.aborted) throw new Error("The request took too long. Check the queue before retrying; your request ID is preserved.");
      throw error;
    } finally {
      window.clearTimeout(timeout);
      signal.removeEventListener("abort", abort);
    }
  };
  return {
    async configuration(signal: AbortSignal) {return parseResponse(ManagementConfiguration, await request("/api/management/config", signal));},
    async campaigns(view: "active" | "history", signal: AbortSignal, cursor?: string) {
      const query = new URLSearchParams({view, limit: "100", ...(cursor ? {cursor} : {})});
      return parseResponse(CampaignList, await request(`/api/management/campaigns?${query}`, signal));
    },
    async campaign(id: string, signal: AbortSignal) {return parseResponse(CampaignEnvelope, await request(`/api/management/campaigns/${id}`, signal)).campaign;},
    async create(input: CampaignRequest, signal: AbortSignal) {return parseResponse(CampaignEnvelope, await request("/api/management/campaigns", signal, "POST", input)).campaign;},
    async cancel(id: string, signal: AbortSignal) {return parseResponse(CampaignEnvelope, await request(`/api/management/campaigns/${id}`, signal, "DELETE")).campaign;},
  };
}
export type ManagementApi = ReturnType<typeof createManagementApi>;
