import type {JoinLiveRace, RaceLocale} from "../../../../src/core/race";
import type {MatchmakingCapability} from "../../../../src/web/platform/types";
import type {FacebookContextCoordinator} from "./contexts";

/** Captures one synchronized SDK destination per join attempt while the server owns membership and score authority. */
export function createFacebookContextMatchmaking(matchmaking: MatchmakingCapability,
  coordinator: Pick<FacebookContextCoordinator, "ensureCurrent">, getLocale: () => RaceLocale): MatchmakingCapability {
  /** Only this Facebook composition wraps the otherwise unchanged shared transport. */
  const live = matchmaking.live;
  if (!live) return matchmaking;
  /** A bounded recent attempt cache keeps retries stable across native context changes. */
  const selections = new Map<string, {
    /** Exact original portable input prevents a reused request from being silently rewritten. */ signature: string;
    /** All concurrent deliveries share one context synchronization and immutable destination. */ selection: Promise<JoinLiveRace>;
  }>();
  /** Context is captured before any authenticated seat can be created. */
  const prepare = (input: JoinLiveRace): Promise<JoinLiveRace> => {
    /** SDK context may only come from the owning coordinator, never the shared game's input. */
    const {facebookContextId: _ignored, ...original} = input;
    /** Strict operation/content inputs stay independent of a mutable context selection. */
    const signature = JSON.stringify([original.locale, original.categoryId, original.createChallenge,
      original.challengeId, original.rematchOfTicketId]);
    /** Concurrent tabs still rely on server receipt/pointer convergence; this cache owns only this adapter. */
    const previous = selections.get(input.requestId);
    if (previous) return previous.signature === signature ? previous.selection : Promise.reject(new Error("Live request selection changed"));
    /** Locale retirement before or after async membership delivery cannot start a stale journey. */
    const selection = Promise.resolve().then(async () => {
      if (original.locale !== getLocale()) throw new Error("Live context locale changed");
      /** SDK-unavailable solo contexts keep ordinary global play available. */
      const current = await coordinator.ensureCurrent();
      if (original.locale !== getLocale()) throw new Error("Live context locale changed");
      if (current.status === "retryable-failure") throw new Error("Live context synchronization unavailable");
      return current.status === "success" ? {...original, facebookContextId: current.value.contextId} : original;
    });
    selections.set(input.requestId, {signature, selection});
    if (selections.size > 32) selections.delete(selections.keys().next().value!);
    void selection.catch(() => {if (selections.get(input.requestId)?.selection === selection) selections.delete(input.requestId);});
    return selection;
  };
  return {...matchmaking, live: {...live,
    join: input => prepare(input).then(value => live.join(value)),
    ...(live.rematch ? {rematch: input => prepare(input).then(value => live.rematch!({...value, rematchOfTicketId: input.rematchOfTicketId}))} : {}),
  }};
}
