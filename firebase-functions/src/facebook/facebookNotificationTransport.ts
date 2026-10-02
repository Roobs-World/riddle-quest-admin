import {isFacebookFeatureEnabled} from "./facebookFeatureFlags";

/** Provider request routes documented by the Zero Permissions notification API. */
export type FacebookNotificationOperation = "send" | "cancel";
/** Only a validated provider response can confirm an attempt. HTTP success alone cannot. */
export type FacebookNotificationAttempt = Readonly<{
  /** Distinguishes a prevented request from a confirmed or uncertain provider attempt. */
  outcome: "not-sent" | "confirmed" | "unconfirmed";
  /** Contains only a fixed diagnostic, never a recipient, credential, URL or provider body. */
  reason?: "inactive" | "invalid-request" | "contract-unavailable" | "unauthorized" | "credentials-unavailable";
  /** Records the response status without claiming delivery. */
  httpStatus?: number;
}>;
/** Game-owned content supplied by a trusted server caller, not a browser request. */
export type FacebookNotificationContent = Readonly<{
  /** Notification heading. */
  title: string;
  /** Notification body. */
  body: string;
}>;
/** Exact immutable scope available to server authorization and the provider decoder. */
export type FacebookNotificationAttemptScope = Readonly<{
  /** Provider action. */
  operation: FacebookNotificationOperation;
  /** Server-resolved recipient. */
  playerId: string;
  /** App-owned cancellation group. */
  label: string;
  /** Present only for scheduled sends, so capacity authorization can distinguish them. */
  scheduleInterval?: number;
}>;
/** Documented send fields; optional media/bot fields are not needed for current reminders. */
export type FacebookNotificationSend = Readonly<{
  /** Game-scoped Meta identity resolved by the server. */
  playerId: string;
  /** Approved localized content. */
  message: FacebookNotificationContent;
  /** App-owned grouping label used for cancellation. */
  label: string;
  /** Serialized game entry data, when needed. */
  payload?: string;
  /** Provider-relative delay in seconds, or absent for immediate notification. */
  scheduleInterval?: number;
}>;
/** Trusted server dependencies; this module has no public callable or default activation. */
export type FacebookNotificationTransportOptions = Readonly<{
  /** Configured app ID. */
  appId: string;
  /** Supplies an app token server-side without copying it into browser configuration. */
  getAppAccessToken: () => Promise<string>;
  /** Confirms rollout readiness for this protocol, including cancellation after sending is disabled. */
  isProviderReady: () => boolean;
  /** Authorizes the exact attempt; future wiring must check identity, consent, deletion and atomic pending capacity. */
  authorizeAttempt: (scope: FacebookNotificationAttemptScope) => Promise<boolean>;
  /** Decoder backed by real provider fixtures; no guessed success decoder is supplied. */
  confirmResponse?: (scope: FacebookNotificationAttemptScope, body: unknown) => boolean;
  /** Test seam for HTTP; the destination and redirect policy remain fixed. */
  fetch?: typeof fetch;
}>;
/** Local byte budget, not a claimed Meta copy limit. */
const REQUEST_BYTE_LIMIT = 4_096;
/** Bounds provider responses, including error bodies that may contain sensitive data. */
const RESPONSE_BYTE_LIMIT = 16_384;
/** Stops a slow provider attempt without automatically retrying it. */
const REQUEST_TIMEOUT_MS = 10_000;

/** Validates nonempty printable text while retaining translated Unicode copy. */
const printable = (value: unknown): value is string =>
  // eslint-disable-next-line no-control-regex -- Intentionally rejects control characters in notification copy.
  typeof value === "string" && value.trim().length > 0 && !/[\u0000-\u001f\u007f]/u.test(value);

/** Reads bounded UTF-8 JSON without leaking a provider error or token-bearing response URL. */
async function readResponse(response: Response): Promise<unknown> {
  if (!response.body) throw new Error("missing-response");
  /** Reader applies the limit to actual received bytes, not an untrusted content-length. */
  const reader = response.body.getReader();
  /** Chunks remain bounded by the local response budget. */
  const chunks: Uint8Array[] = [];
  /** Counts bytes before decoding or parsing. */
  let bytes = 0;
  try {
    for (;;) {
      /** Each provider chunk is checked before it is retained. */
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > RESPONSE_BYTE_LIMIT) throw new Error("oversized-response");
      chunks.push(chunk.value);
    }
    return JSON.parse(new TextDecoder("utf-8", {fatal: true}).decode(Buffer.concat(chunks)));
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}

