import {advanceRaceLoadingProgress, estimatedRaceServerNow, scheduledRaceCountdown, getRaceCountdownStep, RACE_COUNTDOWN_TICK_MS, RACE_GO_DISPLAY_MS} from "../logic/raceCountdown";

describe("race countdown", () => {
  it("anchors countdown to server time and catches up after suspension", () => {
    expect(scheduledRaceCountdown(103_000, estimatedRaceServerNow(100_000, 50, 1_050))).toBe(2);
    expect(scheduledRaceCountdown(103_000, estimatedRaceServerNow(100_000, 50, 10_050))).toBe(0);
    expect(estimatedRaceServerNow(100_000, 50, 40)).toBe(100_000);
  });
  it("loads toward 90 until the deck is ready, then completes at 100", () => {
    expect(advanceRaceLoadingProgress(0, false)).toBe(5);
    expect(advanceRaceLoadingProgress(88, false)).toBe(90);
    expect(advanceRaceLoadingProgress(90, false)).toBe(90);
    expect(advanceRaceLoadingProgress(35, true)).toBe(100);
  });
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
