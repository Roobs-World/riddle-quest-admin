import {useEffect} from "react";
import {trackEvent, trackScreen} from "../../observability/analytics/events";
import type {RaceStage} from "../components/recorded/RaceTo10View";

/** Local-storage key used to remember the currently active race run. */
export {ACTIVE_RACE_KEY} from "../browser/storage/activeRaceStorage";

/** Tracks entry into Race to 10 screens and the top-level mode. */
export const useRaceEntryTracking = (stage: RaceStage, challengeId: string | undefined): void => {
  useEffect(() => trackScreen(`multiplayer_${stage}`), [stage]);
  useEffect(() => {
    if (!challengeId) trackEvent("race_mode_viewed");
  }, [challengeId]);
};
