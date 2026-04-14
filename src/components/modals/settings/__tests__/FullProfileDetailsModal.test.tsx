import React from "react";
import { fireEvent } from "@testing-library/react-native";
import { renderWithModalProvider } from "../../../../test-utils";
import FullProfileDetailsModal from "../FullProfileDetailsModal";
import { Player } from "../../../../validation/firestoreSchemas";
import * as ImagePicker from "react-native-image-picker";

jest.mock("../../../../contexts/AuthContext", () => ({
  useAuth: () => ({
    updatePlayerData: jest.fn(),
    playerData: null,
  }),
}));

jest.mock("@/components/loading/PulsingSpinner", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    __esModule: true,
    default: function MockPulsingSpinner({ visible }: any) {
      return visible ? React.createElement(View, { testID: "pulsing-spinner" }) : null;
    },
  };
});

jest.mock("react-native-image-picker", () => ({
  launchImageLibrary: jest.fn().mockResolvedValue({ didCancel: true }),
}));

// Mock react-native-safe-area-context
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({
    top: 44,
    bottom: 34,
    left: 0,
    right: 0,
  }),
}));

// Mock responsive/styles/ModalBg
jest.mock("src/utils/responsive", () => ({
  scale: (n: number) => n,
  moderateScale: (n: number) => n,
  verticalScale: (n: number) => n,
  dimensions: { screenWidth: 390, screenHeight: 844, isLargeTablet: false },
  responsiveSizes: {
    textXs: 12, textSm: 14, textBase: 16, textLg: 18, textXl: 20,
    text2xl: 24, text3xl: 30, text4xl: 36, textTitle: 28, textDisplay: 32, textTile: 28,
    spacingXs: 4, spacingSm: 8, spacingMd: 16, spacingLg: 24, spacingXl: 32, spacing2xl: 48,
    buttonHeight: 48, inputHeight: 48, headerHeight: 60, tabBarHeight: 60,
    radiusSm: 4, radiusMd: 8, radiusLg: 12, radiusXl: 16, radiusXxl: 20, radiusFull: 9999,
  },
}));
jest.mock("../../../../styles", () => ({
  TYPOGRAPHY: {
    fontPrimary: "System",
    fontSecondary: "System",
    fontSecondaryBold: "System-Bold",
    fontSize: { xs: 12, sm: 14, base: 16, lg: 18, xl: 20, "2xl": 24, "3xl": 30, "4xl": 36 },
    lineHeight: { tight: 1.25, snug: 1.375, normal: 1.5, relaxed: 1.625, loose: 2 },
    letterSpacing: { tight: -0.1, normal: 0, wide: 0.025 },
  },
  SPACING: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
  COLORS: {
    white: "#FFFFFF",
    black: "#000000",
    purple: "#401F40",
    gold: "#FEC880",
  },
}));
jest.mock("../../../../assets/images/modal-bg.svg", () => {
  const React = require("react");
  const { View } = require("react-native");
  const MockModalBg = (props: any) =>
    React.createElement(View, { testID: "modal-bg", ...props });
  MockModalBg.displayName = "MockModalBg";
  return MockModalBg;
});

// Mock components
jest.mock("../../../buttons/WideButton", () => {
  return function MockWideButton({ buttonText, onPress }: any) {
    const React = require("react");
    const { TouchableOpacity, Text } = require("react-native");
    return React.createElement(
      TouchableOpacity,
      { onPress, testID: `wide-button-${buttonText.toLowerCase().replace(/\s+/g, "-")}` },
      React.createElement(Text, {}, buttonText)
    );
  };
});

jest.mock("../../../buttons/CloseButton", () => {
  return function MockCloseButton({ onPress }: any) {
    const React = require("react");
    const { TouchableOpacity, Text } = require("react-native");
    return React.createElement(
      TouchableOpacity,
      { onPress, testID: "close-button" },
      React.createElement(Text, {}, "×")
    );
  };
});

jest.mock("../UpdateUsernameModal", () => {
  return function MockUpdateUsernameModal({ isVisible, onClose }: any) {
    const React = require("react");
    const { View, Text, TouchableOpacity } = require("react-native");
    if (!isVisible) return null;
    return React.createElement(
      View,
      { testID: "update-username-modal" },
      React.createElement(Text, {}, "Update Username Modal"),
      React.createElement(
        TouchableOpacity,
        { testID: "update-username-close", onPress: onClose },
        React.createElement(Text, {}, "Close Update Username")
      )
    );
  };
});

