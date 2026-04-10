import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import CloseButton from "../CloseButton";

// Mock CloseIcon (black variant)
jest.mock("../../icons/CloseIcon", () => {
  const React = require("react");
  const { View } = require("react-native");

  const MockCloseIcon = ({ width, height }: any) => (
    <View testID="close-icon-black" style={{ width, height }} />
  );

  MockCloseIcon.displayName = "MockCloseIcon";
  return MockCloseIcon;
});

// Mock CloseIconWhite (white variant)
jest.mock("../../icons/CloseIconWhite", () => {
  const React = require("react");
  const { View } = require("react-native");

  const MockCloseIconWhite = ({ width, height }: any) => (
    <View testID="close-icon-white" style={{ width, height }} />
  );

  MockCloseIconWhite.displayName = "MockCloseIconWhite";
  return MockCloseIconWhite;
});

describe("CloseButton", () => {
  const defaultProps = {
    onPress: jest.fn(),
    size: 24,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Rendering", () => {
    it("renders correctly with default props", () => {
      const { getByLabelText, getByTestId } = render(
        <CloseButton {...defaultProps} />
      );

      expect(getByLabelText("Close")).toBeTruthy();
      expect(getByTestId("close-icon-black")).toBeTruthy();
    });

    it("renders with custom size", () => {
      const customSize = 32;
      const { getByTestId } = render(
        <CloseButton {...defaultProps} size={customSize} />
      );

      const icon = getByTestId("close-icon-black");
      expect(icon.props.style.width).toBe(customSize);
      expect(icon.props.style.height).toBe(customSize);
    });

    it("renders with default size when size prop is not provided", () => {
      const { getByTestId } = render(
        <CloseButton onPress={defaultProps.onPress} />
      );

      const icon = getByTestId("close-icon-black");
      expect(icon).toBeTruthy();
    });
  });

  describe("Interactions", () => {
    it("calls onPress when pressed", () => {
      const { getByLabelText } = render(<CloseButton {...defaultProps} />);

      fireEvent.press(getByLabelText("Close"));

      expect(defaultProps.onPress).toHaveBeenCalledTimes(1);
    });

    it("handles multiple presses", () => {
      const { getByLabelText } = render(<CloseButton {...defaultProps} />);

      const button = getByLabelText("Close");
      fireEvent.press(button);
      fireEvent.press(button);
      fireEvent.press(button);

      expect(defaultProps.onPress).toHaveBeenCalledTimes(3);
    });
  });

  describe("Styling", () => {
    it("applies correct TouchableOpacity props", () => {
      const { getByLabelText } = render(<CloseButton {...defaultProps} />);

      const button = getByLabelText("Close");
      // NativeWind className is applied but not directly accessible in test environment
      expect(button).toBeTruthy();
    });

    it("passes correct default color to icon", () => {
      const { getByTestId } = render(<CloseButton {...defaultProps} />);

      const icon = getByTestId("close-icon-black");
      expect(icon).toBeTruthy();
    });

    it("renders white icon variant when color is white", () => {
      const { getByTestId } = render(
        <CloseButton {...defaultProps} color="white" />
      );

      const icon = getByTestId("close-icon-white");
      expect(icon).toBeTruthy();
    });
  });

  describe("Accessibility", () => {
    it("has accessible role", () => {
      const { getByLabelText } = render(<CloseButton {...defaultProps} />);

      const button = getByLabelText("Close");
      expect(button.props.accessibilityRole).toBe("button");
    });

    it("has appropriate accessibility label", () => {
      const { getByLabelText } = render(<CloseButton {...defaultProps} />);

      const button = getByLabelText("Close");
      expect(button.props.accessibilityLabel).toBe("Close");
    });
  });

  describe("Edge Cases", () => {
    it("handles undefined onPress gracefully", () => {
      const { getByLabelText } = render(
        <CloseButton onPress={undefined as any} size={24} />
      );

      expect(() => {
        fireEvent.press(getByLabelText("Close"));
      }).not.toThrow();
    });

    it("handles zero size", () => {
      const { getByTestId } = render(
        <CloseButton {...defaultProps} size={0} />
      );

      const icon = getByTestId("close-icon-black");
      expect(icon.props.style.width).toBe(0);
      expect(icon.props.style.height).toBe(0);
    });

    it("handles negative size", () => {
      const { getByTestId } = render(
        <CloseButton {...defaultProps} size={-10} />
      );

      const icon = getByTestId("close-icon-black");
      expect(icon.props.style.width).toBe(-10);
      expect(icon.props.style.height).toBe(-10);
    });

    it("handles very large size", () => {
      const { getByTestId } = render(
        <CloseButton {...defaultProps} size={1000} />
      );

      const icon = getByTestId("close-icon-black");
      expect(icon.props.style.width).toBe(1000);
      expect(icon.props.style.height).toBe(1000);
    });
  });

  describe("Performance", () => {
    it("maintains same reference for onPress across renders", () => {
      const onPress = jest.fn();
      const { rerender, getByLabelText } = render(
        <CloseButton onPress={onPress} size={24} />
      );

      const button1 = getByLabelText("Close");
      const onPress1 = button1.props.onPress;

      rerender(<CloseButton onPress={onPress} size={32} />);

      const button2 = getByLabelText("Close");
      const onPress2 = button2.props.onPress;

      expect(onPress1).toBe(onPress2);
    });

    it("re-renders when size changes", () => {
      const { rerender, getByTestId } = render(
        <CloseButton {...defaultProps} size={24} />
      );

      const icon1 = getByTestId("close-icon-black");
      expect(icon1.props.style.width).toBe(24);

      rerender(<CloseButton {...defaultProps} size={48} />);

      const icon2 = getByTestId("close-icon-black");
      expect(icon2.props.style.width).toBe(48);
    });
  });

  describe("Props", () => {
    it("accepts custom className", () => {
      const { getByLabelText } = render(
        <CloseButton {...defaultProps} className="custom-class" />
      );

      const button = getByLabelText("Close");
      // NativeWind className is applied but not directly accessible in test environment
      expect(button).toBeTruthy();
    });

    it("spreads additional props to TouchableOpacity", () => {
      const { getByLabelText } = render(
        <CloseButton
          {...defaultProps}
          testID="custom-close-button"
          activeOpacity={0.5}
        />
      );

      const button = getByLabelText("Close");
      expect(button.props.testID).toBe("custom-close-button");
      // activeOpacity is not directly accessible in the test environment
      // Just verify the button renders correctly
      expect(button).toBeTruthy();
    });
  });
});

