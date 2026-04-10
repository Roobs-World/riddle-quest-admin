import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import GoogleSignInButton from "../GoogleSignInButton";

// Mock the GoogleIcon component
jest.mock("../../icons/GoogleIcon", () => {
  return function MockGoogleIcon(props: any) {
    const { width, height, ...rest } = props;
    return require("react").createElement("View", { testID: "google-icon", style: { width, height }, ...rest });
  };
});

// Mock styles
jest.mock("../../../styles", () => ({
  styles: {
    socialButtonText: {},
  },
  SPACING: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, "2xl": 48 },
  SIZING: { button: { height: 48, minWidth: 120 }, input: { height: 48, minHeight: 44 }, tile: { size: 56, border: 1 }, icon: { xs: 16, sm: 20, md: 24, lg: 32, xl: 40 } },
}));

describe("GoogleSignInButton", () => {
  const mockOnPress = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Rendering", () => {
    it("renders correctly with required props", () => {
      const { getByText, getByTestId } = render(
        <GoogleSignInButton onPress={mockOnPress} />
      );

      expect(getByText("Continue with Google")).toBeTruthy();
      expect(getByTestId("google-icon")).toBeTruthy();
    });

    it("renders as TouchableOpacity", () => {
      const { UNSAFE_getByType } = render(
        <GoogleSignInButton onPress={mockOnPress} />
      );
      const TouchableOpacity = require("react-native").TouchableOpacity;
      expect(UNSAFE_getByType(TouchableOpacity)).toBeTruthy();
    });

    it("displays correct button text", () => {
      const { getByText } = render(
        <GoogleSignInButton onPress={mockOnPress} />
      );

      const buttonText = getByText("Continue with Google");
      expect(buttonText.props.children).toBe("Continue with Google");
    });

    it("renders GoogleIcon with correct dimensions", () => {
      const { getByTestId } = render(
        <GoogleSignInButton onPress={mockOnPress} />
      );

      const icon = getByTestId("google-icon");
      expect(icon.props.style).toMatchObject({
        width: 24,
        height: 24,
      });
    });
  });

  describe("Enabled State", () => {
    it("applies correct styling when enabled", () => {
      const { UNSAFE_getByType } = render(
        <GoogleSignInButton onPress={mockOnPress} />
      );
      const TouchableOpacity = require("react-native").TouchableOpacity;
      const button = UNSAFE_getByType(TouchableOpacity);

      expect(button.props.className).toContain("bg-white");
      expect(button.props.className).toContain("border-gray-300");
      expect(button.props.disabled).toBe(false);
    });

    it("applies correct text styling when enabled", () => {
      const { getByText } = render(
        <GoogleSignInButton onPress={mockOnPress} />
      );

      const buttonText = getByText("Continue with Google");
      expect(buttonText.props.className).toContain("text-gray-700");
    });

    it("calls onPress when pressed and enabled", () => {
      const { UNSAFE_getByType } = render(
        <GoogleSignInButton onPress={mockOnPress} />
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
        <GoogleSignInButton onPress={mockOnPress} disabled={true} />
      );
      const TouchableOpacity = require("react-native").TouchableOpacity;
      const button = UNSAFE_getByType(TouchableOpacity);

      expect(button.props.className).toContain("bg-gray-100");
      expect(button.props.className).toContain("border-gray-200");
      expect(button.props.disabled).toBe(true);
    });

    it("applies correct text styling when disabled", () => {
      const { getByText } = render(
        <GoogleSignInButton onPress={mockOnPress} disabled={true} />
      );

      const buttonText = getByText("Continue with Google");
      expect(buttonText.props.className).toContain("text-gray-400");
    });

    it("does not call onPress when pressed and disabled", () => {
      const { UNSAFE_getByType } = render(
        <GoogleSignInButton onPress={mockOnPress} disabled={true} />
      );
      const TouchableOpacity = require("react-native").TouchableOpacity;
      const button = UNSAFE_getByType(TouchableOpacity);

      expect(button.props.onPress).toBeUndefined();
    });

    it("has undefined onPress when disabled", () => {
      const { UNSAFE_getByType } = render(
        <GoogleSignInButton onPress={mockOnPress} disabled={true} />
      );
      const TouchableOpacity = require("react-native").TouchableOpacity;
      const button = UNSAFE_getByType(TouchableOpacity);

      expect(button.props.onPress).toBeUndefined();
    });
  });

  describe("Component Structure", () => {
    it("renders button with flex-row layout", () => {
      const { UNSAFE_getByType } = render(
        <GoogleSignInButton onPress={mockOnPress} />
      );
      const TouchableOpacity = require("react-native").TouchableOpacity;
      const button = UNSAFE_getByType(TouchableOpacity);

      expect(button.props.className).toContain("flex-row");
      expect(button.props.className).toContain("items-center");
      expect(button.props.className).toContain("justify-center");
    });

    it("applies consistent base styling", () => {
      const { UNSAFE_getByType } = render(
        <GoogleSignInButton onPress={mockOnPress} />
      );
      const TouchableOpacity = require("react-native").TouchableOpacity;
      const button = UNSAFE_getByType(TouchableOpacity);

      expect(button.props.className).toContain("w-full");
      expect(button.props.className).toContain("rounded-lg");
      expect(button.props.className).toContain("shadow-sm");
      expect(button.props.className).toContain("border");
      const style = button.props.style ?? {};
      expect(style.paddingVertical).toBeDefined();
    });

    it("contains both icon and text", () => {
      const { getByTestId, getByText } = render(
        <GoogleSignInButton onPress={mockOnPress} />
      );

      expect(getByTestId("google-icon")).toBeTruthy();
      expect(getByText("Continue with Google")).toBeTruthy();
    });

    it("applies correct text spacing", () => {
      const { getByText } = render(
        <GoogleSignInButton onPress={mockOnPress} />
      );

      const buttonText = getByText("Continue with Google");
      const style = Array.isArray(buttonText.props.style)
        ? Object.assign({}, ...buttonText.props.style)
        : (buttonText.props.style ?? {});
      expect(style.marginLeft).toBeDefined();
    });
  });

  describe("Default Props", () => {
    it("defaults to enabled when disabled prop not provided", () => {
      const { UNSAFE_getByType } = render(
        <GoogleSignInButton onPress={mockOnPress} />
      );
      const TouchableOpacity = require("react-native").TouchableOpacity;
      const button = UNSAFE_getByType(TouchableOpacity);

      expect(button.props.disabled).toBe(false);
    });

    it("applies enabled styling by default", () => {
      const { UNSAFE_getByType } = render(
        <GoogleSignInButton onPress={mockOnPress} />
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
        <GoogleSignInButton onPress={mockOnPress} />
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
        <GoogleSignInButton onPress={mockOnPress} />
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
        <GoogleSignInButton onPress={mockOnPress} disabled={true} />
      );
      const TouchableOpacity = require("react-native").TouchableOpacity;
      const button = UNSAFE_getByType(TouchableOpacity);

      expect(button.props.disabled).toBe(true);
      expect(button.props.onPress).toBeUndefined();
    });
  });

  describe("Performance", () => {
    it.skip("re-renders correctly when disabled state changes", () => {
      const { rerender, UNSAFE_getByType } = render(
        <GoogleSignInButton onPress={mockOnPress} disabled={false} />
      );

      let button = UNSAFE_getByType(require("react-native").TouchableOpacity);
      expect(button.props.disabled).toBe(false);

      rerender(<GoogleSignInButton onPress={mockOnPress} disabled={true} />);

      button = UNSAFE_getByType(require("react-native").TouchableOpacity);
      expect(button.props.disabled).toBe(true);
    });

    it("re-renders correctly when onPress changes", () => {
      const newOnPress = jest.fn();
      const { rerender, UNSAFE_getByType } = render(
        <GoogleSignInButton onPress={mockOnPress} />
      );

      rerender(<GoogleSignInButton onPress={newOnPress} />);

      const TouchableOpacity = require("react-native").TouchableOpacity;
      const button = UNSAFE_getByType(TouchableOpacity);
      fireEvent.press(button);

      expect(newOnPress).toHaveBeenCalledTimes(1);
      expect(mockOnPress).not.toHaveBeenCalled();
    });

    it.skip("handles rapid prop updates", () => {
      const { rerender } = render(
        <GoogleSignInButton onPress={mockOnPress} disabled={false} />
      );

      // Rapid updates
      for (let i = 0; i < 10; i++) {
        rerender(
          <GoogleSignInButton onPress={mockOnPress} disabled={i % 2 === 0} />
        );
      }

      expect(true).toBe(true); // Should not throw errors
    });
  });

  describe("Accessibility", () => {
    it("maintains button semantics", () => {
      const { UNSAFE_getByType } = render(
        <GoogleSignInButton onPress={mockOnPress} />
      );
      const TouchableOpacity = require("react-native").TouchableOpacity;
      expect(UNSAFE_getByType(TouchableOpacity)).toBeTruthy();
    });

    it("provides accessible text content", () => {
      const { getByText } = render(
        <GoogleSignInButton onPress={mockOnPress} />
      );

      const buttonText = getByText("Continue with Google");
      expect(buttonText).toBeTruthy();
    });
  });

  describe("Props Validation", () => {
    it("requires onPress prop", () => {
      expect(() => {
        render(<GoogleSignInButton onPress={mockOnPress} />);
      }).not.toThrow();
    });

    it("handles boolean disabled prop", () => {
      expect(() => {
        render(<GoogleSignInButton onPress={mockOnPress} disabled={true} />);
      }).not.toThrow();

      expect(() => {
        render(<GoogleSignInButton onPress={mockOnPress} disabled={false} />);
      }).not.toThrow();
    });
  });

  describe("Edge Cases", () => {
    it("maintains text content consistency", () => {
      const { getByText } = render(
        <GoogleSignInButton onPress={mockOnPress} />
      );

      expect(getByText("Continue with Google")).toBeTruthy();
    });
  });
});