/** Prepares fixed-host Meta POSTs. Uncertain attempts are returned once and must never be blindly retried. */
export function createFacebookNotificationTransport(options: FacebookNotificationTransportOptions) {
  /** Snapshot app scope before awaiting any caller dependency. */
  const appId = options.appId;
  /** Executes one attempt after validating and snapshotting its complete body before asynchronous work. */
  const attempt = async (
    operation: FacebookNotificationOperation,
    playerId: string,
    label: string,
    body: Record<string, unknown>,
  ): Promise<FacebookNotificationAttempt> => {
    if (
      typeof appId !== "string" || !/^[0-9]{5,30}$/u.test(appId) ||
      typeof playerId !== "string" || !/^[A-Za-z0-9_-]{1,256}$/u.test(playerId) ||
      typeof label !== "string" || !/^riddlequest_[a-z0-9_-]{1,52}$/u.test(label)
    ) return {outcome: "not-sent", reason: "invalid-request"};
    /** Serialized bytes cannot be changed while awaiting authorization. */
    const serialized = JSON.stringify(body);
    /** Authorization and decoding see the same immutable scope used for transmission. */
    const scope: FacebookNotificationAttemptScope = Object.freeze({
      operation, playerId, label,
      ...(typeof body.schedule_interval === "number" ? {scheduleInterval: body.schedule_interval} : {}),
    });
    if (Buffer.byteLength(serialized, "utf8") > REQUEST_BYTE_LIMIT) {
      return {outcome: "not-sent", reason: "invalid-request"};
    }
    if (!options.confirmResponse) return {outcome: "not-sent", reason: "contract-unavailable"};
    try {
      if (!options.isProviderReady() || (operation === "send" && !isFacebookFeatureEnabled("notifications"))) {
        return {outcome: "not-sent", reason: "inactive"};
      }
    } catch { return {outcome: "not-sent", reason: "inactive"}; }
    /** Token values remain local and are never returned, persisted or included in errors. */
    let token: string;
    try {
      token = await options.getAppAccessToken();
      if (typeof token !== "string" || !/^[\x21-\x7e]{1,4096}$/u.test(token)) throw new Error("invalid-token");
    } catch { return {outcome: "not-sent", reason: "credentials-unavailable"}; }
    try {
      if ((await options.authorizeAttempt(scope)) !== true) {
        return {outcome: "not-sent", reason: "unauthorized"};
      }
      if (!options.isProviderReady() || (operation === "send" && !isFacebookFeatureEnabled("notifications"))) {
        return {outcome: "not-sent", reason: "inactive"};
      }
    } catch { return {outcome: "not-sent", reason: "unauthorized"}; }
    /** Only the documented Gaming Domain endpoint can receive the app token. */
    const url = new URL(`https://graph.fb.gg/${appId}/${operation === "send" ? "notifications" : "notifications_cancel_all"}`);
    url.searchParams.set("access_token", token);
    /** Native fetch and streamed body reads share one bounded deadline. */
    const controller = new AbortController();
    /** Timer is cleared even when the provider or response decoder fails. */
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    /** Records status only when a response was actually observed. */
    let httpStatus: number | undefined;
    try {
      /** Redirects must not forward the credential to another destination. */
      const response = await (options.fetch ?? fetch)(url, {
        method: "POST", redirect: "manual", signal: controller.signal,
        headers: {"Content-Type": "application/json"}, body: serialized,
      });
      httpStatus = response.status;
      if (!response.ok || response.redirected) {
        await response.body?.cancel().catch(() => undefined);
        return {outcome: "unconfirmed", httpStatus};
      }
      /** Fixture-backed decoding never treats an unrecognized 2xx body as an acknowledgement. */
      const decoded = await readResponse(response);
      if (!controller.signal.aborted && options.confirmResponse(scope, decoded) === true) {
        return {outcome: "confirmed", httpStatus};
      }
    } catch { /* Provider outcome may be committed even after a timeout, parse error or transport failure. */ }
    finally { clearTimeout(timer); }
    return {outcome: "unconfirmed", ...(httpStatus === undefined ? {} : {httpStatus})};
  };
  return {
    /** Validates delay bounds and copies only documented fields into the provider request. */
    send: async (request: FacebookNotificationSend): Promise<FacebookNotificationAttempt> => {
      if (
        !printable(request.message?.title) || !printable(request.message?.body) ||
        (request.payload !== undefined && typeof request.payload !== "string") ||
        (request.scheduleInterval !== undefined &&
          (!Number.isSafeInteger(request.scheduleInterval) || request.scheduleInterval < 300 || request.scheduleInterval > 2_592_000))
      ) return {outcome: "not-sent", reason: "invalid-request"};
      return attempt("send", request.playerId, request.label, {
        player_id: request.playerId, message: {title: request.message.title, body: request.message.body},
        label: request.label,
        ...(request.payload === undefined ? {} : {payload: request.payload}),
        ...(request.scheduleInterval === undefined ? {} : {schedule_interval: request.scheduleInterval}),
      });
    },
    /** Cancels only one app-owned label; sending's emergency-off switch does not suppress cleanup. */
    cancel: (playerId: string, label: string): Promise<FacebookNotificationAttempt> =>
      attempt("cancel", playerId, label, {player_id: playerId, label}),
  };
}
