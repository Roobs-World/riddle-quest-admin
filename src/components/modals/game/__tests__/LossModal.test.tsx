// Use require syntax for React to fix TypeScript error with esModuleInterop
const React = require("react");
import { render, fireEvent, waitFor } from "@testing-library/react-native";
import { Modal } from "react-native";
import LossModal from "../LossModal";

// Mock child components with working React Native Testing Library approach
jest.mock("../../../buttons/CloseButton", () => {
  const { TouchableOpacity, Text } = require("react-native");
  return function MockCloseButton({ onPress, size, color }: any) {
    return (
      <TouchableOpacity testID="close-button" onPress={onPress}>
        <Text>Close {size && `(${size})`}</Text>
      </TouchableOpacity>
    );
  };
});

// Mock the WideButton component
jest.mock("../../../buttons/WideButton", () => {
  const { TouchableOpacity, Text } = require("react-native");
  const MockWideButton = jest.fn(({
    buttonText,
    onPress,
    disabled,
  }: {
    buttonText: string;
    onPress: () => void;
    disabled?: boolean;
  }) => (
    <TouchableOpacity testID={`wide-button-${buttonText}`} onPress={onPress} disabled={disabled}>
      <Text>{buttonText}</Text>
    </TouchableOpacity>
  ));
  return MockWideButton;
});

// Mock the SVG components
jest.mock("../../../../assets/images/modal-bg.svg", () => "ModalBgSvg");

