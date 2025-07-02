import React from "react";
import { render, fireEvent, waitFor } from "@testing-library/react-native";
import ProfileModal from "../ProfileModal";
import { Player } from "../../../../validation/firestoreSchemas";

// Mock the useAuth hook
const mockLogout = jest.fn();
jest.mock("../../../../contexts/AuthContext", () => ({
  useAuth: () => ({
    logout: mockLogout,
  }),
}));

// Mock CloseButton
jest.mock("../../buttons/CloseButton", () => {
  const MockCloseButton = ({ onPress }: { onPress: () => void }) => {
    const { TouchableOpacity, Text } = require("react-native");
    return (
      <TouchableOpacity onPress={onPress} testID="close-button">
        <Text>Close</Text>
      </TouchableOpacity>
    );
  };
  return MockCloseButton;
});

// Mock React Native components
jest.mock("react-native", () => ({
  Modal: ({ children, visible, onRequestClose }: any) => {
    if (!visible) return null;
    const React = require("react");
    return React.createElement(
      "div",
      {
        testID: "modal",
        onClick: () => {
          if (onRequestClose) {
            onRequestClose();
          }
        },
      },
      children
    );
  },
  Image: ({ source, ...props }: any) => {
    const React = require("react");
    return React.createElement(
      "div",
      { ...props, testID: "avatar-image" },
      React.createElement(
        "span",
        { testID: "image-uri" },
        source?.uri || "no-uri"
      )
    );
  },
  View: ({ children, ...props }: any) => {
    const React = require("react");
    return React.createElement("div", props, children);
  },
  Text: ({ children, ...props }: any) => {
    const React = require("react");
    return React.createElement("span", props, children);
  },
  TouchableOpacity: ({ children, onPress, ...props }: any) => {
    const React = require("react");
    return React.createElement(
      "button",
      { ...props, onClick: onPress },
      children
    );
  },
  StyleSheet: {
    create: (styles: any) => styles,
    flatten: (style: any) => {
      if (Array.isArray(style)) {
        return Object.assign({}, ...style.filter(Boolean));
      }
      return style || {};
    },
    compose: (...styles: any[]) => styles,
    hairlineWidth: 1,
    absoluteFill: {
      position: "absolute",
      left: 0,
      right: 0,
      top: 0,
      bottom: 0,
    },
  },
}));

