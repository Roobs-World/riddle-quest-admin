import type {FacebookOverlayViews} from "../fbinstant";

type Listener = (event: string, overlayId: string) => void;
const dispatchers = new WeakMap<FacebookOverlayViews, Set<Listener>>();

/** Meta owns a single handler slot; mounted profiles subscribe to one SDK-wide dispatcher. */
export function subscribeFacebookOverlayEvents(overlays: FacebookOverlayViews, supported: Set<string>, listener: Listener): () => void {
  if (!supported.has("overlayViews.setCustomEventHandler") || typeof overlays.setCustomEventHandler !== "function") return () => undefined;
  let listeners = dispatchers.get(overlays);
  if (!listeners) {
    listeners = new Set<Listener>();
    const registered = listeners;
    try {
      overlays.setCustomEventHandler((event, id) => {
        for (const notify of [...registered]) {try {notify(event, id);} catch { /* One retired profile cannot affect another. */ }}
      });
    } catch {return () => undefined;}
    dispatchers.set(overlays, listeners);
  }
  listeners.add(listener);
  return () => {listeners.delete(listener);};
}
