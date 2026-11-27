type SubscriptionEntitlementOptions = {
  projectId: string;
  uid: string;
  getIdToken: () => Promise<string>;
  getAppCheckToken: () => Promise<string>;
  isActive: () => boolean;
  fetch?: typeof globalThis.fetch;
};

const unavailable = () => new Error("Facebook subscription entitlement is unavailable.");
const deadlineMillis = 8_000;
const maximumResponseBytes = 8_192;
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const isCredential = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0 && value.length <= 16_384 && /^[A-Za-z0-9._-]+$/.test(value);

function readEntitlement(document: unknown, expectedName: string): boolean {
  if (!isRecord(document) || document.name !== expectedName ||
      Object.keys(document).some((key) => !["name", "fields", "createTime", "updateTime"].includes(key)) ||
      (document.createTime !== undefined && typeof document.createTime !== "string") ||
      (document.updateTime !== undefined && typeof document.updateTime !== "string")) {
    throw unavailable();
  }
  const fields = document.fields;
  if (fields === undefined) return false;
  if (!isRecord(fields) || Object.keys(fields).some((key) => key !== "hasActiveSubscription")) {
    throw unavailable();
  }
  if (!Object.hasOwn(fields, "hasActiveSubscription")) return false;
  const value = fields.hasActiveSubscription;
  if (!isRecord(value) || Object.keys(value).length !== 1 || typeof value.booleanValue !== "boolean") {
    throw unavailable();
  }
  return value.booleanValue;
}

async function readDocument(response: Response, signal: AbortSignal, checkActive: () => void): Promise<unknown> {
  if (!response.body) throw unavailable();
  const reader = response.body.getReader();
  const cancel = () => {void reader.cancel().catch(() => undefined);};
  signal.addEventListener("abort", cancel, {once: true});
  let complete = false;
  try {
    const decoder = new TextDecoder("utf-8", {fatal: true});
    let bytes = 0;
    let text = "";
    while (true) {
      checkActive();
      const chunk = await reader.read();
      checkActive();
      if (chunk.done) {
        complete = true;
        return JSON.parse(text + decoder.decode());
      }
      bytes += chunk.value.byteLength;
      if (bytes > maximumResponseBytes) throw unavailable();
      text += decoder.decode(chunk.value, {stream: true});
    }
  } finally {
    signal.removeEventListener("abort", cancel);
    if (!complete) cancel();
    reader.releaseLock();
  }
}

export function createFacebookSubscriptionEntitlement(options: SubscriptionEntitlementOptions) {
  const {projectId, uid, getIdToken, getAppCheckToken, isActive} = options;
  const request = options.fetch ?? globalThis.fetch;
  const expectedName = `projects/${projectId}/databases/(default)/documents/users/${uid}`;
  let pending: Promise<boolean> | undefined;
  let retired = false;
  let cancel: (() => void) | undefined;
  const read = async (controller: AbortController, deadline: number): Promise<boolean> => {
    const {signal} = controller;
    let response: Response | undefined;
    const checkActive = () => {
      if (retired || signal.aborted || Date.now() >= deadline || !isActive()) throw unavailable();
    };
    try {
      checkActive();
      if (!/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(projectId) || typeof uid !== "string" ||
          uid.length < 1 || uid.length > 128 || /[\x00-\x1f\x7f/]/.test(uid) || uid === "." || uid === "..") {
        throw unavailable();
      }
      const idToken = await getIdToken();
      checkActive();
      if (!isCredential(idToken)) throw unavailable();
      const appCheckToken = await getAppCheckToken();
      checkActive();
      if (!isCredential(appCheckToken)) throw unavailable();
      response = await request(
        `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users/${encodeURIComponent(uid)}?mask.fieldPaths=hasActiveSubscription`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${idToken}`,
            "X-Firebase-AppCheck": appCheckToken,
          },
          credentials: "omit",
          cache: "no-store",
          redirect: "error",
          signal,
        },
      );
      checkActive();
      if (response.status !== 200) throw unavailable();
      const document = await readDocument(response, signal, checkActive);
      checkActive();
      return readEntitlement(document, expectedName);
    } catch {
      controller.abort();
      if (response?.body && !response.bodyUsed) void response.body.cancel().catch(() => undefined);
      throw unavailable();
    }
  };
  return {
    read: (): Promise<boolean> => {
      if (retired) return Promise.reject(unavailable());
      if (pending) return pending;
      const controller = new AbortController();
      const deadline = Date.now() + deadlineMillis;
      let timeout: ReturnType<typeof setTimeout>;
      const expired = new Promise<never>((_resolve, reject) => {
        cancel = () => {
          controller.abort();
          reject(unavailable());
        };
        timeout = setTimeout(cancel, deadlineMillis);
      });
      pending = Promise.race([read(controller, deadline), expired]).finally(() => {
        clearTimeout(timeout);
        pending = undefined;
        cancel = undefined;
      });
      return pending;
    },
    retire: () => {
      retired = true;
      cancel?.();
    },
  };
}