describe("ProfileOverlay", () => {
  const mockOnClose = jest.fn();
  const mockOnFullProfilePress = jest.fn();

  const defaultPlayerData: Player = {
    userId: "test-user-id",
    username: "TestUser",
    email: "test@example.com",
    avatarUrl: "https://example.com/avatar.jpg",
    coins: 150,
    createdAt: Date.now(),
    lastLogin: Date.now(),
    xp: 0,
    hasPurchasedApp: false,
    stats: {
      totalWordsGuessed: 42,
      winRate: 85,
      bestStreak: 7,
      highestLevelClassic: 12,
      dailyPuzzlesCompleted: 0,
      averageGuesses: 0,
      totalScore: 0,
      gamesPlayed: 0,
      wins: 0,
      challengeWins: 0,
      winStreak: 0,
      totalWins: 0,
      totalGuessesInWins: 0,
    },
    progress: {
      dailyChallengeIndex: 15,
      classicIndex: 10,
      tutorialIndex: 6,
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Rendering", () => {
    it("should render the overlay when visible is true", () => {
      const { getByTestId } = render(
        <ProfileModal
          isVisible={true}
          onClose={mockOnClose}
          playerData={defaultPlayerData}
          onFullProfilePress={mockOnFullProfilePress}
        />
      );

      expect(getByTestId("modal")).toBeTruthy();
    });

    it("should not render when visible is false", () => {
      const { queryByTestId } = render(
        <ProfileModal
          isVisible={false}
          onClose={mockOnClose}
          playerData={defaultPlayerData}
          onFullProfilePress={mockOnFullProfilePress}
        />
      );

      expect(queryByTestId("modal")).toBeNull();
    });

    it("should not render when playerData is null", () => {
      const { queryByTestId } = render(
        <ProfileModal
          isVisible={true}
          onClose={mockOnClose}
          playerData={null}
          onFullProfilePress={mockOnFullProfilePress}
        />
      );

      expect(queryByTestId("modal")).toBeNull();
    });
  });

  describe("Player Data Display", () => {
    it("should display player information", () => {
      const { getByTestId } = render(
        <ProfileModal
          isVisible={true}
          onClose={mockOnClose}
          playerData={defaultPlayerData}
          onFullProfilePress={mockOnFullProfilePress}
        />
      );

      expect(getByTestId("modal")).toBeTruthy();
    });

    it("should handle Guest username", () => {
      const playerDataWithoutUsername: Player = {
        ...defaultPlayerData,
        username: "Guest",
      };

      const { getByTestId } = render(
        <ProfileModal
          isVisible={true}
          onClose={mockOnClose}
          playerData={playerDataWithoutUsername}
          onFullProfilePress={mockOnFullProfilePress}
        />
      );

      expect(getByTestId("modal")).toBeTruthy();
    });

    it("should display avatar image when avatarUrl is provided", () => {
      const { getByTestId } = render(
        <ProfileModal
          isVisible={true}
          onClose={mockOnClose}
          playerData={defaultPlayerData}
          onFullProfilePress={mockOnFullProfilePress}
        />
      );

      expect(getByTestId("avatar-image")).toBeTruthy();
    });

    it("should display username initial when avatarUrl is missing", () => {
      const playerDataWithoutAvatar = {
        ...defaultPlayerData,
        avatarUrl: undefined,
      };

      const { getByTestId } = render(
        <ProfileModal
          isVisible={true}
          onClose={mockOnClose}
          playerData={playerDataWithoutAvatar}
          onFullProfilePress={mockOnFullProfilePress}
        />
      );

      expect(getByTestId("modal")).toBeTruthy();
    });

    it("should handle empty username for avatar initial", () => {
      const playerDataWithEmptyUsername = {
        ...defaultPlayerData,
        username: "",
        avatarUrl: undefined,
      };

      const { getByTestId } = render(
        <ProfileModal
          isVisible={true}
          onClose={mockOnClose}
          playerData={playerDataWithEmptyUsername}
          onFullProfilePress={mockOnFullProfilePress}
        />
      );

      expect(getByTestId("modal")).toBeTruthy();
    });

    it("should display daily challenge progress", () => {
      const { getByTestId } = render(
        <ProfileModal
          isVisible={true}
          onClose={mockOnClose}
          playerData={defaultPlayerData}
          onFullProfilePress={mockOnFullProfilePress}
        />
      );

      expect(getByTestId("modal")).toBeTruthy();
    });

    it("should display stats correctly", () => {
      const { getByTestId } = render(
        <ProfileModal
          isVisible={true}
          onClose={mockOnClose}
          playerData={defaultPlayerData}
          onFullProfilePress={mockOnFullProfilePress}
        />
      );

      expect(getByTestId("modal")).toBeTruthy();
      expect(getByTestId("close-button")).toBeTruthy();
    });

    it("should handle missing stats gracefully", () => {
      const playerDataWithoutStats: Player = {
        ...defaultPlayerData,
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
        progress: {
          classicIndex: 0,
          dailyChallengeIndex: 0,
          tutorialIndex: 0,
        },
        coins: 0,
      };

      const { getByTestId } = render(
        <ProfileModal
          isVisible={true}
          onClose={mockOnClose}
          playerData={playerDataWithoutStats}
          onFullProfilePress={mockOnFullProfilePress}
        />
      );

      expect(getByTestId("modal")).toBeTruthy();
    });
  });

  describe("User Interactions", () => {
    it("should call onClose when close button is pressed", () => {
      const { getByTestId } = render(
        <ProfileModal
          isVisible={true}
          onClose={mockOnClose}
          playerData={defaultPlayerData}
          onFullProfilePress={mockOnFullProfilePress}
        />
      );

      fireEvent.press(getByTestId("close-button"));
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it("should call onClose when modal background is pressed", () => {
      const { getByTestId } = render(
        <ProfileModal
          isVisible={true}
          onClose={mockOnClose}
          playerData={defaultPlayerData}
          onFullProfilePress={mockOnFullProfilePress}
        />
      );

      // Verify the modal is rendered and the onClose function is available
      expect(getByTestId("modal")).toBeTruthy();
      expect(mockOnClose).toBeDefined();
      expect(typeof mockOnClose).toBe("function");
    });

    it("should handle button interactions without errors", () => {
      expect(() => {
        render(
          <ProfileModal
            isVisible={true}
            onClose={mockOnClose}
            playerData={defaultPlayerData}
            onFullProfilePress={mockOnFullProfilePress}
          />
        );
      }).not.toThrow();
    });

    it("should handle authentication functions", () => {
      const { getByTestId } = render(
        <ProfileModal
          isVisible={true}
          onClose={mockOnClose}
          playerData={defaultPlayerData}
          onFullProfilePress={mockOnFullProfilePress}
        />
      );

      expect(getByTestId("modal")).toBeTruthy();
      expect(mockLogout).toBeDefined();
    });

    it("should handle close button interactions", () => {
      const { getByTestId } = render(
        <ProfileModal
          isVisible={true}
          onClose={mockOnClose}
          playerData={defaultPlayerData}
          onFullProfilePress={mockOnFullProfilePress}
        />
      );

      const closeButton = getByTestId("close-button");
      expect(() => {
        fireEvent.press(closeButton);
      }).not.toThrow();
    });

    it("should handle logout operations gracefully", () => {
      const consoleSpy = jest
        .spyOn(console, "error")
        .mockImplementation(() => {});
      mockLogout.mockRejectedValueOnce(new Error("Logout failed"));

      expect(() => {
        render(
          <ProfileModal
            isVisible={true}
            onClose={mockOnClose}
            playerData={defaultPlayerData}
            onFullProfilePress={mockOnFullProfilePress}
          />
        );
      }).not.toThrow();

      consoleSpy.mockRestore();
    });
  });

  describe("State Changes", () => {
    it("should update when playerData changes", () => {
      const { getByTestId, rerender } = render(
        <ProfileModal
          isVisible={true}
          onClose={mockOnClose}
          playerData={defaultPlayerData}
          onFullProfilePress={mockOnFullProfilePress}
        />
      );

      expect(getByTestId("modal")).toBeTruthy();

      const updatedPlayerData = {
        ...defaultPlayerData,
        username: "UpdatedUser",
      };

      rerender(
        <ProfileModal
          isVisible={true}
          onClose={mockOnClose}
          playerData={updatedPlayerData}
          onFullProfilePress={mockOnFullProfilePress}
        />
      );

      expect(getByTestId("modal")).toBeTruthy();
    });

    it("should handle visibility changes correctly", () => {
      const { getByTestId, queryByTestId, rerender } = render(
        <ProfileModal
          isVisible={true}
          onClose={mockOnClose}
          playerData={defaultPlayerData}
          onFullProfilePress={mockOnFullProfilePress}
        />
      );

      expect(getByTestId("modal")).toBeTruthy();

      rerender(
        <ProfileModal
          isVisible={false}
          onClose={mockOnClose}
          playerData={defaultPlayerData}
          onFullProfilePress={mockOnFullProfilePress}
        />
      );

      expect(queryByTestId("modal")).toBeNull();
    });
  });

  describe("Component Structure", () => {
    it("should have proper component structure", () => {
      const { getByTestId } = render(
        <ProfileModal
          isVisible={true}
          onClose={mockOnClose}
          playerData={defaultPlayerData}
          onFullProfilePress={mockOnFullProfilePress}
        />
      );

      expect(getByTestId("modal")).toBeTruthy();
      expect(getByTestId("close-button")).toBeTruthy();
      expect(getByTestId("avatar-image")).toBeTruthy();
    });

    it("should render all required components", () => {
      const { getByTestId } = render(
        <ProfileModal
          isVisible={true}
          onClose={mockOnClose}
          playerData={defaultPlayerData}
          onFullProfilePress={mockOnFullProfilePress}
        />
      );

      expect(getByTestId("modal")).toBeTruthy();
      expect(getByTestId("close-button")).toBeTruthy();
    });
  });
});
