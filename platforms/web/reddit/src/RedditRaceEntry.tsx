import {RaceTournamentEntry} from "../../../../src/races/components/lobby/RaceTournamentEntry";
import type {RaceTo10GameProps} from "../../../../src/races/components/recorded/RaceTo10Game.types.ts";
import {captureBrowserException} from "../../../../src/observability/browserErrorReporter";

/** Reddit uses only its same-origin game-owned board, with no Meta or Jest SDK. */
const presentation = {titleId: "reddit-tournament-title", analyticsScreen: "reddit_tournament",
  /** Official record failure is optional to displaying the completed game. */
  onRecordFailure: (error: unknown) => captureBrowserException(error, {component: "reddit_tournament", operation: "record_live_result"})};

/** Restores the existing authenticated board without exposing unsupported native sharing. */
export function RedditRaceEntry(props: RaceTo10GameProps) {
  return <RaceTournamentEntry {...props} presentation={presentation} />;
}
