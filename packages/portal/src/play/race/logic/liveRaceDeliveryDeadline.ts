import {LiveRaceChallengeSchema, type LiveRaceCapability} from "@qwordly/core/race";

/** Background polling must not hold an interactive player command indefinitely. */
export const LIVE_RACE_POLL_DEADLINE_MS = 2_000;
/** Accepted mutations retain a longer transport budget before bounded retry. */
export const LIVE_RACE_COMMAND_DEADLINE_MS = 10_000;
/** Joining can include a cold Functions preflight and immutable deck preparation. */
export const LIVE_RACE_JOIN_DEADLINE_MS = 30_000;

/** Only definitive authority rejections permit retiring an unaccepted player command. */
export function liveRaceCommandRejected(error: unknown): boolean {
  if (!error || typeof error !== "object" || !("code" in error) || typeof error.code !== "string") return false;
  return ["invalid-argument", "failed-precondition"].includes(error.code.replace(/^functions\//, ""));
}

/** A rejected acceptance becomes terminal only after a matching, validated server preview confirms it. */
export async function confirmUnavailableLiveInvitation(failure: unknown, challengeId: string | undefined,
  transport: Pick<LiveRaceCapability, "challenge">, signal?: AbortSignal): Promise<boolean> {
  if (signal?.aborted || !challengeId || !transport.challenge || !liveRaceCommandRejected(failure)) return false;
  try {
    /** A bounded read must confirm the same invitation with a strict server schema. */
    const preview = LiveRaceChallengeSchema.parse(await liveRaceDeliveryDeadline(transport.challenge({challengeId}), false, undefined, signal));
    return preview.challengeId === challengeId && preview.status === "unavailable";
  } catch {return false;}
}

/** Bounds a transport wait without claiming cancellation of its server-side mutation. */
export function liveRaceDeliveryDeadline<T>(delivery: Promise<T>, poll: boolean,
  onLateResult?: (value: T) => void, signal?: AbortSignal,
  /** Entry may opt into its bounded cold-start budget without slowing polls or player commands. */
  commandDeadlineMs = LIVE_RACE_COMMAND_DEADLINE_MS): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    /** A late receipt uses the caller's ownership policy after this wait has expired. */
    let expired = false;
    /** One deadline releases the delivery lock even when the adapter never settles. */
    let timer: ReturnType<typeof setTimeout> | undefined;
    /** Timer and listener ownership end together on every settlement path. */
    const cleanup = () => {
      if (timer !== undefined) clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
    };
    /** Retirement rejects only this local wait; the adapter's eventual result remains observed. */
    const abort = () => {
      expired = true;
      cleanup();
      reject(new Error("Live race delivery cancelled"));
    };
    delivery.then(value => {
      cleanup();
      if (expired) {
        try {onLateResult?.(value);} catch { /* Late receipt failures cannot revive an expired wait. */ }
      } else resolve(value);
    }, error => {
      cleanup();
      if (!expired) reject(error);
    });
    if (signal?.aborted) {abort(); return;}
    signal?.addEventListener("abort", abort, {once: true});
    timer = setTimeout(() => {
      expired = true;
      cleanup();
      reject(new Error("Live race delivery timed out"));
    }, poll ? LIVE_RACE_POLL_DEADLINE_MS : commandDeadlineMs);
  });
}
