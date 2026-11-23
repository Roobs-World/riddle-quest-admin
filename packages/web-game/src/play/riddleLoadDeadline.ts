import {tr} from "./i18n";

/** Content reads must release startup and Next controls before an indefinite transport stall. */
export const RIDDLE_LOAD_DEADLINE_MS = 15_000;

/** Bounds content delivery without claiming to cancel work already admitted by the provider. */
export function riddleLoadDeadline<T>(delivery: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    /** A retired context cancels its wait even when its transport never settles. */
    const abort = () => finish(() => reject(Object.assign(new Error("Riddle context retired"), {name: "AbortError"})));
    /** Timer and listener belong to this wait, independently of the underlying transport. */
    let timer: ReturnType<typeof setTimeout> | undefined;
    /** Late transport settlements cannot publish after expiration or context retirement. */
    let settled = false;
    /** Finishes exactly once and releases all resources owned by the wait. */
    const finish = (settle: () => void) => {
      if (settled) return;
      settled = true;
      if (timer !== undefined) clearTimeout(timer);
      signal.removeEventListener("abort", abort);
      settle();
    };
    // Attach both continuations even to an already retired request: provider rejection stays handled.
    delivery.then(value => finish(() => resolve(value)), error => finish(() => reject(error)));
    if (signal.aborted) {abort(); return;}
    signal.addEventListener("abort", abort, {once: true});
    timer = setTimeout(() => finish(() => reject(Object.assign(
      new Error(tr("ErrorMessages.UNABLE_TO_LOAD_RIDDLES")), {code: "deadline-exceeded"},
    ))), RIDDLE_LOAD_DEADLINE_MS);
  });
}
