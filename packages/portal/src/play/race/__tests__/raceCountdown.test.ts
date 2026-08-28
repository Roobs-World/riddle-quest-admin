import {getRaceCountdownStep, RACE_COUNTDOWN_TICK_MS, RACE_GO_DISPLAY_MS} from "../logic/raceCountdown";

describe("race countdown", () => {
  it("holds at the start until the authoritative run is ready", () => {
    expect(getRaceCountdownStep(3, false)).toEqual({kind: "wait"});
    expect(getRaceCountdownStep(2, false)).toEqual({kind: "wait"});
    expect(getRaceCountdownStep(1, false)).toEqual({kind: "wait"});
    expect(getRaceCountdownStep(0, false)).toEqual({kind: "wait"});
  });

  it("runs continuously through GO once the run is ready", () => {
    expect(getRaceCountdownStep(3, true)).toEqual({
      kind: "countdown",
      nextValue: 2,
      delayMs: RACE_COUNTDOWN_TICK_MS,
    });
    expect(getRaceCountdownStep(2, true)).toEqual({
      kind: "countdown",
      nextValue: 1,
      delayMs: RACE_COUNTDOWN_TICK_MS,
    });
    expect(getRaceCountdownStep(1, true)).toEqual({
      kind: "countdown",
      nextValue: 0,
      delayMs: RACE_COUNTDOWN_TICK_MS,
    });
    expect(getRaceCountdownStep(0, true)).toEqual({kind: "start", delayMs: RACE_GO_DISPLAY_MS});
  });
});
