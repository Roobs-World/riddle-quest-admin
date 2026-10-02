import type {RaceMatchRequest, RaceMatchResponse} from "@qwordly/core/race";
import type {MatchmakingCapability} from "../platform/types";

/** Adapts authenticated recorded selection; native provider context selection remains a separate capability. */
export function createFirebaseRaceMatchmaking(
  lookup: (request: RaceMatchRequest) => Promise<RaceMatchResponse> = async (request) =>
    (await (await import("../firebase")).findRaceMatch(request)).data,
): MatchmakingCapability {
  return {
  live: {
    /** Persists an addressed invitation with one durable notification receipt. */
    async sendChallenge(input) {return (await (await import("../firebase")).sendLiveRaceChallenge(input)).data;},
    /** Loads the authenticated recipient's direct invitation notices. */
    async inbox() {return (await (await import("../firebase")).listLiveRaceChallenges({})).data;},
    /** Validates an SDK invitation before showing the acceptance action. */
    async challenge(input) {return (await (await import("../firebase")).getLiveRaceChallenge(input)).data;},
    /** Provides join behavior. */
    async join(input) {return (await (await import("../firebase")).joinLiveRace(input)).data;},
    /** Provides update behavior. */
    async update(input) {return (await (await import("../firebase")).updateLiveRace(input)).data;},
  },
  /** Finds an authenticated recorded opponent. */
  async find(input) {
    try {
      /** Load validation alongside the request without adding it to game startup. */
      const [response, {RaceMatchResponseSchema}] = await Promise.all([
        lookup(typeof input === "string" ? {locale: input} : input),
        import("@qwordly/core/race"),
      ]);
      return {status: "success", value: RaceMatchResponseSchema.parse(response)};
    } catch (error) {
      /** Failure schemas load with matchmaking rather than entering target startup resources. */
      const {raceMatchmakingFailureResult} = await import("../platform/raceMatchmakingFailure");
      return raceMatchmakingFailureResult(error);
    }
  }};
}