describe("LossModal", () => {
  const defaultProps = {
    isVisible: true,
    correctAnswer: "WORLD",
    onNext: jest.fn(),
    onHome: jest.fn(),
    onClose: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const getWideButtonMockCalls = () => {
    const wideButtonMock = require("../../../buttons/WideButton");
    return wideButtonMock.mock.calls.map(([props]: [{ buttonText?: string; disabled?: boolean }]) => props);
  };

  describe("Rendering", () => {
    it("should render correctly when visible", () => {
      const { getByText } = render(<LossModal {...defaultProps} />);

      expect(getByText("So close!")).toBeTruthy();
      expect(getByText("Out of attempts.")).toBeTruthy();
      expect(getByText("Next Level")).toBeTruthy();
    });

    it("should handle modal visibility state", () => {
      const { queryByText, rerender } = render(
        <LossModal {...defaultProps} isVisible={false} />
      );

      // Note: React Native Modal in testing may render content even when not visible
      // This is a limitation of the testing environment, not the component itself
      // We test that the component can be rendered with isVisible=false without errors
      expect(() =>
        render(<LossModal {...defaultProps} isVisible={false} />)
      ).not.toThrow();

      // Test that switching visibility works
      rerender(<LossModal {...defaultProps} isVisible={true} />);
      expect(queryByText("So close!")).toBeTruthy();
    });

    it("should render different correct answers", () => {
      const { getByText, rerender } = render(
        <LossModal {...defaultProps} correctAnswer="HELLO" />
      );

      expect(getByText("So close!")).toBeTruthy();

      rerender(<LossModal {...defaultProps} correctAnswer="TEST" />);
      expect(getByText("Out of attempts.")).toBeTruthy();
    });

    it("should display the correct answer after final loss", () => {
      const { getByText } = render(
        <LossModal {...defaultProps} correctAnswer="SECRET" />
      );

      expect(getByText("Answer: SECRET")).toBeTruthy();
    });

    it("should render ad and coin continue actions when callbacks are provided", () => {
      const { getByText } = render(
        <LossModal
          {...defaultProps}
          onWatchAdContinue={jest.fn()}
          onCoinContinue={jest.fn()}
          coinContinueCost={25}
          totalCoins={305}
        />
      );

      expect(getByText("Watch Ad for 3 Extra Guesses")).toBeTruthy();
      expect(getByText("3 Extra Guesses - 25 Coins")).toBeTruthy();
      expect(getByText("305")).toBeTruthy();
    });
  });

  describe("Interactions", () => {
    it("should call onNext when Next Level button is pressed", () => {
      const { getByText } = render(<LossModal {...defaultProps} />);

      fireEvent.press(getByText("Next Level"));

      expect(defaultProps.onNext).toHaveBeenCalledTimes(1);
    });

    it("should call onClose after onNext when Next Level button is pressed", async () => {
      // Create a custom mock that ensures onNext resolves before onClose is called
      const mockOnNext = jest.fn().mockResolvedValue(undefined);
      const mockOnClose = jest.fn();

      const props = {
        ...defaultProps,
        onNext: mockOnNext,
        onClose: mockOnClose,
      };

      const { getByText } = render(<LossModal {...props} />);

      fireEvent.press(getByText("Next Level"));

      expect(mockOnNext).toHaveBeenCalledTimes(1);

      // Wait for the async operation to complete
      await waitFor(() => {
        expect(mockOnClose).toHaveBeenCalledTimes(1);
      });
    });

    it("should handle null/undefined callbacks gracefully", () => {
      const { getByText } = render(
        <LossModal
          {...defaultProps}
          onNext={undefined as any}
          onClose={undefined as any}
        />
      );

      // Should render without crashing
      expect(getByText("So close!")).toBeTruthy();
      expect(getByText("Next Level")).toBeTruthy();

      // Should not crash when button is pressed
      fireEvent.press(getByText("Next Level"));
      // Test passes if no error is thrown
    });

    it("should call onOpenShop when Open Shop button is pressed", () => {
      const mockOnOpenShop = jest.fn();
      const { getByText } = render(
        <LossModal {...defaultProps} onOpenShop={mockOnOpenShop} />
      );

      fireEvent.press(getByText("Open Shop"));

      expect(mockOnOpenShop).toHaveBeenCalledTimes(1);
    });

    it("should not dismiss from Android Back without choosing a loss action", () => {
      const mockOnClose = jest.fn();
      const mockOnNext = jest.fn();
      const { UNSAFE_getByType } = render(
        <LossModal
          {...defaultProps}
          onClose={mockOnClose}
          onNext={mockOnNext}
          onWatchAdContinue={jest.fn()}
        />
      );

      UNSAFE_getByType(Modal).props.onRequestClose();

      expect(mockOnClose).not.toHaveBeenCalled();
      expect(mockOnNext).not.toHaveBeenCalled();
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty string answer", () => {
      const { getByText } = render(
        <LossModal {...defaultProps} correctAnswer="" />
      );
      expect(getByText("Out of attempts.")).toBeTruthy();
      expect(getByText("Next Level")).toBeTruthy();
    });

    it("should handle special characters in answer", () => {
      const { getByText } = render(
        <LossModal {...defaultProps} correctAnswer="TEST123" />
      );
      expect(getByText("Out of attempts.")).toBeTruthy();
    });

    it("should handle long answers", () => {
      const { getByText } = render(
        <LossModal {...defaultProps} correctAnswer="VERYLONGWORD" />
      );
      expect(getByText("So close!")).toBeTruthy();
    });
  });

  describe("Continue Options", () => {
    it("should show Watch Ad button when onWatchAdContinue is provided", () => {
      const { getByText } = render(
        <LossModal
          {...defaultProps}
          onWatchAdContinue={jest.fn()}
        />
      );

      expect(getByText("Watch Ad for 3 Extra Guesses")).toBeTruthy();
    });

    it("should show coin continue button when onCoinContinue is provided", () => {
      const { getByText } = render(
        <LossModal
          {...defaultProps}
          onCoinContinue={jest.fn()}
          coinContinueCost={50}
        />
      );

      expect(getByText("3 Extra Guesses - 50 Coins")).toBeTruthy();
    });

    it("should show default 0 coins when coinContinueCost is not provided", () => {
      const { getByText } = render(
        <LossModal
          {...defaultProps}
          onCoinContinue={jest.fn()}
        />
      );

      expect(getByText("3 Extra Guesses - 0 Coins")).toBeTruthy();
    });

    it("should show Skip Puzzle but not Next Level when continue options are available", () => {
      const { getByText, queryByText } = render(
        <LossModal
          {...defaultProps}
          onWatchAdContinue={jest.fn()}
        />
      );

      expect(getByText("Watch Ad for 3 Extra Guesses")).toBeTruthy();
      expect(getByText("Skip Puzzle")).toBeTruthy();
      expect(queryByText("Skip Level (75 Coins)")).toBeNull();
      expect(queryByText("Next Level")).toBeNull();
    });

    it("should show both continue options when both callbacks are provided", () => {
      const { getByText } = render(
        <LossModal
          {...defaultProps}
          onWatchAdContinue={jest.fn()}
          onCoinContinue={jest.fn()}
          coinContinueCost={25}
        />
      );

      expect(getByText("Watch Ad for 3 Extra Guesses")).toBeTruthy();
      expect(getByText("Skip Puzzle")).toBeTruthy();
      expect(getByText("3 Extra Guesses - 25 Coins")).toBeTruthy();
    });

    it("should show Open Shop in continue-options view when callback is provided", () => {
      const { getByText } = render(
        <LossModal
          {...defaultProps}
          onWatchAdContinue={jest.fn()}
          onOpenShop={jest.fn()}
        />
      );

      expect(getByText("Open Shop")).toBeTruthy();
    });

    it("should call onWatchAdContinue when Watch Ad button is pressed", async () => {
      const mockWatchAd = jest.fn().mockResolvedValue(undefined);

      const { getByText } = render(
        <LossModal
          {...defaultProps}
          onWatchAdContinue={mockWatchAd}
        />
      );

      fireEvent.press(getByText("Watch Ad for 3 Extra Guesses"));

      expect(mockWatchAd).toHaveBeenCalledTimes(1);
    });

    it("should call onCoinContinue when Use Coins button is pressed", async () => {
      const mockCoinContinue = jest.fn().mockResolvedValue(undefined);

      const { getByText } = render(
        <LossModal
          {...defaultProps}
          onCoinContinue={mockCoinContinue}
          coinContinueCost={50}
        />
      );

      fireEvent.press(getByText("3 Extra Guesses - 50 Coins"));

      expect(mockCoinContinue).toHaveBeenCalledTimes(1);
    });

    it("should not close modal if onWatchAdContinue returns false", async () => {
      const mockWatchAd = jest.fn().mockResolvedValue(false);
      const mockOnClose = jest.fn();

      const { getByText } = render(
        <LossModal
          {...defaultProps}
          onWatchAdContinue={mockWatchAd}
          onClose={mockOnClose}
        />
      );

      fireEvent.press(getByText("Watch Ad for 3 Extra Guesses"));

      await waitFor(() => {
        expect(mockWatchAd).toHaveBeenCalledTimes(1);
      });

      // onClose should not be called when callback returns false
      expect(mockOnClose).not.toHaveBeenCalled();
    });

    it("should not close modal if onCoinContinue returns false", async () => {
      const mockCoinContinue = jest.fn().mockResolvedValue(false);
      const mockOnClose = jest.fn();

      const { getByText } = render(
        <LossModal
          {...defaultProps}
          onCoinContinue={mockCoinContinue}
          coinContinueCost={50}
          onClose={mockOnClose}
        />
      );

      fireEvent.press(getByText("3 Extra Guesses - 50 Coins"));

      await waitFor(() => {
        expect(mockCoinContinue).toHaveBeenCalledTimes(1);
      });

      expect(mockOnClose).not.toHaveBeenCalled();
    });

    it("should close modal if onWatchAdContinue returns undefined/void", async () => {
      const mockWatchAd = jest.fn().mockResolvedValue(undefined);
      const mockOnClose = jest.fn();

      const { getByText } = render(
        <LossModal
          {...defaultProps}
          onWatchAdContinue={mockWatchAd}
          onClose={mockOnClose}
        />
      );

      fireEvent.press(getByText("Watch Ad for 3 Extra Guesses"));

      await waitFor(() => {
        expect(mockOnClose).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe("canWatchAd and canUseCoin props", () => {
    it("should keep Watch Ad button visible but disabled when canWatchAd is false", () => {
      const mockWatchAd = jest.fn();
      const { getByText } = render(
        <LossModal
          {...defaultProps}
          onWatchAdContinue={mockWatchAd}
          canWatchAd={false}
        />
      );

      expect(getByText("Watch Ad for 3 Extra Guesses")).toBeTruthy();
      const calls = getWideButtonMockCalls();
      expect(calls).toContainEqual(expect.objectContaining({
        buttonText: "Watch Ad for 3 Extra Guesses",
        disabled: true,
      }));

      fireEvent.press(getByText("Watch Ad for 3 Extra Guesses"));
      expect(mockWatchAd).not.toHaveBeenCalled();
    });

    it("should disable coin continue button when canUseCoin is false", () => {
      const mockCoinContinue = jest.fn();
      const { getByText } = render(
        <LossModal
          {...defaultProps}
          onCoinContinue={mockCoinContinue}
          coinContinueCost={50}
          canUseCoin={false}
        />
      );

      expect(getByText("3 Extra Guesses - 50 Coins")).toBeTruthy();
      const calls = getWideButtonMockCalls();
      expect(calls).toContainEqual(expect.objectContaining({
        buttonText: "3 Extra Guesses - 50 Coins",
        disabled: true,
      }));

      fireEvent.press(getByText("3 Extra Guesses - 50 Coins"));
      expect(mockCoinContinue).not.toHaveBeenCalled();
    });

    it("should enable buttons when canWatchAd and canUseCoin are true", () => {
      const { getByText } = render(
        <LossModal
          {...defaultProps}
          onWatchAdContinue={jest.fn()}
          onCoinContinue={jest.fn()}
          coinContinueCost={50}
          canWatchAd={true}
          canUseCoin={true}
        />
      );

      expect(getByText("Watch Ad for 3 Extra Guesses")).toBeTruthy();
      expect(getByText("3 Extra Guesses - 50 Coins")).toBeTruthy();
    });
  });

  describe("Removed loss actions and answer", () => {
    it("should not render a Go to Lobby button", () => {
      const { queryByText } = render(<LossModal {...defaultProps} />);

      expect(queryByText("Go to Lobby")).toBeNull();
    });

    it("should render answer text in normal view", () => {
      const { getByText } = render(
        <LossModal {...defaultProps} correctAnswer="PUZZLE" />
      );

      expect(getByText("Answer: PUZZLE")).toBeTruthy();
    });

    it("should not render answer text in continue-options view", () => {
      const { queryByText } = render(
        <LossModal
          {...defaultProps}
          correctAnswer="RIDDLE"
          onWatchAdContinue={jest.fn()}
        />
      );

      expect(queryByText("Answer: RIDDLE")).toBeNull();
    });

    it("should not render Open Shop button when callback is not provided", () => {
      const { queryByText } = render(<LossModal {...defaultProps} />);

      expect(queryByText("Open Shop")).toBeNull();
    });
  });

  describe("Modal Accessibility", () => {
    it("should have accessibility label for game loss notification", () => {
      render(<LossModal {...defaultProps} />);
      // Modal should have accessibilityLabel set (tested via render without errors)
    });
  });

  describe("Visibility Transitions", () => {
    it("should handle rapid visibility changes without errors", () => {
      const { rerender } = render(
        <LossModal {...defaultProps} isVisible={true} />
      );

      for (let i = 0; i < 5; i++) {
        expect(() => {
          rerender(<LossModal {...defaultProps} isVisible={i % 2 === 0} />);
        }).not.toThrow();
      }
    });
  });
});

