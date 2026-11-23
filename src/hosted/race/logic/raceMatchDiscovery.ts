import {RaceMatchResponseSchema, RaceMatchFailureSchema, classifyRaceMatchFailure, raceMatchFailure, type RaceMatchRequest} from "../../../core/race";
import type {MatchmakingCapability, MatchmakingResult} from "../matchmaking";
import type {RacePlayClock} from "../RacePlay";

/** Optional provider lookup failure is equivalent to capability removal, never a browser error. */
export function resolveRaceMatchmaking(resolver: (() => MatchmakingCapability | undefined) | undefined,
  legacy?: MatchmakingCapability): MatchmakingCapability | undefined {
  try {return resolver ? resolver() : legacy;} catch {return undefined;}
}

/** Legacy direct adapters retain ownership; resolver-backed adapters require a successful current lookup. */
export function ownsRaceMatchmaking(resolver: (() => MatchmakingCapability | undefined) | undefined,
  adapter: MatchmakingCapability, current: () => boolean = () => true): boolean {
  if (!current()) return false;
  /** Optional lookup can synchronously replace the authenticated journey. */
  const owned = !resolver || resolveRaceMatchmaking(resolver) === adapter;
  return owned && current();
}

/** One cancellable discovery delivery budget, including SDKs that never settle. */
export function raceMatchDelivery(clock: RacePlayClock) {
  /** Resolve cancellation through the same promise raced against the provider. */
  let settle!: (result: MatchmakingResult) => void;
  /** Discovery timeouts retain recovery guidance rather than beginning another search. */
  const deadline = new Promise<MatchmakingResult>(resolve => {settle = resolve;});
  /** Timer ownership is returned to the session's navigation and final cleanup paths. */
  const timer = clock.schedule(() => settle({status: "retryable-failure", message: "race-matchmaking-delivery-expired",
    failure: raceMatchFailure("temporarily-unavailable", 1000)}), 30000);
  return {deadline, cancelWait: () => {clock.cancel(timer); settle({status: "cancelled"});}};
}

/** Preserve validated retry guidance and bounded legacy adapter failure classification. */
export function raceDiscoveryFailure(result: Exclude<MatchmakingResult, {
  /** Successful and cancelled deliveries are handled directly by the session. */
  status: "success" | "cancelled";
}>) {
  /** New adapters carry specific failures; older adapters retain broad platform statuses. */
  const failure = RaceMatchFailureSchema.safeParse(result.failure);
  return failure.success ? failure.data : result.status === "terminal-failure" ? raceMatchFailure("invalid-request") :
    result.status === "unavailable" ? raceMatchFailure("access-denied") : raceMatchFailure("temporarily-unavailable", 1000);
}

/** Provider calls belong to their exact selected adapter, including failure continuations. */
export async function findOwnedRaceOpponent(adapter: MatchmakingCapability, request: RaceMatchRequest,
  ownsAdapter: () => boolean): Promise<MatchmakingResult> {
  if (!ownsAdapter()) return {status: "cancelled"};
  try {
    /** SDK method lookup can synchronously notify an account replacement. */
    const find = adapter.find;
    return ownsAdapter() ? await find.call(adapter, {...request}) : {status: "cancelled"};
  }
  catch (error) {return ownsAdapter() ? {status: "retryable-failure", message: "race-matchmaking-provider-failed",
    failure: classifyRaceMatchFailure(error)} : {status: "cancelled"};}
}

/** Observe SDK fields once and retain ownership before publishing their stable outer delivery. */
export function observeRaceMatchResult(result: MatchmakingResult, current: () => boolean): MatchmakingResult | null {
  if (!current()) return null;
  /** Accessors may replace the journey; later branches use this copied discriminant. */
  const status = result.status;
  if (!current()) return null;
  /** Explicit fields preserve non-enumerable and inherited SDK accessors without repeated reads. */
  const delivery: MatchmakingResult = status === "success" ? {status, value: result.value} : status === "cancelled" ? {status} :
    {status, message: result.message, failure: result.failure};
  return current() ? delivery : null;
}

/** Validate discovery identity and preferences before accepting any authority receipt. */
export function parseOwnedRaceMatch(value: unknown, request: RaceMatchRequest) {
  /** Schema validation precedes all preference checks and offer access. */
  const parsed = RaceMatchResponseSchema.safeParse(value);
  if (!parsed.success) return null;
  if (parsed.data.status === "empty") {
    if (parsed.data.locale !== request.locale || parsed.data.fallback !== undefined &&
      request.categoryId !== undefined && parsed.data.fallback.categoryId !== request.categoryId) return null;
  } else if (parsed.data.challenge.locale !== request.locale || request.categoryId !== undefined &&
    parsed.data.challenge.categoryId !== request.categoryId) return null;
  return parsed.data;
}
