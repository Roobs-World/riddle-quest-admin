/** Background polling must not hold an interactive player command indefinitely. */
export const LIVE_RACE_POLL_DEADLINE_MS = 2_000;
/** Join and accepted mutations retain a longer transport budget before bounded retry. */
export const LIVE_RACE_COMMAND_DEADLINE_MS = 10_000;

/** Only definitive authority rejections permit retiring an unaccepted player command. */
export function liveRaceCommandRejected(error: unknown): boolean {
  if (!error || typeof error !== "object" || !("code" in error) || typeof error.code !== "string") return false;
  return ["invalid-argument", "failed-precondition"].includes(error.code.replace(/^functions\//, ""));
}

/** Bounds a transport wait without claiming cancellation of its server-side mutation. */
export function liveRaceDeliveryDeadline<T>(delivery: Promise<T>, poll: boolean,
  onLateResult?: (value: T) => void): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    /** A late receipt uses the caller's ownership policy after this wait has expired. */
    let expired = false;
    /** One deadline releases the delivery lock even when the adapter never settles. */
    const timer = setTimeout(() => {
      expired = true;
      reject(new Error("Live race delivery timed out"));
    }, poll ? LIVE_RACE_POLL_DEADLINE_MS : LIVE_RACE_COMMAND_DEADLINE_MS);
    delivery.then(value => {
      clearTimeout(timer);
      if (expired) {
        try {onLateResult?.(value);} catch { /* Late receipt failures cannot revive an expired wait. */ }
      } else resolve(value);
    }, error => {
      clearTimeout(timer);
      if (!expired) reject(error);
    });
  });
}
