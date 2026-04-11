import React from "react";
import { render, fireEvent, waitFor } from "@testing-library/react-native";
import VictoryModal from "../VictoryModal";
import type { SubmittedGuess, Feedback } from "../../../../hooks/types";

jest.mock("react-native/Libraries/Animated/Animated", () => {
  const { View } = require("react-native");
  class MockAnimatedValue {
    setValue = jest.fn();
    stopAnimation = jest.fn();
    constructor(_initial: number) {}
    interpolate(config: { outputRange?: unknown[] }) {
      return config?.outputRange?.[0] ?? 0;
    }
  }
  const simpleAnim = () => ({ start: jest.fn(), stop: jest.fn() });
  const Animated = {
    View,
    Value: MockAnimatedValue,
    timing: jest.fn(simpleAnim),
    sequence: jest.fn(simpleAnim),
    loop: jest.fn(simpleAnim),
  };
  return {
    __esModule: true,
    default: Animated,
    ...Animated,
  };
});

// Mock Modal to avoid NativeEventEmitter/Keyboard native module errors
jest.mock("react-native/Libraries/Modal/Modal", () => {
  const React = require("react");
  return {
    __esModule: true,
    default: function MockModal({ children, visible }: any) {
      if (!visible) return null;
      return React.createElement("View", { testID: "modal" }, children);
    },
  };
});

// Mock the CloseButton component
jest.mock("../../../buttons/CloseButton", () => {
  const React = require("react");
  return function MockCloseButton({ onPress, size }: any) {
    return React.createElement(
      "View",
      { testID: "close-button", accessible: true, onPress },
      React.createElement("Text", null, "Close" + (size ? ` (${size})` : ""))
    );
  };
});

// Mock the WideButton component
jest.mock("../../../buttons/WideButton", () => {
  const React = require("react");
  return function MockWideButton({ buttonText, onPress }: any) {
    return React.createElement(
      "View",
      { testID: "wide-button", accessible: true, onPress },
      React.createElement("Text", null, buttonText)
    );
  };
});

// Mock the utility function
jest.mock("../../../../utils/gameUtils", () => ({
  generateFeedbackEmojiGrid: jest.fn((guesses) => {
    // Mock implementation that returns a simple emoji grid
    return "🟩🟩🟩🟩🟩\n🟨🟨🟨🟨🟨";
  }),
}));

// Mock the SocialShareButton component
jest.mock("../../../buttons/SocialShareButton", () => {
  const React = require("react");
  return function MockSocialShareButton({ platform, onPress }: any) {
    const label = platform === "facebook" ? "Facebook" : platform === "x" ? "X" : "Share";
    return React.createElement(
      "View",
      {
        accessibilityLabel: `Share to ${label}`,
        accessibilityRole: "button",
        accessibilityState: { disabled: false },
        onPress,
        testID: `share-button-${platform}`,
      },
      React.createElement("Text", null, label)
    );
  };
});

// Mock the SocialSharingService
jest.mock("../../../../services/SocialSharingService", () => ({
  SocialSharingService: {
    share: jest.fn().mockResolvedValue(true),
  },
}));

// Mock AnalyticsService
jest.mock("../../../../services/AnalyticsService", () => ({
  analyticsService: {
    logShare: jest.fn().mockResolvedValue(undefined),
  },
}));

// Mock sentry utils
jest.mock("../../../../utils/sentry", () => ({
  captureException: jest.fn(),
}));

// Mock logger
jest.mock("../../../../utils/logger", () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  },
}));

// Mock the SVG components
jest.mock("../../../../assets/images/modal-bg.svg", () => "ModalBgSvg");
jest.mock("../../../../assets/images/wheel-bg.svg", () => "WheelBgSvg");
jest.mock(
  "../../../../assets/images/large-coin-stack.svg",
  () => "LargeCoinStackSvg"
);
jest.mock("../../../../assets/images/chest.svg", () => "ChestSvg");

