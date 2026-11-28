import {RaceTournamentEntry} from "../../../../src/races/components/lobby/RaceTournamentEntry";
import type {RaceTo10GameProps} from "../../../../src/races/components/recorded/RaceTo10Game.types.ts";
import {captureBrowserException} from "../../../../src/observability/browserErrorReporter";
import {FacebookNativeSocialActions} from "./social/FacebookNativeSocialPanel";

const presentation = {titleId: "facebook-multiplayer-title", analyticsScreen: "facebook_multiplayer",
  onRecordFailure: (error: unknown) => captureBrowserException(error, {component: "facebook_context", operation: "record_live_result"})};

/** Facebook room and solo actions live alongside the shared multiplayer controls. */
export function FacebookRaceEntry(props: RaceTo10GameProps) {
  return <RaceTournamentEntry {...props} presentation={presentation} socialActions={<FacebookNativeSocialActions />} />;
}
