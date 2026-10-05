import {useSyncExternalStore} from "react";

/** Browser connectivity remains authoritative even when its event precedes subscription. */
const readOnlineStatus = (): boolean => typeof navigator === "undefined" || navigator.onLine;

/** Stable subscriptions do not restart when a consumer renders or changes callbacks. */
const subscribeOnlineStatus = (notify: () => void): (() => void) => {
  /** StrictMode replay and removed consumers each own their exact native lifetime. */
  let listening = true;
  /** React rechecks the current browser snapshot rather than retaining an event payload. */
  const handleConnectionChange = () => {if (listening) notify();};
  window.addEventListener("online", handleConnectionChange);
  window.addEventListener("offline", handleConnectionChange);
  return () => {
    listening = false;
    window.removeEventListener("online", handleConnectionChange);
    window.removeEventListener("offline", handleConnectionChange);
  };
};

/** Reconciles browser connectivity across render, commit, subscription and ordinary events. */
export function useOnlineStatus(): boolean {
  return useSyncExternalStore(subscribeOnlineStatus, readOnlineStatus, readOnlineStatus);
}
