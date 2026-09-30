import type {RaceMatchRequest, RaceMatchResponse} from "@qwordly/core/race";
import type {MatchmakingCapability} from "../platform/types";

/** Adapts authenticated recorded selection; native provider context selection remains a separate capability. */
export function createFirebaseRaceMatchmaking(
  lookup: (request: RaceMatchRequest) => Promise<RaceMatchResponse> = async (request) =>
    (await (await import("../firebase")).findRaceMatch(request)).data,
): MatchmakingCapability {
  return {
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
