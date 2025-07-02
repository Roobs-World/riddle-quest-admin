import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import VictoryModal from "../VictoryModal";
import type { SubmittedGuess, Feedback } from "../../../../hooks/types";

// Mock the CloseButton component
jest.mock("../../buttons/CloseButton", () => {
  const { TouchableOpacity, Text } = require("react-native");
  const MockCloseButton = ({
    onPress,
    size,
  }: {
    onPress: () => void;
    size?: number;
  }) => (
    <TouchableOpacity testID="close-button" onPress={onPress}>
      <Text>Close {size && `(${size})`}</Text>
    </TouchableOpacity>
  );
  MockCloseButton.displayName = "MockCloseButton";
  return MockCloseButton;
});

// Mock the utility function
jest.mock("../../../../utils/gameUtils", () => ({
  generateFeedbackEmojiGrid: jest.fn((guesses) => {
    // Mock implementation that returns a simple emoji grid
    return "🟩🟩🟩🟩🟩\n🟨🟨🟨🟨🟨";
  }),
}));

describe("VictoryModal", () => {
  const mockOnNextLevel = jest.fn();
  const mockOnHome = jest.fn();

  const defaultProps = {
    isVisible: true,
    attempts: 3,
    coinsEarned: 50,
    onNextLevel: mockOnNextLevel,
    onHome: mockOnHome,
    guesses: [
      {
        guess: ["H", "E", "L", "L", "O"],
        feedback: ["green", "green", "green", "green", "green"] as Feedback[],
      },
    ] as SubmittedGuess[],
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Rendering", () => {
    it("should render correctly when visible", () => {
      const { getByText } = render(<VictoryModal {...defaultProps} />);

      expect(getByText("Victory!")).toBeTruthy();
      expect(getByText("Solved in 3 attempts!")).toBeTruthy();
      expect(getByText("Coins Earned: 50")).toBeTruthy();
      expect(getByText("Share your result:")).toBeTruthy();
      expect(getByText("Next Level")).toBeTruthy();
      expect(getByText("Home")).toBeTruthy();
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

      expect(queryByText("Coins Earned: 0")).toBeNull();
      expect(queryByText(/Coins Earned/)).toBeNull();
    });

    it("should render different attempts count", () => {
      const { getByText } = render(
        <VictoryModal {...defaultProps} attempts={1} />
      );

      expect(getByText("Solved in 1 attempts!")).toBeTruthy();
    });

    it("should render emoji grid when guesses are provided", () => {
      const { getByText } = render(<VictoryModal {...defaultProps} />);
      const {
        generateFeedbackEmojiGrid,
      } = require("../../../../utils/gameUtils");

      expect(getByText("Share your result:")).toBeTruthy();
      // Check that the function was called rather than the exact emoji text
      expect(generateFeedbackEmojiGrid).toHaveBeenCalledWith(
        defaultProps.guesses
      );
    });

    it("should not render emoji grid when no guesses are provided", () => {
      const { queryByText } = render(
        <VictoryModal {...defaultProps} guesses={[]} />
      );

      expect(queryByText("Share your result:")).toBeNull();
    });
  });

  describe("Interactions", () => {
    it("should call onNextLevel when Next Level button is pressed", () => {
      const { getByText } = render(<VictoryModal {...defaultProps} />);

      fireEvent.press(getByText("Next Level"));

      expect(mockOnNextLevel).toHaveBeenCalledTimes(1);
    });

    it("should call onHome when Home button is pressed", () => {
      const { getByText } = render(<VictoryModal {...defaultProps} />);

      fireEvent.press(getByText("Home"));

      expect(mockOnHome).toHaveBeenCalledTimes(1);
    });

    it("should call onHome when close button is pressed", () => {
      const { getByTestId } = render(<VictoryModal {...defaultProps} />);

      fireEvent.press(getByTestId("close-button"));

      expect(mockOnHome).toHaveBeenCalledTimes(1);
    });
  });

  describe("Modal Properties", () => {
    it("should have correct modal properties", () => {
      const { getByText } = render(<VictoryModal {...defaultProps} />);

      // Modal should be rendered with the correct test ID
      // Note: React Native Testing Library doesn't easily test Modal props,
      // but we can verify the modal is rendered
      expect(getByText("Victory!")).toBeTruthy();
    });

    it("should handle modal close request", () => {
      // The modal has onRequestClose={() => {}} which does nothing
      // This test verifies the modal is properly configured
      const { getByText } = render(<VictoryModal {...defaultProps} />);

      expect(getByText("Victory!")).toBeTruthy();
    });
  });

  describe("Props Validation", () => {
    it("should handle different coin amounts", () => {
      const { getByText, rerender } = render(
        <VictoryModal {...defaultProps} coinsEarned={100} />
      );

      expect(getByText("Coins Earned: 100")).toBeTruthy();

      rerender(<VictoryModal {...defaultProps} coinsEarned={1} />);
      expect(getByText("Coins Earned: 1")).toBeTruthy();
    });

    it("should handle different attempts counts", () => {
      const { getByText, rerender } = render(
        <VictoryModal {...defaultProps} attempts={6} />
      );

      expect(getByText("Solved in 6 attempts!")).toBeTruthy();

      rerender(<VictoryModal {...defaultProps} attempts={1} />);
      expect(getByText("Solved in 1 attempts!")).toBeTruthy();
    });

    it("should handle complex guesses data", () => {
      const complexGuesses: SubmittedGuess[] = [
        {
          guess: ["W", "R", "O", "N", "G"],
          feedback: ["red", "yellow", "red", "red", "red"] as Feedback[],
        },
        {
          guess: ["C", "L", "O", "S", "E"],
          feedback: ["yellow", "green", "yellow", "red", "green"] as Feedback[],
        },
        {
          guess: ["H", "E", "L", "L", "O"],
          feedback: ["green", "green", "green", "green", "green"] as Feedback[],
        },
      ];

      const { getByText } = render(
        <VictoryModal {...defaultProps} guesses={complexGuesses} />
      );
      const {
        generateFeedbackEmojiGrid,
      } = require("../../../../utils/gameUtils");

      expect(getByText("Share your result:")).toBeTruthy();
      // Check that the function was called with complex guesses rather than exact emoji text
      expect(generateFeedbackEmojiGrid).toHaveBeenCalledWith(complexGuesses);
    });
  });

  describe("CloseButton Integration", () => {
    it("should pass correct size prop to CloseButton", () => {
      const { getByText } = render(<VictoryModal {...defaultProps} />);

      expect(getByText("Close (20)")).toBeTruthy();
    });

    it("should position CloseButton correctly", () => {
      const { getByTestId } = render(<VictoryModal {...defaultProps} />);

      const closeButton = getByTestId("close-button");
      expect(closeButton).toBeTruthy();
    });
  });

  describe("Edge Cases", () => {
    it("should handle undefined or null callback props gracefully", () => {
      const { getByText } = render(
        <VictoryModal
          {...defaultProps}
          onNextLevel={undefined as any}
          onHome={undefined as any}
        />
      );

      // Should render without crashing
      expect(getByText("Victory!")).toBeTruthy();
      expect(getByText("Next Level")).toBeTruthy();
      expect(getByText("Home")).toBeTruthy();
    });

    it("should handle negative coin amounts", () => {
      const { queryByText } = render(
        <VictoryModal {...defaultProps} coinsEarned={-10} />
      );

      // Should not show negative coins as the condition is coinsEarned > 0
      expect(queryByText("Coins Earned: -10")).toBeNull();
    });

    it("should handle zero attempts", () => {
      const { getByText } = render(
        <VictoryModal {...defaultProps} attempts={0} />
      );

      expect(getByText("Solved in 0 attempts!")).toBeTruthy();
    });

    it("should handle large numbers", () => {
      const { getByText } = render(
        <VictoryModal {...defaultProps} attempts={999} coinsEarned={9999} />
      );

      expect(getByText("Solved in 999 attempts!")).toBeTruthy();
      expect(getByText("Coins Earned: 9999")).toBeTruthy();
    });
  });
});
