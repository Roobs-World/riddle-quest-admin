import type {FacebookInstantSdk} from "../fbinstant";

/** Native Messenger permission is independent of the notification manager's saved A2U consent. */
export function createFacebookMessengerBotConsent({sdk, enabled, isActive}: {
  sdk: FacebookInstantSdk;
  enabled: boolean;
  isActive: () => boolean;
}) {
  if (!enabled) return undefined;
  let supported: Set<string>;
  try {supported = new Set(sdk.getSupportedAPIs());} catch {return undefined;}
  const player = sdk.player;
  if (!supported.has("player.canSubscribeBotAsync") || typeof player.canSubscribeBotAsync !== "function" ||
      !supported.has("player.isSubscribedBotAsync") || typeof player.isSubscribedBotAsync !== "function" ||
      !supported.has("player.subscribeBotAsync") || typeof player.subscribeBotAsync !== "function") return undefined;
  const getSubscribed = player.isSubscribedBotAsync.bind(player);
  const canSubscribe = player.canSubscribeBotAsync.bind(player);
  const subscribe = player.subscribeBotAsync.bind(player);
  const lifetime = new AbortController();
  let subscribed = false;
  const current = () => !lifetime.signal.aborted && isActive();
  const visible = () => typeof document === "undefined" || document.visibilityState === "visible";

  const read = async (operation: () => Promise<boolean>, signal?: AbortSignal): Promise<boolean | undefined> => {
    if (!current() || signal?.aborted) return undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stop!: () => void;
    const interrupted = new Promise<undefined>(resolve => {
      stop = () => resolve(undefined);
      lifetime.signal.addEventListener("abort", stop, {once: true});
      signal?.addEventListener("abort", stop, {once: true});
      timer = setTimeout(stop, 8000);
    });
    try {
      const value = await Promise.race([operation(), interrupted]);
      return current() && !signal?.aborted && typeof value === "boolean" ? value : undefined;
    } catch {return undefined;}
    finally {
      clearTimeout(timer);
      lifetime.signal.removeEventListener("abort", stop);
      signal?.removeEventListener("abort", stop);
    }
  };
  const refresh = async (signal?: AbortSignal) => {
    const status = await read(getSubscribed, signal);
    if (status !== undefined) subscribed = status;
    return status;
  };

  return {
    /** May run at Settings restore; never grants consent or opens a prompt. */
    async eligible(signal?: AbortSignal): Promise<boolean> {
      if (!visible() || await refresh(signal) !== false) return false;
      return await read(canSubscribe, signal) === true && current() && visible() && !signal?.aborted;
    },
    /** The Settings dialog gate performs eligible() immediately before native admission. */
    async request(signal?: AbortSignal): Promise<void> {
      if (!current() || !visible() || signal?.aborted) throw {code: "USER_CANCELLED"};
      try {
        await subscribe();
        if (current()) subscribed = true;
      } finally {
        // An admitted native prompt may succeed even when its response rejects or Settings closes.
        if (current()) await refresh();
      }
    },
    isSubscribed: () => subscribed,
    retire() {lifetime.abort(); subscribed = false;},
  };
}
