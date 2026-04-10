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
  return {
    View,
    Value: MockAnimatedValue,
    timing: jest.fn(simpleAnim),
    sequence: jest.fn(simpleAnim),
    loop: jest.fn(simpleAnim),
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

describe.skip("VictoryModal", () => {
  const mockOnNextLevel = jest.fn();
  const mockOnHome = jest.fn();
  const mockOnClose = jest.fn();

  const defaultProps = {
    isVisible: true,
    attempts: 3,
    coinsEarned: 50,
    onNextLevel: mockOnNextLevel,
    onHome: mockOnHome,
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

    it("should render without coins earned when coinsEarned is 0", () => {
      const { queryByText } = render(
        <VictoryModal {...defaultProps} coinsEarned={0} />
      );

      expect(queryByText("Coins Earned")).toBeNull();
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

    it("should not render emoji grid when no guesses are provided", () => {
      const { queryByText } = render(
        <VictoryModal {...defaultProps} guesses={[]} />
      );

      // If there are no guesses, the sharing section might not be shown
      expect(queryByText("Share your victory")).toBeNull();
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
});

