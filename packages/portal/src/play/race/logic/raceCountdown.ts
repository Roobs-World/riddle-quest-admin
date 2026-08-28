/** First number displayed by the multiplayer countdown. */
export const RACE_COUNTDOWN_START = 3;
/** Duration of each numbered countdown step. */
export const RACE_COUNTDOWN_TICK_MS = 1_000;
/** Duration for which the final “Go” state remains visible. */
export const RACE_GO_DISPLAY_MS = 180;

/** A deterministic transition in the multiplayer countdown state machine. */
export type RaceCountdownStep =
  | {
      /** Stores kind. */
      kind: "countdown"; /** Stores next value. */
      /** Stores next value. */
      nextValue: number; /** Stores delay ms. */
      /** Stores delay ms. */
      delayMs: number;
    }
  | {
      /** Stores kind. */
      kind: "start"; /** Stores delay ms. */
      /** Stores delay ms. */
      delayMs: number;
    }
  | {
      /** Stores kind. */
      kind: "wait";
    };

/** Returns the next countdown transition once the authoritative run is ready. */
export const getRaceCountdownStep = (value: number, runReady: boolean): RaceCountdownStep => {
  // Never spend the visible countdown while the authoritative run is still
  // loading. Once 3 starts ticking, the handoff to gameplay is deterministic.
  if (!runReady) return {kind: "wait"};
  if (value > 1) {
    return {kind: "countdown", nextValue: value - 1, delayMs: RACE_COUNTDOWN_TICK_MS};
  }
  if (value === 1) {
    return {kind: "countdown", nextValue: 0, delayMs: RACE_COUNTDOWN_TICK_MS};
  }
  return {kind: "start", delayMs: RACE_GO_DISPLAY_MS};
};
