import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import SignUpButton from "../SignUpButton";

// Mock styles
jest.mock("../../../styles", () => ({
  styles: {
    signUpButtonText: {},
  },
}));

describe("SignUpButton", () => {
  const mockOnPress = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Rendering", () => {
    it("renders correctly with required props", () => {
      const { getByText } = render(<SignUpButton onPress={mockOnPress} />);

      expect(getByText("Sign up")).toBeTruthy();
    });

    it("renders as TouchableOpacity", () => {
      const { UNSAFE_getByType } = render(
        <SignUpButton onPress={mockOnPress} />
      );
      const TouchableOpacity = require("react-native").TouchableOpacity;
      expect(UNSAFE_getByType(TouchableOpacity)).toBeTruthy();
    });

    it("displays correct button text", () => {
      const { getByText } = render(<SignUpButton onPress={mockOnPress} />);

      const buttonText = getByText("Sign up");
      expect(buttonText.props.children).toBe("Sign up");
    });
  });

  describe("Styling", () => {
    it("applies correct button styling", () => {
      const { UNSAFE_getByType } = render(
        <SignUpButton onPress={mockOnPress} />
      );
      const TouchableOpacity = require("react-native").TouchableOpacity;
      const button = UNSAFE_getByType(TouchableOpacity);

      expect(button.props.className).toContain("px-8");
      expect(button.props.className).toContain("py-2");
      expect(button.props.className).toContain("border");
      expect(button.props.className).toContain("rounded-xl");
    });

    it("applies correct text styling", () => {
      const { getByText } = render(<SignUpButton onPress={mockOnPress} />);

      const buttonText = getByText("Sign up");
      expect(buttonText.props.className).toContain("text-sm");
      expect(buttonText.props.className).toContain("text-gray-800");
      expect(buttonText.props.className).toContain("font-semibold");
    });
  });

  describe("Interaction", () => {
    it("calls onPress when button is pressed", () => {
      const { UNSAFE_getByType } = render(
        <SignUpButton onPress={mockOnPress} />
      );
      const TouchableOpacity = require("react-native").TouchableOpacity;
      const button = UNSAFE_getByType(TouchableOpacity);

      fireEvent.press(button);

      expect(mockOnPress).toHaveBeenCalledTimes(1);
    });

    it("calls onPress when text is pressed", () => {
      const { getByText } = render(<SignUpButton onPress={mockOnPress} />);
      const buttonText = getByText("Sign up");

      fireEvent.press(buttonText);

      expect(mockOnPress).toHaveBeenCalledTimes(1);
    });

    it("handles multiple presses", () => {
      const { UNSAFE_getByType } = render(
        <SignUpButton onPress={mockOnPress} />
      );
      const TouchableOpacity = require("react-native").TouchableOpacity;
      const button = UNSAFE_getByType(TouchableOpacity);

      fireEvent.press(button);
      fireEvent.press(button);
      fireEvent.press(button);

      expect(mockOnPress).toHaveBeenCalledTimes(3);
    });

    it("handles onPress callback changes", () => {
      const { rerender, UNSAFE_getByType } = render(
        <SignUpButton onPress={mockOnPress} />
      );
      const TouchableOpacity = require("react-native").TouchableOpacity;

      let button = UNSAFE_getByType(TouchableOpacity);
      fireEvent.press(button);
      expect(mockOnPress).toHaveBeenCalledTimes(1);

      const newMockOnPress = jest.fn();
      rerender(<SignUpButton onPress={newMockOnPress} />);

      button = UNSAFE_getByType(TouchableOpacity);
      fireEvent.press(button);
      expect(newMockOnPress).toHaveBeenCalledTimes(1);
      expect(mockOnPress).toHaveBeenCalledTimes(1); // Should still be 1
    });
  });

  describe("Props", () => {
    it("requires onPress prop", () => {
      expect(() => {
        render(<SignUpButton onPress={mockOnPress} />);
      }).not.toThrow();
    });

    it("works with different onPress functions", () => {
      const customOnPress = jest.fn();
      const { UNSAFE_getByType } = render(
        <SignUpButton onPress={customOnPress} />
      );
      const TouchableOpacity = require("react-native").TouchableOpacity;
      const button = UNSAFE_getByType(TouchableOpacity);

      fireEvent.press(button);

      expect(customOnPress).toHaveBeenCalledTimes(1);
      expect(mockOnPress).not.toHaveBeenCalled();
    });
  });

  describe("Component Structure", () => {
    it("has correct component hierarchy", () => {
      const { UNSAFE_getByType, getByText } = render(
        <SignUpButton onPress={mockOnPress} />
      );
      const TouchableOpacity = require("react-native").TouchableOpacity;

      expect(UNSAFE_getByType(TouchableOpacity)).toBeTruthy();
      expect(getByText("Sign up")).toBeTruthy();
    });

    it("renders container with correct styling", () => {
      const { UNSAFE_getAllByType } = render(
        <SignUpButton onPress={mockOnPress} />
      );
      const View = require("react-native").View;
      const views = UNSAFE_getAllByType(View);

      // Should have a container View
      expect(views.length).toBeGreaterThan(0);
      const containerView = views[0];
      expect(containerView.props.className).toContain("flex-row");
      expect(containerView.props.className).toContain("items-center");
      expect(containerView.props.className).toContain("mt-8");
    });

    it("contains TouchableOpacity within View", () => {
      const { UNSAFE_getAllByType, UNSAFE_getByType } = render(
        <SignUpButton onPress={mockOnPress} />
      );
      const View = require("react-native").View;
      const TouchableOpacity = require("react-native").TouchableOpacity;

      expect(UNSAFE_getAllByType(View).length).toBeGreaterThan(0);
      expect(UNSAFE_getByType(TouchableOpacity)).toBeTruthy();
    });
  });

  describe("Performance", () => {
    it("re-renders correctly when props change", () => {
      const { rerender, getByText } = render(
        <SignUpButton onPress={mockOnPress} />
      );

      expect(getByText("Sign up")).toBeTruthy();

      const newOnPress = jest.fn();
      rerender(<SignUpButton onPress={newOnPress} />);

      expect(getByText("Sign up")).toBeTruthy();
    });

    it("maintains event handler consistency", () => {
      const { UNSAFE_getByType } = render(
        <SignUpButton onPress={mockOnPress} />
      );
      const TouchableOpacity = require("react-native").TouchableOpacity;
      const button = UNSAFE_getByType(TouchableOpacity);

      // Press multiple times
      fireEvent.press(button);
      fireEvent.press(button);

      expect(mockOnPress).toHaveBeenCalledTimes(2);
    });
  });

  describe("Accessibility", () => {
    it("provides accessible text content", () => {
      const { getByText } = render(<SignUpButton onPress={mockOnPress} />);

      const buttonText = getByText("Sign up");
      expect(buttonText).toBeTruthy();
    });

    it("is touchable for accessibility", () => {
      const { UNSAFE_getByType } = render(
        <SignUpButton onPress={mockOnPress} />
      );
      const TouchableOpacity = require("react-native").TouchableOpacity;
      expect(UNSAFE_getByType(TouchableOpacity)).toBeTruthy();
    });
  });

  describe("Edge Cases", () => {
    it("maintains consistent text content", () => {
      const { getByText } = render(<SignUpButton onPress={mockOnPress} />);

      expect(getByText("Sign up")).toBeTruthy();
    });

    it("maintains styling consistency", () => {
      const { UNSAFE_getByType } = render(
        <SignUpButton onPress={mockOnPress} />
      );
      const TouchableOpacity = require("react-native").TouchableOpacity;
      const button = UNSAFE_getByType(TouchableOpacity);

      expect(button.props.className).toContain("px-8");
      expect(button.props.className).toContain("py-2");
    });

    it("handles rapid successive presses", () => {
      const { UNSAFE_getByType } = render(
        <SignUpButton onPress={mockOnPress} />
      );
      const TouchableOpacity = require("react-native").TouchableOpacity;
      const button = UNSAFE_getByType(TouchableOpacity);

      // Rapid presses
      for (let i = 0; i < 5; i++) {
        fireEvent.press(button);
      }

      expect(mockOnPress).toHaveBeenCalledTimes(5);
    });

    it("works with onPress that throws", () => {
      const throwingOnPress = jest.fn(() => {
        throw new Error("Test error");
      });

      const { UNSAFE_getByType } = render(
        <SignUpButton onPress={throwingOnPress} />
      );
      const TouchableOpacity = require("react-native").TouchableOpacity;
      const button = UNSAFE_getByType(TouchableOpacity);

      expect(() => {
        fireEvent.press(button);
      }).toThrow("Test error");

      expect(throwingOnPress).toHaveBeenCalledTimes(1);
    });
  });

  describe("Styling Integration", () => {
    it("applies styles prop to text element", () => {
      const { getByText } = render(<SignUpButton onPress={mockOnPress} />);
      const buttonText = getByText("Sign up");

      // Should have the style prop from styles.signUpButtonText
      expect(buttonText.props.style).toBeDefined();
    });

    it("combines className and style props correctly", () => {
      const { getByText } = render(<SignUpButton onPress={mockOnPress} />);
      const buttonText = getByText("Sign up");

      expect(buttonText.props.className).toContain("text-sm");
      expect(buttonText.props.style).toBeDefined();
    });
  });
});
