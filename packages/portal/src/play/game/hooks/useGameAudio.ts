import {useCallback, useEffect, useRef} from "react";
import type {GameSessionState} from "../../gameSession";

/** Describes game feedback kind. */
export type GameFeedbackKind = "key" | "delete" | "submit" | "wrong" | "win" | "loss";

/** Provides game audio. */
export function useGameAudio(state: GameSessionState) {
  const musicRef = useRef<HTMLAudioElement | null>(null);
  const stateRef = useRef(state);
  const audioUnlockedRef = useRef(false);
  const musicFadeTokenRef = useRef(0);
  const lastOutcomeRef = useRef<string | null>(null);
  const lastGuessCountRef = useRef(0);
  stateRef.current = state;

  const unlockMusic = useCallback(() => {
    if (stateRef.current.muted) return;
    audioUnlockedRef.current = true;
    const music = musicRef.current;
    if (music && !stateRef.current.paused) {
      music.volume = 1;
      void music.play().catch(() => undefined);
    }
  }, []);

  const playFeedback = useCallback(
    (kind: GameFeedbackKind) => {
      unlockMusic();
      if (kind !== "wrong" && kind !== "loss") return;

      const music = musicRef.current;
      if (!music || stateRef.current.muted) return;

      const token = ++musicFadeTokenRef.current;
      const wait = (milliseconds: number) =>
        new Promise<void>((resolve) => window.setTimeout(resolve, milliseconds));
      const fade = async (from: number, to: number, duration: number) => {
        const steps = 12;
        for (let step = 0; step <= steps; step += 1) {
          if (musicFadeTokenRef.current !== token || stateRef.current.muted) return false;
          music.volume = from + (to - from) * (step / steps);
          if (step < steps) await wait(duration / steps);
        }
        return true;
      };

      void (async () => {
        if (!(await fade(music.volume, 0, 150))) return;
        await fade(0, 1, kind === "loss" ? 1000 : 700);
      })();
    },
    [unlockMusic],
  );

  useEffect(() => {
    const outcome = state.lastOutcome;
    if (!outcome || lastOutcomeRef.current === outcome.id) return;
    lastOutcomeRef.current = outcome.id;
    playFeedback(outcome.kind);
  }, [playFeedback, state.lastOutcome]);

  useEffect(() => {
    if (state.guesses.length > lastGuessCountRef.current && state.lastOutcome === null) {
      playFeedback("wrong");
    }
    lastGuessCountRef.current = state.guesses.length;
  }, [playFeedback, state.guesses.length, state.lastOutcome]);

  useEffect(() => () => {
    musicFadeTokenRef.current += 1;
  }, []);

  useEffect(() => {
    localStorage.setItem("riddleQuest:soundEnabled", state.muted ? "false" : "true");
    const music = musicRef.current;
    if (!music) return;
    if (state.muted || state.paused || document.hidden) {
      music.pause();
    } else if (audioUnlockedRef.current) {
      void music.play().catch(() => undefined);
    }
  }, [state.muted, state.paused]);

  return {musicRef, playFeedback};
}
