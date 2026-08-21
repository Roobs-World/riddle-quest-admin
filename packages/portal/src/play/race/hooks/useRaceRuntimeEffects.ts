import {useEffect, type Dispatch, type SetStateAction} from "react";
import type {RaceRunView} from "@qwordly/core/race";
import {trackEvent, trackScreen} from "../../../analytics/googleAnalytics";
import {safeBrowserStorageRemove, safeBrowserStorageSet} from "../../playerPreferences";
import {getRaceCountdownStep} from "../logic/raceCountdown";
import type {RaceStage} from "../RaceTo10View";

/** Local-storage key used to remember the currently active race run. */
export const ACTIVE_RACE_KEY = "riddleQuest:activeRaceRun";

/** Tracks entry into Race to 10 screens and the top-level mode. */
export const useRaceEntryTracking = (stage: RaceStage, challengeId: string | undefined): void => {
  useEffect(() => trackScreen(`multiplayer_${stage}`), [stage]);
  useEffect(() => {
    if (!challengeId) trackEvent("race_mode_viewed");
  }, [challengeId]);
};

/** Drives deterministic countdown transitions and the locally displayed race clock. */
export const useRaceClockEffects = (
  stage: RaceStage,
  countdown: number,
  run: RaceRunView | null,
  setStage: Dispatch<SetStateAction<RaceStage>>,
  setCountdown: Dispatch<SetStateAction<number>>,
  setTick: Dispatch<SetStateAction<number>>,
): void => {
  useEffect(() => {
    if (stage !== "countdown") return;
    const step = getRaceCountdownStep(countdown, Boolean(run));
    if (step.kind === "wait") return;
    const timer = window.setTimeout(() => {
      if (step.kind === "start") setStage("racing");
      else setCountdown(step.nextValue);
    }, step.delayMs);
    return () => window.clearTimeout(timer);
  }, [countdown, run, setCountdown, setStage, stage]);

  useEffect(() => {
    if (stage !== "racing") return;
    const timer = window.setInterval(() => setTick((value) => value + 1), 100);
    return () => window.clearInterval(timer);
  }, [setTick, stage]);
};

/** Expires transient race feedback after the shared presentation interval. */
export const useRaceFeedbackTimers = (
  penaltyFlash: string | null,
  feedback: "correct" | "incorrect" | null,
  setPenaltyFlash: Dispatch<SetStateAction<string | null>>,
  setFeedback: Dispatch<SetStateAction<"correct" | "incorrect" | null>>,
): void => {
  useEffect(() => {
    if (!penaltyFlash) return;
    const timer = window.setTimeout(() => setPenaltyFlash(null), 1_600);
    return () => window.clearTimeout(timer);
  }, [penaltyFlash, setPenaltyFlash]);
  useEffect(() => {
    if (!feedback) return;
    const timer = window.setTimeout(() => setFeedback(null), 1_600);
    return () => window.clearTimeout(timer);
  }, [feedback, setFeedback]);
};

/** Persists only the identifier of an active server-authoritative race run. */
export const useActiveRacePersistence = (run: RaceRunView | null): void => {
  useEffect(() => {
    if (!run) return;
    if (run.status === "active") safeBrowserStorageSet("local", ACTIVE_RACE_KEY, run.runId);
    else safeBrowserStorageRemove("local", ACTIVE_RACE_KEY);
  }, [run]);
};
