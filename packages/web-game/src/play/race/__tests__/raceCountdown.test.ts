import {advanceRaceLoadingProgress, estimatedRaceServerNow, scheduledRaceCountdown} from "../logic/raceCountdown";

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
});
