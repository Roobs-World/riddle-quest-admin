export const RACE_COUNTDOWN_START = 3;
export const RACE_COUNTDOWN_TICK_MS = 1_000;
export const RACE_GO_DISPLAY_MS = 180;

export type RaceCountdownStep =
  | {kind: "countdown"; nextValue: number; delayMs: number}
  | {kind: "start"; delayMs: number}
  | {kind: "wait"};

export const getRaceCountdownStep = (value: number, runReady: boolean): RaceCountdownStep => {
  if (value > 1) {
    return {kind: "countdown", nextValue: value - 1, delayMs: RACE_COUNTDOWN_TICK_MS};
  }
  if (value === 1) {
    return runReady
      ? {kind: "countdown", nextValue: 0, delayMs: RACE_COUNTDOWN_TICK_MS}
      : {kind: "wait"};
  }
  return runReady ? {kind: "start", delayMs: RACE_GO_DISPLAY_MS} : {kind: "wait"};
};