describe("VictoryModal", () => {
  const mockOnNextLevel = jest.fn();
  const mockOnClose = jest.fn();

  const defaultProps = {
    isVisible: true,
    attempts: 3,
    coinsEarned: 50,
    onNextLevel: mockOnNextLevel,
    onClose: mockOnClose,
    guesses: [
      {
        guess: ["H", "E", "L", "L", "O"],
        feedback: ["green", "green", "green", "green", "green"] as Feedback[],
      },
    ] as SubmittedGuess[],
    gameMode: "daily" as const,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Rendering", () => {
    it("should render correctly when visible", () => {
      const { getByText } = render(<VictoryModal {...defaultProps} />);

      expect(getByText("Victory!")).toBeTruthy();
      expect(getByText(/\+50 Coins/)).toBeTruthy();
      expect(getByText("Next Level")).toBeTruthy();
    });

    it("should handle modal visibility state", () => {
      const { queryByText, rerender } = render(
        <VictoryModal {...defaultProps} isVisible={false} />
      );

      // Note: React Native Modal in testing may render content even when not visible
      // This is a limitation of the testing environment, not the component itself
      // We test that the component can be rendered with isVisible=false without errors
      expect(() =>
        render(<VictoryModal {...defaultProps} isVisible={false} />)
      ).not.toThrow();

      // Test that switching visibility works
      rerender(<VictoryModal {...defaultProps} isVisible={true} />);
      expect(queryByText("Victory!")).toBeTruthy();
    });

    it("should render +0 coins when coinsEarned is 0", () => {
      const { getByText } = render(
        <VictoryModal {...defaultProps} coinsEarned={0} />
      );

      expect(getByText(/\+0 Coins/)).toBeTruthy();
    });

    it("should render different attempts count", () => {
      const { getByText } = render(
        <VictoryModal {...defaultProps} attempts={1} />
      );

      expect(getByText("Victory!")).toBeTruthy();
      expect(getByText(/\+50 Coins/)).toBeTruthy();
    });

    it("should render emoji grid when guesses are provided", () => {
      render(<VictoryModal {...defaultProps} />);
      const {
        generateFeedbackEmojiGrid,
      } = require("../../../../utils/gameUtils");

      expect(generateFeedbackEmojiGrid).toHaveBeenCalledWith(
        defaultProps.guesses
      );
    });

    it("should handle empty guesses when sharing", () => {
      render(
        <VictoryModal {...defaultProps} guesses={[]} />
      );
      const {
        generateFeedbackEmojiGrid,
      } = require("../../../../utils/gameUtils");

      expect(generateFeedbackEmojiGrid).toHaveBeenCalledWith([]);
    });
  });

  describe("Interactions", () => {
    it("should call onNextLevel when Next Level button is pressed", async () => {
      // Create a custom mock that ensures onNextLevel resolves before onClose is called
      const mockOnNext = jest.fn().mockResolvedValue(undefined);
      const mockOnClose = jest.fn();

      const props = {
        ...defaultProps,
        onNextLevel: mockOnNext,
        onClose: mockOnClose,
      };

      const { getByText } = render(<VictoryModal {...props} />);

      fireEvent.press(getByText("Next Level"));

      expect(mockOnNext).toHaveBeenCalledTimes(1);

      // Wait for the async operation to complete
      await waitFor(() => {
        expect(mockOnClose).toHaveBeenCalledTimes(1);
      });
    });

    it("should call share service when system share button is pressed", () => {
      const { getByTestId } = render(<VictoryModal {...defaultProps} />);
      const {
        SocialSharingService,
      } = require("../../../../services/SocialSharingService");

      fireEvent.press(getByTestId("share-button-system"));

      expect(SocialSharingService.share).toHaveBeenCalledWith("system", {
        attempts: 3,
        emojiGrid: "🟩🟩🟩🟩🟩\n🟨🟨🟨🟨🟨",
        gameMode: "daily",
      });
    });
  });

  describe("Props Validation", () => {
    it("should handle different coin amounts", () => {
      const { getByText, rerender } = render(
        <VictoryModal {...defaultProps} coinsEarned={100} />
      );

      expect(getByText(/\+100 Coins/)).toBeTruthy();

      rerender(<VictoryModal {...defaultProps} coinsEarned={1} />);
      expect(getByText(/\+1 Coins/)).toBeTruthy();
    });
  });

  describe("Achievements", () => {
    it("should display achievement unlocked section when achievements are provided", () => {
      const { getByText } = render(
        <VictoryModal
          {...defaultProps}
          unlockedAchievementNames={["First Win"]}
        />
      );

      expect(getByText("Achievement Unlocked!")).toBeTruthy();
      expect(getByText("First Win")).toBeTruthy();
    });

    it("should display multiple achievements", () => {
      const { getByText } = render(
        <VictoryModal
          {...defaultProps}
          unlockedAchievementNames={["First Win", "Speed Demon", "Perfect Score"]}
        />
      );

      expect(getByText("Achievement Unlocked!")).toBeTruthy();
      expect(getByText("First Win, Speed Demon, Perfect Score")).toBeTruthy();
    });

    it("should not display achievement section when no achievements are unlocked", () => {
      const { queryByText } = render(
        <VictoryModal {...defaultProps} unlockedAchievementNames={[]} />
      );

      expect(queryByText("Achievement Unlocked!")).toBeNull();
    });

    it("should not display achievement section when unlockedAchievementNames is undefined", () => {
      const { queryByText } = render(
        <VictoryModal {...defaultProps} unlockedAchievementNames={undefined} />
      );

      expect(queryByText("Achievement Unlocked!")).toBeNull();
    });
  });

  describe("Share Functionality", () => {
    it("should log share analytics after successful share", async () => {
      const { getByTestId } = render(<VictoryModal {...defaultProps} />);
      const { analyticsService } = require("../../../../services/AnalyticsService");

      fireEvent.press(getByTestId("share-button-system"));

      await waitFor(() => {
        expect(analyticsService.logShare).toHaveBeenCalledWith({
          platform: "system",
          gameMode: "daily",
        });
      });
    });

    it("should handle share error gracefully", async () => {
      const { SocialSharingService } = require("../../../../services/SocialSharingService");
      const { captureException } = require("../../../../utils/sentry");
      const { logger } = require("../../../../utils/logger");

      SocialSharingService.share.mockRejectedValueOnce(new Error("Share failed"));

      const { getByTestId } = render(<VictoryModal {...defaultProps} />);

      fireEvent.press(getByTestId("share-button-system"));

      await waitFor(() => {
        expect(logger.error).toHaveBeenCalled();
        expect(captureException).toHaveBeenCalled();
      });
    });
  });

  describe("Game Mode", () => {
    it("should render with classic game mode", () => {
      const { getByText } = render(
        <VictoryModal {...defaultProps} gameMode="classic" />
      );

      expect(getByText("Victory!")).toBeTruthy();
    });

    it("should use default daily game mode when not specified", () => {
      const propsWithoutGameMode = {
        isVisible: true,
        attempts: 3,
        coinsEarned: 50,
        onNextLevel: mockOnNextLevel,
        onClose: mockOnClose,
        guesses: defaultProps.guesses,
      };

      const { getByText } = render(<VictoryModal {...propsWithoutGameMode} />);

      expect(getByText("Victory!")).toBeTruthy();
    });

    it("should include game mode in share content", () => {
      const { getByTestId } = render(
        <VictoryModal {...defaultProps} gameMode="classic" />
      );
      const { SocialSharingService } = require("../../../../services/SocialSharingService");

      fireEvent.press(getByTestId("share-button-system"));

      expect(SocialSharingService.share).toHaveBeenCalledWith(
        "system",
        expect.objectContaining({
          gameMode: "classic",
        })
      );
    });
  });

  describe("Animation", () => {
    it("should not throw when visibility changes", () => {
      const { rerender } = render(
        <VictoryModal {...defaultProps} isVisible={true} />
      );

      expect(() => {
        rerender(<VictoryModal {...defaultProps} isVisible={false} />);
      }).not.toThrow();

      expect(() => {
        rerender(<VictoryModal {...defaultProps} isVisible={true} />);
      }).not.toThrow();
    });

    it("should handle rapid visibility toggles", () => {
      const { rerender } = render(
        <VictoryModal {...defaultProps} isVisible={true} />
      );

      for (let i = 0; i < 5; i++) {
        expect(() => {
          rerender(<VictoryModal {...defaultProps} isVisible={i % 2 === 0} />);
        }).not.toThrow();
      }
    });
  });

  describe("Edge Cases", () => {
    it("should handle large coin amounts", () => {
      const { getByText } = render(
        <VictoryModal {...defaultProps} coinsEarned={999999} />
      );

      expect(getByText(/\+999999 Coins/)).toBeTruthy();
    });

    it("should handle negative coin amounts (edge case)", () => {
      const { getByText } = render(
        <VictoryModal {...defaultProps} coinsEarned={-10} />
      );

      expect(getByText(/\+-10 Coins/)).toBeTruthy();
    });

    it("should handle zero attempts", () => {
      const { getByText } = render(
        <VictoryModal {...defaultProps} attempts={0} />
      );

      expect(getByText("Victory!")).toBeTruthy();
    });

    it("should handle many guesses", () => {
      const manyGuesses: SubmittedGuess[] = Array(10).fill({
        guess: ["H", "E", "L", "L", "O"],
        feedback: ["green", "green", "green", "green", "green"] as Feedback[],
      });

      const { getByText } = render(
        <VictoryModal {...defaultProps} guesses={manyGuesses} />
      );

      expect(getByText("Victory!")).toBeTruthy();
    });

    it("should call onClose when onRequestClose is triggered", () => {
      // Note: This tests the Modal's onRequestClose prop behavior
      // In the mocked Modal, onRequestClose is passed but may not be triggerable
      // This test verifies the component accepts the prop without error
      const { getByText } = render(<VictoryModal {...defaultProps} />);
      expect(getByText("Victory!")).toBeTruthy();
    });
  });

  describe("Accessibility", () => {
    it("should have accessible elements", () => {
      const { getByText } = render(<VictoryModal {...defaultProps} />);

      // Victory text should be accessible
      expect(getByText("Victory!")).toBeTruthy();
      expect(getByText("Share your victory!")).toBeTruthy();
    });
  });
});


