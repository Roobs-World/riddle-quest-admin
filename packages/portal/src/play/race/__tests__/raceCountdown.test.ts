import {
  getRaceCountdownStep,
  RACE_COUNTDOWN_TICK_MS,
  RACE_GO_DISPLAY_MS,
} from "../raceCountdown";

describe("race countdown", () => {
  it("loads during the countdown and holds before GO until the run is ready", () => {
    expect(getRaceCountdownStep(3, false)).toEqual({
      kind: "countdown",
      nextValue: 2,
      delayMs: RACE_COUNTDOWN_TICK_MS,
    });
    expect(getRaceCountdownStep(2, false)).toEqual({
      kind: "countdown",
      nextValue: 1,
      delayMs: RACE_COUNTDOWN_TICK_MS,
    });
    expect(getRaceCountdownStep(1, false)).toEqual({kind: "wait"});
  });

  it("only shows GO for the short handoff after the run is ready", () => {
    expect(getRaceCountdownStep(1, true)).toEqual({
      kind: "countdown",
      nextValue: 0,
      delayMs: RACE_COUNTDOWN_TICK_MS,
    });
    expect(getRaceCountdownStep(0, true)).toEqual({kind: "start", delayMs: RACE_GO_DISPLAY_MS});
  });
});
