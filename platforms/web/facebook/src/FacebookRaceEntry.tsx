import {useState} from "react";
import {RaceTournamentEntry} from "../../../../src/races/components/lobby/RaceTournamentEntry";
import type {RaceLocale} from "../../../../src/races/contracts/index";
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
  return <FacebookRaceDestination key={JSON.stringify([props.ownerId, props.locale])} {...props} />;
}

function FacebookRaceDestination(props: RaceTo10GameProps) {
  const [joined, setJoined] = useState<{locale: RaceLocale; revision: number} | null>(null);
  return <RaceTournamentEntry key={joined?.revision ?? 0} {...props} presentation={presentation}
    tournamentLocale={joined?.locale ?? props.tournamentLocale}
    introNavigation={<>{props.introNavigation}<FacebookNativeSocialPanel onTournamentJoined={locale => {
      if (props.tournaments) setJoined(previous => ({locale, revision: (previous?.revision ?? 0) + 1}));
    }} /><FacebookSessionScoreActions /></>} />;
}
