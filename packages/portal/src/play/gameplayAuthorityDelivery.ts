import {tr} from "./i18n";

/** Single-player authority delivery must settle locally before indefinite transport stalls block recovery. */
export const GAMEPLAY_AUTHORITY_DEADLINE_MS = 15_000;

/** Bounds and coalesces identical account-scoped authority transports, preserving server idempotency. */
export const createGameplayAuthorityDelivery = () => {
  /** Only in-flight deliveries are retained; expired requests permit a fresh transport attempt. */
  const pending = new Map<string, Promise<unknown>>();
  return {
    /** One exact request owns both its timely receipt and optional post-delivery work. */
    run<T>(key: string, request: () => Promise<T>, onDelivered?: (value: T) => void): Promise<T> {
      /** The caller's operation and account key fixes the response type for each pending entry. */
      const shared = pending.get(key);
      if (shared) return shared as Promise<T>;
      /** Deadline belongs to this local wait, not to the provider's server-side work. */
      let timer: ReturnType<typeof setTimeout> | undefined;
      /** Late provider settlement cannot publish an expired receipt or trigger its follow-up. */
      const promise = (async () => {
        try {
          /** Provider rejection stays consumed even if it arrives after local expiry. */
          const transport = request();
          /** A timeout represents an unconfirmed result with the original request ID retained for recovery. */
          const deadline = new Promise<never>((_resolve, reject) => {
            timer = setTimeout(() => reject(Object.assign(
              new Error(tr("ErrorMessages.SERVICE_TEMPORARILY_UNAVAILABLE")), {code: "deadline-exceeded"},
            )), GAMEPLAY_AUTHORITY_DEADLINE_MS);
          });
          /** Only a timely canonical response may drive optional profile or content publication. */
          const value = await Promise.race([transport, deadline]);
          if (onDelivered) void Promise.resolve().then(() => onDelivered(value)).catch(() => undefined);
          return value;
        } finally {
          if (timer !== undefined) clearTimeout(timer);
        }
      })().finally(() => {
        if (pending.get(key) === promise) pending.delete(key);
      });
      pending.set(key, promise);
      return promise;
    },
  };
};
