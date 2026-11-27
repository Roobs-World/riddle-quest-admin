import {RaceTournamentEntry} from "../../../../src/races/components/lobby/RaceTournamentEntry";
import type {RaceTo10GameProps} from "../../../../src/races/components/recorded/RaceTo10Game.types.ts";
import {captureBrowserException} from "../../../../src/observability/browserErrorReporter";
import {FacebookNativeSocialPanel} from "./social/FacebookNativeSocialPanel";
import {FacebookSessionScoreActions} from "./engagement/FacebookSessionScoreActions";

/** Facebook owns native tournament capability and diagnostics at its platform boundary. */
const presentation = {titleId: "facebook-tournament-title", analyticsScreen: "facebook_tournament",
  /** Context records retain distinct fixed diagnostics. */
  onContextRecordFailure: (error: unknown) => captureBrowserException(error, {component: "facebook_context", operation: "record_live_result"}),
  /** Native recording errors remain fixed, target-owned diagnostics. */
  onRecordFailure: (error: unknown) => captureBrowserException(error, {component: "facebook_tournament", operation: "record_live_result"})};

/** Keeps Meta official standings and native sharing alongside live play. */
export function FacebookRaceEntry(props: RaceTo10GameProps) {
  return <RaceTournamentEntry {...props} presentation={presentation}
    introNavigation={<>{props.introNavigation}<FacebookNativeSocialPanel /><FacebookSessionScoreActions /></>} />;
}
