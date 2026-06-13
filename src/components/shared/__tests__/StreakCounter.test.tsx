import React from "react";
import {render} from "@testing-library/react-native";
import {
  getStreakRewardProgress,
  STREAK_REWARD_INTERVAL_DAYS,
  StreakCounter,
} from "../StreakCounter";

describe("StreakCounter", () => {
  it("shows progress toward the first seven-day reward", () => {
    const {getByText, getByTestId} = render(<StreakCounter streakValue={5} />);

    expect(getByText("5-Day Streak")).toBeTruthy();
    expect(getByText("5/7")).toBeTruthy();
    expect(getByTestId("streak-counter").props.accessibilityValue).toEqual({
      min: 0,
      max: STREAK_REWARD_INTERVAL_DAYS,
      now: 5,
    });
  });

  it.each([
    [0, 0],
    [1, 1],
    [7, 7],
    [8, 1],
    [14, 7],
  ])("maps streak %s to weekly progress %s", (streak, expectedProgress) => {
    expect(getStreakRewardProgress(streak)).toBe(expectedProgress);
  });
});
