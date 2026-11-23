import {useCallback, useEffect, useLayoutEffect, useRef} from "react";
import type {GameSessionState} from "../../../../hosted/play/gameSession";
import {setPlayerMuted} from "../../playerPreferences";

/** Describes game feedback kind. */
export type GameFeedbackKind = "key" | "delete" | "submit" | "wrong" | "win" | "loss";

/** Provides game audio. */
export function useGameAudio(state: GameSessionState) {
  /** Provides music ref behavior. */
  const musicRef = useRef<HTMLAudioElement | null>(null);
  /** Gestures follow the visible committed mute and pause settings. */
  const stateRef = useRef(state);
  /** Provides audio unlocked ref behavior. */
  const audioUnlockedRef = useRef(false);
  useLayoutEffect(() => {stateRef.current = state;}, [state]);

  /** Provides unlock music behavior. */
  const unlockMusic = useCallback(() => {
    if (stateRef.current.muted) return;
    audioUnlockedRef.current = true;
    /** Provides music behavior. */
    const music = musicRef.current;
    if (music && !stateRef.current.paused && !document.hidden && music.paused) {
      void music.play().catch(() => undefined);
    }
  }, []);

  /** Unlocks playback without changing the music level after an answer. */
  const playFeedback = useCallback(
    (_kind: GameFeedbackKind) => unlockMusic(),
    [unlockMusic],
  );

  useEffect(() => {
    // A browser permits audible playback only after a user gesture. The
    // onboarding Play tap is often the first gesture, before a gameplay key.
    document.addEventListener("pointerup", unlockMusic, true);
    document.addEventListener("keydown", unlockMusic, true);
    return () => {
      document.removeEventListener("pointerup", unlockMusic, true);
      document.removeEventListener("keydown", unlockMusic, true);
    };
  }, [unlockMusic]);

  useEffect(() => {
    setPlayerMuted(state.muted);
  }, [state.muted]);

  useLayoutEffect(() => {
    /** Provides music behavior. */
    const music = musicRef.current;
    if (!music) return;
    if (state.muted || state.paused || document.hidden) {
      music.pause();
    } else if (audioUnlockedRef.current && music.paused) {
      void music.play().catch(() => undefined);
    }
    // Retain the element so ref detachment cannot leave retired music playing.
    return () => {music.pause();};
  }, [state.muted, state.paused]);

  return {musicRef, playFeedback};
}
