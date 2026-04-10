import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import AchievementsModal from "../AchievementsModal";
import { Player } from "../../../../validation/firestoreSchemas";

jest.mock("../../../../styles", () => ({
  TYPOGRAPHY: {
    fontPrimary: "System",
    fontSecondary: "System",
    fontSecondaryBold: "System-Bold",
    fontSize: { xs: 12, sm: 14, base: 16, lg: 18, xl: 20, "2xl": 24, "3xl": 30, "4xl": 36 },
    lineHeight: { tight: 1.25, snug: 1.375, normal: 1.5, relaxed: 1.625, loose: 2 },
    letterSpacing: { tight: -0.1, normal: 0, wide: 0.025 },
  },
  COLORS: {
    success: "#10B981",
    gray600: "#4B5563",
  },
  SPACING: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
}));
jest.mock("../../../../assets/images/modal-bg.svg", () => {
  const React = require("react");
  const { View } = require("react-native");
  const MockModalBg = (props: any) =>
    React.createElement(View, { testID: "modal-bg", ...props });
  MockModalBg.displayName = "MockModalBg";
  return MockModalBg;
});
jest.mock("../../../buttons/CloseButton", () => {
  return function MockCloseButton({ onPress, accessibilityLabel }: any) {
    const React = require("react");
    const { TouchableOpacity, Text } = require("react-native");
    return React.createElement(
      TouchableOpacity,
      { onPress, testID: "close-button", accessibilityLabel },
      React.createElement(Text, {}, "×")
    );
  };
});

describe("AchievementsModal", () => {
  const mockPlayerData: Player = {
    userId: "user-1",
    username: "TestUser",
    email: "test@example.com",
    coins: 100,
    stats: {
      xp: 0,
      level: 1,
      dailyPuzzlesCompleted: 1,
      bestStreak: 2,
      totalWordsGuessed: 50,
      winRate: 60,
      averageGuesses: 3,
      totalScore: 500,
      highestLevelClassic: 5,
      gamesPlayed: 10,
      wins: 6,
      challengeWins: 1,
      winStreak: 2,
      totalWins: 6,
      totalGuessesInWins: 18,
      totalHintsUsed: 0,
    },
    progress: {
      classicIndex: 5,
      dailyChallengeIndex: 1,
      dailyChallengeCurrentQuestion: 0,
      tutorialIndex: 1,
    },
    unlockedAchievements: [
      { achievementId: "first_win", unlockedAt: 1000 },
      { achievementId: "daily_completed", unlockedAt: 1001 },
    ],
    hasPurchasedApp: false,
  };

  const defaultProps = {
    isVisible: true,
    onClose: jest.fn(),
    playerData: mockPlayerData,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders Achievements header and close button when visible", () => {
    const { getByText, getByTestId } = render(
      <AchievementsModal {...defaultProps} />
    );
    expect(getByText("Achievements")).toBeTruthy();
    expect(getByTestId("close-button")).toBeTruthy();
  });

  it("renders achievement list with names and descriptions", () => {
    const { getByText } = render(<AchievementsModal {...defaultProps} />);
    expect(getByText("First Win")).toBeTruthy();
    expect(getByText("Win your first riddle")).toBeTruthy();
    expect(getByText("Daily Challenger")).toBeTruthy();
    expect(getByText("Complete a daily challenge")).toBeTruthy();
  });

  it("calls onClose when close button is pressed", () => {
    const onClose = jest.fn();
    const { getByTestId } = render(
      <AchievementsModal {...defaultProps} onClose={onClose} />
    );
    fireEvent.press(getByTestId("close-button"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("renders when playerData is null (empty unlocked set)", () => {
    const { getByText } = render(
      <AchievementsModal {...defaultProps} playerData={null} />
    );
    expect(getByText("Achievements")).toBeTruthy();
  });
});


