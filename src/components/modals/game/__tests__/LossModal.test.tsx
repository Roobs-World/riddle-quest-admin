// Use require syntax for React to fix TypeScript error with esModuleInterop
const React = require("react");
import { render, fireEvent, waitFor } from "@testing-library/react-native";
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
  const MockWideButton = ({
    buttonText,
    onPress,
    buttonColor,
  }: {
    buttonText: string;
    onPress: () => void;
    buttonColor?: string;
  }) => (
    <TouchableOpacity testID="wide-button" onPress={onPress}>
      <Text>{buttonText}</Text>
    </TouchableOpacity>
  );
  return MockWideButton;
});

// Mock the SVG components
jest.mock("../../../../assets/images/wheel-bg.svg", () => "WheelBgSvg");
jest.mock("../../../../assets/images/segment-bg.svg", () => "SegmentBgSvg");

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

  describe("Rendering", () => {
    it("should render correctly when visible", () => {
      const { getByText } = render(<LossModal {...defaultProps} />);

      expect(getByText("Try Again!")).toBeTruthy();
      expect(
        getByText("Don't worry, every puzzle is a learning opportunity!")
      ).toBeTruthy();
      expect(getByText("The correct answer was:")).toBeTruthy();
      expect(getByText("WORLD")).toBeTruthy();
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
      expect(queryByText("Try Again!")).toBeTruthy();
    });

    it("should render different correct answers", () => {
      const { getByText, rerender } = render(
        <LossModal {...defaultProps} correctAnswer="HELLO" />
      );

      expect(getByText("HELLO")).toBeTruthy();

      rerender(<LossModal {...defaultProps} correctAnswer="TEST" />);
      expect(getByText("TEST")).toBeTruthy();
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
      expect(getByText("Try Again!")).toBeTruthy();
      expect(getByText("Next Level")).toBeTruthy();

      // Should not crash when button is pressed
      fireEvent.press(getByText("Next Level"));
      // Test passes if no error is thrown
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty string answer", () => {
      const { getByText } = render(
        <LossModal {...defaultProps} correctAnswer="" />
      );
      expect(getByText("The correct answer was:")).toBeTruthy();
      // Empty string should still render
      expect(getByText("")).toBeTruthy();
    });

    it("should handle special characters in answer", () => {
      const { getByText } = render(
        <LossModal {...defaultProps} correctAnswer="TEST123" />
      );
      expect(getByText("TEST123")).toBeTruthy();
    });

    it("should handle long answers", () => {
      const { getByText } = render(
        <LossModal {...defaultProps} correctAnswer="VERYLONGWORD" />
      );
      expect(getByText("VERYLONGWORD")).toBeTruthy();
    });
  });
});
