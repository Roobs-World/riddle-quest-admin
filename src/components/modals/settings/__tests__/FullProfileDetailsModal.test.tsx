import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import FullProfileDetailsModal from "../FullProfileDetailsModal";
import { Player } from "../../../../validation/firestoreSchemas";

// Mock react-native-safe-area-context
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({
    top: 44,
    bottom: 34,
    left: 0,
    right: 0,
  }),
}));

// Mock components
jest.mock("../../../buttons/WideButton", () => {
  return function MockWideButton({ buttonText, onPress }: any) {
    const React = require("react");
    const { TouchableOpacity, Text } = require("react-native");
    return React.createElement(
      TouchableOpacity,
      { onPress, testID: "wide-button" },
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

jest.mock("../ChangePasswordModal", () => {
  return function MockChangePasswordModal({ isVisible, onClose }: any) {
    const React = require("react");
    const { View, Text } = require("react-native");
    if (!isVisible) return null;
    return React.createElement(
      View,
      { testID: "change-password-modal" },
      React.createElement(Text, {}, "Change Password Modal")
    );
  };
});

jest.mock("../UpdateUsernameModal", () => {
  return function MockUpdateUsernameModal({ isVisible, onClose }: any) {
    const React = require("react");
    const { View, Text } = require("react-native");
    if (!isVisible) return null;
    return React.createElement(
      View,
      { testID: "update-username-modal" },
      React.createElement(Text, {}, "Update Username Modal")
    );
  };
});

jest.mock("../AvatarOptionsModal", () => {
  return function MockAvatarOptionsModal({ isVisible, onClose }: any) {
    const React = require("react");
    const { View, Text } = require("react-native");
    if (!isVisible) return null;
    return React.createElement(
      View,
      { testID: "avatar-options-modal" },
      React.createElement(Text, {}, "Avatar Options Modal")
    );
  };
});

jest.mock("../PreloadedAvatarsModal", () => {
  return function MockPreloadedAvatarsModal({ isVisible, onClose }: any) {
    const React = require("react");
    const { View, Text } = require("react-native");
    if (!isVisible) return null;
    return React.createElement(
      View,
      { testID: "preloaded-avatars-modal" },
      React.createElement(Text, {}, "Preloaded Avatars Modal")
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
    },
    progress: {
      classicIndex: 10,
      dailyChallengeIndex: 5,
      tutorialIndex: 3,
    },
    createdAt: 1704067200000, // 2024-01-01 as timestamp
    registeredAt: 1704067200000,
    lastLogin: 1704067200000,
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

  it("renders correctly when visible with player data", () => {
    const { getByText, getByTestId } = render(
      <FullProfileDetailsModal {...defaultProps} />
    );

    expect(getByText("Full Profile")).toBeTruthy();
    expect(getByText("TestUser")).toBeTruthy();
    expect(getByText("150")).toBeTruthy(); // coins
    expect(getByText("25")).toBeTruthy(); // games played
    expect(getByText("80%")).toBeTruthy(); // win rate
    expect(getByTestId("close-button")).toBeTruthy();
  });

  it("does not render when player data is null", () => {
    const { queryByText } = render(
      <FullProfileDetailsModal {...defaultProps} playerData={null} />
    );

    expect(queryByText("Full Profile")).toBeNull();
  });

  it("does not render when not visible", () => {
    const { queryByText } = render(
      <FullProfileDetailsModal {...defaultProps} isVisible={false} />
    );

    expect(queryByText("Full Profile")).toBeNull();
  });

  it("displays all player statistics correctly", () => {
    const { getByText } = render(<FullProfileDetailsModal {...defaultProps} />);

    // Check all displayed stats
    expect(getByText("5")).toBeTruthy(); // Daily puzzles
    expect(getByText("8")).toBeTruthy(); // Best streak
    expect(getByText("150")).toBeTruthy(); // Words guessed & coins
    expect(getByText("80%")).toBeTruthy(); // Win rate
    expect(getByText("1500")).toBeTruthy(); // Total score
    expect(getByText("15")).toBeTruthy(); // Highest level
    expect(getByText("25")).toBeTruthy(); // Games played
  });

  it("displays avatar image when avatarUrl is provided", () => {
    const { getByTestId } = render(
      <FullProfileDetailsModal {...defaultProps} />
    );

    // Should render an Image component with the avatar
    expect(() => getByTestId("avatar-image")).not.toThrow();
  });

  it("displays username initial when no avatar url", () => {
    const playerWithoutAvatar = {
      ...mockPlayerData,
      avatarUrl: undefined,
    };

    const { getByText } = render(
      <FullProfileDetailsModal
        {...defaultProps}
        playerData={playerWithoutAvatar}
      />
    );

    expect(getByText("T")).toBeTruthy(); // First letter of TestUser
  });

  it("calls onClose when close button is pressed", () => {
    const mockOnClose = jest.fn();
    const { getByTestId } = render(
      <FullProfileDetailsModal {...defaultProps} onClose={mockOnClose} />
    );

    fireEvent.press(getByTestId("close-button"));
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it("opens update username modal when button is pressed", () => {
    const { getByText, getByTestId } = render(
      <FullProfileDetailsModal {...defaultProps} />
    );

    fireEvent.press(getByText("Update Username"));
    expect(getByTestId("update-username-modal")).toBeTruthy();
  });

  it("opens change password modal when button is pressed", () => {
    const { getByText, getByTestId } = render(
      <FullProfileDetailsModal {...defaultProps} />
    );

    fireEvent.press(getByText("Change Password"));
    expect(getByTestId("change-password-modal")).toBeTruthy();
  });

  it("opens avatar options modal when update avatar button is pressed", () => {
    const { getByTestId } = render(
      <FullProfileDetailsModal {...defaultProps} />
    );

    fireEvent.press(getByTestId("wide-button"));
    expect(getByTestId("avatar-options-modal")).toBeTruthy();
  });

  it("renders with proper safe area positioning", () => {
    const { getByText } = render(<FullProfileDetailsModal {...defaultProps} />);

    expect(getByText("Full Profile")).toBeTruthy();
  });

  it("renders fixed modal container without gestures", () => {
    const { getByText } = render(<FullProfileDetailsModal {...defaultProps} />);

    // Modal should be rendered without any gesture handling
    expect(getByText("Full Profile")).toBeTruthy();
    expect(getByText("TestUser")).toBeTruthy();
  });

  it("handles zero stats gracefully", () => {
    const playerWithZeroStats = {
      ...mockPlayerData,
      stats: {
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
      },
      coins: 0,
      progress: {
        classicIndex: 0,
        dailyChallengeIndex: 0,
        tutorialIndex: 0,
      },
    };

    const { getByText } = render(
      <FullProfileDetailsModal
        {...defaultProps}
        playerData={playerWithZeroStats}
      />
    );

    expect(getByText("0")).toBeTruthy(); // Should display zeros without crashing
    expect(getByText("0%")).toBeTruthy(); // Win rate as 0%
  });
});
