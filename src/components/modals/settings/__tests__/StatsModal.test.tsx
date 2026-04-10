import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import StatsModal from "../StatsModal";
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
    white: "#FFFFFF",
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

describe("StatsModal", () => {
  const mockPlayerData: Player = {
    userId: "user-1",
    username: "TestUser",
    email: "test@example.com",
    coins: 200,
    stats: {
      xp: 0,
      level: 1,
      dailyPuzzlesCompleted: 5,
      bestStreak: 7,
      totalWordsGuessed: 80,
      winRate: 75,
      averageGuesses: 2.5,
      totalScore: 1200,
      highestLevelClassic: 12,
      gamesPlayed: 20,
      wins: 15,
      challengeWins: 3,
      winStreak: 4,
      totalWins: 15,
      totalGuessesInWins: 37,
      totalHintsUsed: 2,
    },
    progress: {
      classicIndex: 12,
      dailyChallengeIndex: 5,
      dailyChallengeCurrentQuestion: 0,
      tutorialIndex: 1,
    },
    unlockedAchievements: [],
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

  it("renders Statistics header and close button when visible", () => {
    const { getByText, getByTestId } = render(<StatsModal {...defaultProps} />);
    expect(getByText("Statistics")).toBeTruthy();
    expect(getByTestId("close-button")).toBeTruthy();
  });

  it("renders all section headers", () => {
    const { getByText } = render(<StatsModal {...defaultProps} />);
    expect(getByText("Gameplay")).toBeTruthy();
    expect(getByText("Wins & Streaks")).toBeTruthy();
    expect(getByText("Performance")).toBeTruthy();
  });

  it("renders gameplay stats with correct values", () => {
    const { getByText } = render(<StatsModal {...defaultProps} />);
    expect(getByText("Games Played")).toBeTruthy();
    expect(getByText("20")).toBeTruthy();
    expect(getByText("Daily Puzzles")).toBeTruthy();
    expect(getByText("5")).toBeTruthy();
    expect(getByText("Highest Classic Level")).toBeTruthy();
    expect(getByText("12")).toBeTruthy();
  });

  it("renders wins and streaks stats with correct values", () => {
    const { getByText } = render(<StatsModal {...defaultProps} />);
    expect(getByText("Total Wins")).toBeTruthy();
    expect(getByText("15")).toBeTruthy();
    expect(getByText("Win Rate")).toBeTruthy();
    expect(getByText("75%")).toBeTruthy();
    expect(getByText("Best Streak")).toBeTruthy();
    expect(getByText("7")).toBeTruthy();
    expect(getByText("Current Streak")).toBeTruthy();
    expect(getByText("4")).toBeTruthy();
    expect(getByText("Challenge Wins")).toBeTruthy();
    expect(getByText("3")).toBeTruthy();
  });

  it("renders performance stats with correct values", () => {
    const { getByText } = render(<StatsModal {...defaultProps} />);
    expect(getByText("Avg Guesses (wins)")).toBeTruthy();
    expect(getByText("2.5")).toBeTruthy();
    expect(getByText("Total Words Guessed")).toBeTruthy();
    expect(getByText("80")).toBeTruthy();
    expect(getByText("Total Score")).toBeTruthy();
    expect(getByText("1200")).toBeTruthy();
    expect(getByText("Hints Used")).toBeTruthy();
    expect(getByText("2")).toBeTruthy();
  });

  it("calls onClose when close button is pressed", () => {
    const onClose = jest.fn();
    const { getByTestId } = render(
      <StatsModal {...defaultProps} onClose={onClose} />
    );
    fireEvent.press(getByTestId("close-button"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("renders with null playerData showing zero values", () => {
    const { getByText } = render(
      <StatsModal {...defaultProps} playerData={null} />
    );
    expect(getByText("Statistics")).toBeTruthy();
    // Should render 0s for all stats
    const zeros = getAllByTextHelper(
      render(<StatsModal {...defaultProps} playerData={null} />),
      "0"
    );
    expect(zeros.length).toBeGreaterThan(0);
  });

  it("rounds winRate to integer", () => {
    const playerWithDecimalRate: Player = {
      ...mockPlayerData,
      stats: { ...mockPlayerData.stats!, winRate: 66.666 },
    };
    const { getByText } = render(
      <StatsModal {...defaultProps} playerData={playerWithDecimalRate} />
    );
    expect(getByText("67%")).toBeTruthy();
  });

  it("formats averageGuesses to 1 decimal place", () => {
    const playerWithAvg: Player = {
      ...mockPlayerData,
      stats: { ...mockPlayerData.stats!, averageGuesses: 3 },
    };
    const { getByText } = render(
      <StatsModal {...defaultProps} playerData={playerWithAvg} />
    );
    expect(getByText("3.0")).toBeTruthy();
  });
});

function getAllByTextHelper(renderResult: any, text: string) {
  try {
    return renderResult.getAllByText(text);
  } catch {
    return [];
  }
}