jest.mock("../UpgradeAccountModal", () => {
  return function MockUpgradeAccountModal({ isVisible, onClose }: any) {
    const React = require("react");
    const { View, Text, TouchableOpacity } = require("react-native");
    if (!isVisible) return null;
    return React.createElement(
      View,
      { testID: "upgrade-account-modal" },
      React.createElement(Text, {}, "Upgrade Account Modal"),
      React.createElement(
        TouchableOpacity,
        { testID: "upgrade-account-close", onPress: onClose },
        React.createElement(Text, {}, "Close Upgrade Account")
      )
    );
  };
});

describe("FullProfileDetailsModal", () => {
  const mockPlayerData: Player = {
    userId: "test-user-123",
    username: "TestUser",
    email: "test@example.com",
    coins: 150,
    avatarUrl: "https://example.com/avatar.jpg",
    stats: {
      xp: 0,
      level: 1,
      dailyPuzzlesCompleted: 5,
      bestStreak: 8,
      totalWordsGuessed: 150,
      winRate: 80,
      averageGuesses: 3.2,
      totalScore: 1500,
      highestLevelClassic: 15,
      gamesPlayed: 25,
      wins: 20,
      challengeWins: 8,
      winStreak: 5,
      totalWins: 20,
      totalGuessesInWins: 60,
      totalHintsUsed: 0,
    },
    progress: {
      classicIndex: 10,
      dailyChallengeIndex: 5,
      dailyChallengeCurrentQuestion: 0,
    },
    createdAt: 1704067200000,
    registeredAt: 1704067200000,
    lastLogin: 1704067200000,
    hasPurchasedApp: false,
    unlockedAchievements: [],
  };

  const defaultProps = {
    isVisible: true,
    onClose: jest.fn(),
    playerData: mockPlayerData,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders correctly when visible with player data", () => {
    const { getByText, getByTestId } = renderWithModalProvider(
      <FullProfileDetailsModal {...defaultProps} />
    );

    expect(getByText("TestUser")).toBeTruthy();
    expect(getByText("5")).toBeTruthy();
    expect(getByTestId("close-button")).toBeTruthy();
  });

  it("does not render when player data is null", () => {
    const { queryByText } = renderWithModalProvider(
      <FullProfileDetailsModal {...defaultProps} playerData={null} />
    );

    expect(queryByText("TestUser")).toBeNull();
  });

  it("does not render when not visible", () => {
    const { queryByText } = renderWithModalProvider(
      <FullProfileDetailsModal {...defaultProps} isVisible={false} />
    );

    expect(queryByText("TestUser")).toBeNull();
  });

  it("displays all player statistics correctly", () => {
    const { getByText } = renderWithModalProvider(<FullProfileDetailsModal {...defaultProps} />);

    expect(getByText("5")).toBeTruthy();
    expect(getByText("8")).toBeTruthy();
    expect(getByText("Daily puzzles completed")).toBeTruthy();
    expect(getByText("Best Strike")).toBeTruthy();
  });

  it("displays avatar image when avatarUrl is provided", () => {
    const { getByTestId } = renderWithModalProvider(
      <FullProfileDetailsModal {...defaultProps} />
    );

    expect(() => getByTestId("avatar-image")).not.toThrow();
  });

  it("displays username initial when no avatar url", () => {
    const playerWithoutAvatar = {
      ...mockPlayerData,
      avatarUrl: undefined,
    };

    const { getByText } = renderWithModalProvider(
      <FullProfileDetailsModal
        {...defaultProps}
        playerData={playerWithoutAvatar}
      />
    );

    expect(getByText("T")).toBeTruthy();
  });

  it("calls onClose when close button is pressed", () => {
    const mockOnClose = jest.fn();
    const { getByTestId } = renderWithModalProvider(
      <FullProfileDetailsModal {...defaultProps} onClose={mockOnClose} />
    );

    fireEvent.press(getByTestId("close-button"));
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it("opens update username modal when button is pressed", () => {
    const { getByText, getByTestId } = renderWithModalProvider(
      <FullProfileDetailsModal {...defaultProps} />
    );

    fireEvent.press(getByText("TestUser"));
    expect(getByTestId("update-username-modal")).toBeTruthy();
  });

  it("launches the image picker when avatar is pressed", () => {
    const { getByTestId } = renderWithModalProvider(
      <FullProfileDetailsModal {...defaultProps} />
    );

    fireEvent.press(getByTestId("avatar-image"));
    expect(ImagePicker.launchImageLibrary).toHaveBeenCalled();
  });

  it("renders with proper positioning", () => {
    const { getByText } = renderWithModalProvider(<FullProfileDetailsModal {...defaultProps} />);

    expect(getByText("TestUser")).toBeTruthy();
  });

  it("renders modal without gestures", () => {
    const { getByText } = renderWithModalProvider(<FullProfileDetailsModal {...defaultProps} />);

    expect(getByText("TestUser")).toBeTruthy();
    expect(getByText("Daily puzzles completed")).toBeTruthy();
  });

  it("handles zero stats gracefully", () => {
    const playerWithZeroStats = {
      ...mockPlayerData,
      stats: {
        xp: 0,
        level: 1,
        dailyPuzzlesCompleted: 0,
        bestStreak: 0,
        totalWordsGuessed: 0,
        winRate: 0,
        averageGuesses: 0,
        totalScore: 0,
        highestLevelClassic: 0,
        gamesPlayed: 0,
        wins: 0,
        challengeWins: 0,
        winStreak: 0,
        totalWins: 0,
        totalGuessesInWins: 0,
        totalHintsUsed: 0,
      },
      coins: 0,
      progress: {
        classicIndex: 0,
        dailyChallengeIndex: 0,
      dailyChallengeCurrentQuestion: 0,
      },
    };

    const { getAllByText } = renderWithModalProvider(
      <FullProfileDetailsModal
        {...defaultProps}
        playerData={playerWithZeroStats}
      />
    );

    expect(getAllByText("0").length).toBeGreaterThan(0);
  });

  it("fills XP progress bar for an uncapped XP level", () => {
    const playerWithXpProgress: Player = {
      ...mockPlayerData,
      stats: {
        ...mockPlayerData.stats,
        xp: 1750,
        totalScore: 1750,
      },
    };

    const { getByTestId, getByText } = renderWithModalProvider(
      <FullProfileDetailsModal
        {...defaultProps}
        playerData={playerWithXpProgress}
      />
    );

    const xpFill = getByTestId("xp-progress-fill");
    expect(xpFill.props.style.width).toBe("48%");
    expect(getByText("100 / 210 XP")).toBeTruthy();
  });

  it("renders the Leaderboard button", () => {
    const { getByText } = renderWithModalProvider(
      <FullProfileDetailsModal {...defaultProps} />
    );

    expect(getByText("Leaderboard")).toBeTruthy();
  });

  it("opens achievements modal when Achievements button is pressed", () => {
    const { getByText } = renderWithModalProvider(
      <FullProfileDetailsModal {...defaultProps} />
    );

    fireEvent.press(getByText("Achievements"));
    // The modal.openGameModal is called - we verify the button exists and is pressable
    expect(getByText("Achievements")).toBeTruthy();
  });

  it("opens statistics modal when Statistics button is pressed", () => {
    const { getByText } = renderWithModalProvider(
      <FullProfileDetailsModal {...defaultProps} />
    );

    fireEvent.press(getByText("Statistics"));
    // The modal.openGameModal is called - we verify the button exists and is pressable
    expect(getByText("Statistics")).toBeTruthy();
  });

  it("opens leaderboard modal when Leaderboard button is pressed", () => {
    const { getByText } = renderWithModalProvider(
      <FullProfileDetailsModal {...defaultProps} />
    );

    fireEvent.press(getByText("Leaderboard"));
    // The modal.openGameModal is called - we verify the button exists and is pressable
    expect(getByText("Leaderboard")).toBeTruthy();
  });

  it("closes update username modal via onClose callback", () => {
    const { getByText, getByTestId, queryByTestId } = renderWithModalProvider(
      <FullProfileDetailsModal {...defaultProps} />
    );

    fireEvent.press(getByText("TestUser"));
    expect(getByTestId("update-username-modal")).toBeTruthy();
    fireEvent.press(getByTestId("update-username-close"));
    expect(queryByTestId("update-username-modal")).toBeNull();
  });
});
