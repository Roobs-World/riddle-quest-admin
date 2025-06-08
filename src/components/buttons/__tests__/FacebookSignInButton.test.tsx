import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import FacebookSignInButton from "../FacebookSignInButton";

// Mock the FacebookIcon component
jest.mock("../icons/FacebookIcon", () => {
  const React = require("react");
  const { View } = require("react-native");

  const MockFacebookIcon = ({ width, height, ...props }: any) => (
    <View testID="facebook-icon" style={{ width, height }} {...props} />
  );

  MockFacebookIcon.displayName = "MockFacebookIcon";
  return MockFacebookIcon;
});

// Mock styles
jest.mock("../../../styles", () => ({
  styles: {
    socialButtonText: {},
  },
}));

describe("FacebookSignInButton", () => {
  const mockOnPress = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Rendering", () => {
    it("renders correctly with required props", () => {
      const { getByText, getByTestId } = render(
        <FacebookSignInButton onPress={mockOnPress} />
      );

      expect(getByText("Continue with Facebook")).toBeTruthy();
      expect(getByTestId("facebook-icon")).toBeTruthy();
    });

    it("renders as TouchableOpacity", () => {
      const { UNSAFE_getByType } = render(
        <FacebookSignInButton onPress={mockOnPress} />
      );
      const TouchableOpacity = require("react-native").TouchableOpacity;
      expect(UNSAFE_getByType(TouchableOpacity)).toBeTruthy();
    });

    it("displays correct button text", () => {
      const { getByText } = render(
        <FacebookSignInButton onPress={mockOnPress} />
      );

      const buttonText = getByText("Continue with Facebook");
      expect(buttonText.props.children).toBe("Continue with Facebook");
    });

    it("renders FacebookIcon with correct dimensions", () => {
      const { getByTestId } = render(
        <FacebookSignInButton onPress={mockOnPress} />
      );

      const icon = getByTestId("facebook-icon");
      expect(icon.props.style).toMatchObject({
        width: 24,
        height: 24,
      });
    });
  });

  describe("Enabled State", () => {
    it("applies correct styling when enabled", () => {
      const { UNSAFE_getByType } = render(
        <FacebookSignInButton onPress={mockOnPress} />
      );
      const TouchableOpacity = require("react-native").TouchableOpacity;
      const button = UNSAFE_getByType(TouchableOpacity);

      expect(button.props.className).toContain("bg-white");
      expect(button.props.className).toContain("border-gray-300");
      expect(button.props.disabled).toBe(false);
    });

    it("applies correct text styling when enabled", () => {
      const { getByText } = render(
        <FacebookSignInButton onPress={mockOnPress} />
      );

      const buttonText = getByText("Continue with Facebook");
      expect(buttonText.props.className).toContain("text-gray-700");
    });

    it("calls onPress when pressed and enabled", () => {
      const { UNSAFE_getByType } = render(
        <FacebookSignInButton onPress={mockOnPress} />
      );
      const TouchableOpacity = require("react-native").TouchableOpacity;
      const button = UNSAFE_getByType(TouchableOpacity);

      fireEvent.press(button);

      expect(mockOnPress).toHaveBeenCalledTimes(1);
    });
  });

  describe("Disabled State", () => {
    it("applies correct styling when disabled", () => {
      const { UNSAFE_getByType } = render(
        <FacebookSignInButton onPress={mockOnPress} disabled={true} />
      );
      const TouchableOpacity = require("react-native").TouchableOpacity;
      const button = UNSAFE_getByType(TouchableOpacity);

      expect(button.props.className).toContain("bg-gray-100");
      expect(button.props.className).toContain("border-gray-200");
      expect(button.props.disabled).toBe(true);
    });

    it("applies correct text styling when disabled", () => {
      const { getByText } = render(
        <FacebookSignInButton onPress={mockOnPress} disabled={true} />
      );

      const buttonText = getByText("Continue with Facebook");
      expect(buttonText.props.className).toContain("text-gray-400");
    });

    it("does not call onPress when pressed and disabled", () => {
      const { UNSAFE_getByType } = render(
        <FacebookSignInButton onPress={mockOnPress} disabled={true} />
      );
      const TouchableOpacity = require("react-native").TouchableOpacity;
      const button = UNSAFE_getByType(TouchableOpacity);

      fireEvent.press(button);

      expect(mockOnPress).not.toHaveBeenCalled();
    });

    it("has undefined onPress when disabled", () => {
      const { UNSAFE_getByType } = render(
        <FacebookSignInButton onPress={mockOnPress} disabled={true} />
      );
      const TouchableOpacity = require("react-native").TouchableOpacity;
      const button = UNSAFE_getByType(TouchableOpacity);

      expect(button.props.onPress).toBeUndefined();
    });
  });

  describe("Component Structure", () => {
    it("renders button with flex-row layout", () => {
      const { UNSAFE_getByType } = render(
        <FacebookSignInButton onPress={mockOnPress} />
      );
      const TouchableOpacity = require("react-native").TouchableOpacity;
      const button = UNSAFE_getByType(TouchableOpacity);

      expect(button.props.className).toContain("flex-row");
      expect(button.props.className).toContain("items-center");
      expect(button.props.className).toContain("justify-center");
    });

    it("applies consistent base styling", () => {
      const { UNSAFE_getByType } = render(
        <FacebookSignInButton onPress={mockOnPress} />
      );
      const TouchableOpacity = require("react-native").TouchableOpacity;
      const button = UNSAFE_getByType(TouchableOpacity);

      expect(button.props.className).toContain("w-full");
      expect(button.props.className).toContain("py-3");
      expect(button.props.className).toContain("rounded-lg");
      expect(button.props.className).toContain("shadow-sm");
      expect(button.props.className).toContain("mb-4");
      expect(button.props.className).toContain("border");
    });

    it("contains both icon and text", () => {
      const { getByTestId, getByText } = render(
        <FacebookSignInButton onPress={mockOnPress} />
      );

      expect(getByTestId("facebook-icon")).toBeTruthy();
      expect(getByText("Continue with Facebook")).toBeTruthy();
    });

    it("applies correct text spacing", () => {
      const { getByText } = render(
        <FacebookSignInButton onPress={mockOnPress} />
      );

      const buttonText = getByText("Continue with Facebook");
      expect(buttonText.props.className).toContain("ml-2");
    });
  });

  describe("Default Props", () => {
    it("defaults to enabled when disabled prop not provided", () => {
      const { UNSAFE_getByType } = render(
        <FacebookSignInButton onPress={mockOnPress} />
      );
      const TouchableOpacity = require("react-native").TouchableOpacity;
      const button = UNSAFE_getByType(TouchableOpacity);

      expect(button.props.disabled).toBe(false);
    });

    it("applies enabled styling by default", () => {
      const { UNSAFE_getByType } = render(
        <FacebookSignInButton onPress={mockOnPress} />
      );
      const TouchableOpacity = require("react-native").TouchableOpacity;
      const button = UNSAFE_getByType(TouchableOpacity);

      expect(button.props.className).toContain("bg-white");
      expect(button.props.className).toContain("border-gray-300");
    });
  });

  describe("Interactions", () => {
    it("handles multiple presses when enabled", () => {
      const { UNSAFE_getByType } = render(
        <FacebookSignInButton onPress={mockOnPress} />
      );
      const TouchableOpacity = require("react-native").TouchableOpacity;
      const button = UNSAFE_getByType(TouchableOpacity);

      fireEvent.press(button);
      fireEvent.press(button);
      fireEvent.press(button);

      expect(mockOnPress).toHaveBeenCalledTimes(3);
    });

    it("handles rapid presses when enabled", () => {
      const { UNSAFE_getByType } = render(
        <FacebookSignInButton onPress={mockOnPress} />
      );
      const TouchableOpacity = require("react-native").TouchableOpacity;
      const button = UNSAFE_getByType(TouchableOpacity);

      for (let i = 0; i < 10; i++) {
        fireEvent.press(button);
      }

      expect(mockOnPress).toHaveBeenCalledTimes(10);
    });

    it("remains disabled despite multiple press attempts", () => {
      const { UNSAFE_getByType } = render(
        <FacebookSignInButton onPress={mockOnPress} disabled={true} />
      );
      const TouchableOpacity = require("react-native").TouchableOpacity;
      const button = UNSAFE_getByType(TouchableOpacity);

      for (let i = 0; i < 5; i++) {
        fireEvent.press(button);
      }

      expect(mockOnPress).not.toHaveBeenCalled();
    });
  });

  describe("Performance", () => {
    it("re-renders correctly when disabled state changes", () => {
      const { rerender, UNSAFE_getByType } = render(
        <FacebookSignInButton onPress={mockOnPress} disabled={false} />
      );

      let button = UNSAFE_getByType(require("react-native").TouchableOpacity);
      expect(button.props.disabled).toBe(false);

      rerender(<FacebookSignInButton onPress={mockOnPress} disabled={true} />);

      button = UNSAFE_getByType(require("react-native").TouchableOpacity);
      expect(button.props.disabled).toBe(true);
    });

    it("re-renders correctly when onPress changes", () => {
      const newOnPress = jest.fn();
      const { rerender, UNSAFE_getByType } = render(
        <FacebookSignInButton onPress={mockOnPress} />
      );

      rerender(<FacebookSignInButton onPress={newOnPress} />);

      const TouchableOpacity = require("react-native").TouchableOpacity;
      const button = UNSAFE_getByType(TouchableOpacity);
      fireEvent.press(button);

      expect(newOnPress).toHaveBeenCalledTimes(1);
      expect(mockOnPress).not.toHaveBeenCalled();
    });

    it("handles rapid prop updates", () => {
      const { rerender } = render(
        <FacebookSignInButton onPress={mockOnPress} disabled={false} />
      );

      // Rapid updates
      for (let i = 0; i < 10; i++) {
        rerender(
          <FacebookSignInButton onPress={mockOnPress} disabled={i % 2 === 0} />
        );
      }

      expect(true).toBe(true); // Should not throw errors
    });
  });

  describe("Accessibility", () => {
    it("maintains button semantics", () => {
      const { UNSAFE_getByType } = render(
        <FacebookSignInButton onPress={mockOnPress} />
      );
      const TouchableOpacity = require("react-native").TouchableOpacity;
      expect(UNSAFE_getByType(TouchableOpacity)).toBeTruthy();
    });

    it("provides accessible text content", () => {
      const { getByText } = render(
        <FacebookSignInButton onPress={mockOnPress} />
      );

      const buttonText = getByText("Continue with Facebook");
      expect(buttonText).toBeTruthy();
    });
  });

  describe("Props Validation", () => {
    it("requires onPress prop", () => {
      expect(() => {
        render(<FacebookSignInButton onPress={mockOnPress} />);
      }).not.toThrow();
    });

    it("handles boolean disabled prop", () => {
      expect(() => {
        render(<FacebookSignInButton onPress={mockOnPress} disabled={true} />);
      }).not.toThrow();

      expect(() => {
        render(<FacebookSignInButton onPress={mockOnPress} disabled={false} />);
      }).not.toThrow();
    });
  });

  describe("Edge Cases", () => {
    it("maintains text content consistency", () => {
      const { getByText } = render(
        <FacebookSignInButton onPress={mockOnPress} />
      );

      expect(getByText("Continue with Facebook")).toBeTruthy();
    });
  });
});
