import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import BottomNavigationBar from "../BottomNavigationBar";

// Mock icon components
jest.mock("../../icons/ProfileIcon", () => {
  const React = require("react");
  const { View } = require("react-native");

  const MockProfileIcon = ({ width, height, color, testID }: any) => (
    <View
      testID={testID || "profile-icon"}
      style={{ width, height, backgroundColor: color }}
    />
  );

  MockProfileIcon.displayName = "MockProfileIcon";
  return MockProfileIcon;
});

jest.mock("../../icons/SettingsIcon", () => {
  const React = require("react");
  const { View } = require("react-native");

  const MockSettingsIcon = ({ width, height, color, testID }: any) => (
    <View
      testID={testID || "settings-icon"}
      style={{ width, height, backgroundColor: color }}
    />
  );

  MockSettingsIcon.displayName = "MockSettingsIcon";
  return MockSettingsIcon;
});

// Mock AppStrings
jest.mock("../../../constants/AppStrings", () => ({
  AppStrings: {
    Navigation: {
      PROFILE_BUTTON: "Profile",
      SETTINGS_BUTTON: "Settings",
    },
  },
}));

describe("BottomNavigationBar", () => {
  const defaultProps = {
    onProfilePress: jest.fn(),
    onSettingsPress: jest.fn(),
    onSubmitPress: jest.fn(),
    currentGuess: ["A", "P", "P", "L", "E"],
    answerLength: 5,
    gameOver: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Rendering", () => {
    it("renders all navigation elements correctly", () => {
      const { getByText, getByTestId } = render(
        <BottomNavigationBar {...defaultProps} />
      );

      expect(getByText("Profile")).toBeTruthy();
      expect(getByText("Settings")).toBeTruthy();
      expect(getByText("Submit")).toBeTruthy();
      expect(getByTestId("profile-icon")).toBeTruthy();
      expect(getByTestId("settings-icon")).toBeTruthy();
    });

    it("renders with correct layout structure", () => {
      const { getByTestId } = render(<BottomNavigationBar {...defaultProps} />);

      const bottomNav = getByTestId("bottom-navigation-bar");
      expect(bottomNav.props.className).toContain("px-4");
      expect(bottomNav.props.className).toContain("pt-6");
      expect(bottomNav.props.className).toContain("pb-2");
    });

    it("renders icons with correct dimensions and color", () => {
      const { getByTestId } = render(<BottomNavigationBar {...defaultProps} />);

      const profileIcon = getByTestId("profile-icon");
      const settingsIcon = getByTestId("settings-icon");

      expect(profileIcon.props.style).toMatchObject({
        width: 24,
        height: 24,
        backgroundColor: "#FFFFFF",
      });

      expect(settingsIcon.props.style).toMatchObject({
        width: 24,
        height: 24,
        backgroundColor: "#FFFFFF",
      });
    });
  });

  describe("Submit Button States", () => {
    it("enables submit button when guess is complete and game not over", () => {
      const { getByTestId } = render(<BottomNavigationBar {...defaultProps} />);

      const submitButton = getByTestId("submit-button");
      expect(submitButton.props.disabled).toBeFalsy();
    });

    it("disables submit button when guess is incomplete", () => {
      const { getByTestId } = render(
        <BottomNavigationBar {...defaultProps} currentGuess={["A", "P", "P"]} />
      );

      const submitButton = getByTestId("submit-button");
      expect(submitButton.props.disabled).toBeTruthy();
    });

    it("disables submit button when game is over", () => {
      const { getByTestId } = render(
        <BottomNavigationBar {...defaultProps} gameOver={true} />
      );

      const submitButton = getByTestId("submit-button");
      expect(submitButton.props.disabled).toBeTruthy();
    });

    it("shows correct styling for enabled submit button", () => {
      const { getByTestId } = render(<BottomNavigationBar {...defaultProps} />);

      const submitButton = getByTestId("submit-button");
      expect(submitButton.props.className).toContain("bg-blue-500");
      expect(submitButton.props.className).not.toContain("bg-gray-400");
    });

    it("shows correct styling for disabled submit button", () => {
      const { getByTestId } = render(
        <BottomNavigationBar {...defaultProps} currentGuess={["A"]} />
      );

      const submitButton = getByTestId("submit-button");
      expect(submitButton.props.className).toContain("bg-gray-400");
      expect(submitButton.props.className).not.toContain("bg-blue-500");
    });
  });

  describe("Button Interactions", () => {
    it("calls onProfilePress when profile button is pressed", () => {
      const { getByTestId } = render(<BottomNavigationBar {...defaultProps} />);

      const profileButton = getByTestId("profile-button");
      fireEvent.press(profileButton);

      expect(defaultProps.onProfilePress).toHaveBeenCalledTimes(1);
    });

    it("calls onSettingsPress when settings button is pressed", () => {
      const { getByTestId } = render(<BottomNavigationBar {...defaultProps} />);

      const settingsButton = getByTestId("settings-button");
      fireEvent.press(settingsButton);

      expect(defaultProps.onSettingsPress).toHaveBeenCalledTimes(1);
    });

    it("calls onSubmitPress when submit button is pressed and enabled", () => {
      const { getByTestId } = render(<BottomNavigationBar {...defaultProps} />);

      const submitButton = getByTestId("submit-button");
      fireEvent.press(submitButton);

      expect(defaultProps.onSubmitPress).toHaveBeenCalledTimes(1);
    });

    it("does not call onSubmitPress when submit button is disabled", () => {
      const { getByTestId } = render(
        <BottomNavigationBar {...defaultProps} currentGuess={["A"]} />
      );

      const submitButton = getByTestId("submit-button");
      fireEvent.press(submitButton);

      // Component now properly checks disabled state before calling onSubmitPress
      expect(defaultProps.onSubmitPress).not.toHaveBeenCalled();
    });

    it("handles multiple button presses correctly", () => {
      const { getByTestId } = render(<BottomNavigationBar {...defaultProps} />);

      const profileButton = getByTestId("profile-button");
      const settingsButton = getByTestId("settings-button");
      const submitButton = getByTestId("submit-button");

      fireEvent.press(profileButton);
      fireEvent.press(settingsButton);
      fireEvent.press(submitButton);

      expect(defaultProps.onProfilePress).toHaveBeenCalledTimes(1);
      expect(defaultProps.onSettingsPress).toHaveBeenCalledTimes(1);
      expect(defaultProps.onSubmitPress).toHaveBeenCalledTimes(1);
    });
  });

  describe("Submit Button Logic", () => {
    it("correctly calculates submit disabled state for different guess lengths", () => {
      const testCases = [
        { guess: [], answerLength: 5, expectedDisabled: true },
        { guess: ["A"], answerLength: 5, expectedDisabled: true },
        {
          guess: ["A", "P", "P", "L"],
          answerLength: 5,
          expectedDisabled: true,
        },
        {
          guess: ["A", "P", "P", "L", "E"],
          answerLength: 5,
          expectedDisabled: false,
        },
        {
          guess: ["A", "P", "P", "L", "E", "S"],
          answerLength: 5,
          expectedDisabled: true,
        },
      ];

      testCases.forEach(({ guess, answerLength, expectedDisabled }) => {
        const { getByTestId } = render(
          <BottomNavigationBar
            {...defaultProps}
            currentGuess={guess}
            answerLength={answerLength}
          />
        );

        const submitButton = getByTestId("submit-button");
        expect(submitButton.props.disabled).toBe(expectedDisabled);
      });
    });

    it("handles different answer lengths correctly", () => {
      const testCases = [
        { guess: ["C", "A", "T"], answerLength: 3, expectedDisabled: false },
        {
          guess: ["H", "O", "U", "S", "E"],
          answerLength: 4,
          expectedDisabled: true,
        },
        {
          guess: ["W", "O", "R", "D"],
          answerLength: 4,
          expectedDisabled: false,
        },
      ];

      testCases.forEach(({ guess, answerLength, expectedDisabled }) => {
        const { getByTestId } = render(
          <BottomNavigationBar
            {...defaultProps}
            currentGuess={guess}
            answerLength={answerLength}
          />
        );

        const submitButton = getByTestId("submit-button");
        expect(submitButton.props.disabled).toBe(expectedDisabled);
      });
    });
  });

  describe("Accessibility", () => {
    it("has proper accessibility properties for all buttons", () => {
      const { getByTestId } = render(<BottomNavigationBar {...defaultProps} />);

      const profileButton = getByTestId("profile-button");
      const settingsButton = getByTestId("settings-button");
      const submitButton = getByTestId("submit-button");

      expect(profileButton.props.accessible).toBeTruthy();
      expect(settingsButton.props.accessible).toBeTruthy();
      expect(submitButton.props.accessible).toBeTruthy();
    });

    it("has proper accessibility labels", () => {
      const { getByTestId } = render(<BottomNavigationBar {...defaultProps} />);

      const profileButton = getByTestId("profile-button");
      const settingsButton = getByTestId("settings-button");
      const submitButton = getByTestId("submit-button");

      expect(profileButton.props.accessibilityLabel).toBe("Open profile");
      expect(settingsButton.props.accessibilityLabel).toBe("Open settings");
      expect(submitButton.props.accessibilityLabel).toBe(
        "Submit current guess"
      );
    });

    it("has proper accessibility roles", () => {
      const { getByTestId } = render(<BottomNavigationBar {...defaultProps} />);

      const profileButton = getByTestId("profile-button");
      const settingsButton = getByTestId("settings-button");
      const submitButton = getByTestId("submit-button");

      expect(profileButton.props.accessibilityRole).toBe("button");
      expect(settingsButton.props.accessibilityRole).toBe("button");
      expect(submitButton.props.accessibilityRole).toBe("button");
    });
  });

  describe("Edge Cases", () => {
    it("handles zero answer length gracefully", () => {
      const { getByTestId } = render(
        <BottomNavigationBar
          {...defaultProps}
          currentGuess={[]}
          answerLength={0}
        />
      );

      const submitButton = getByTestId("submit-button");
      expect(submitButton.props.disabled).toBeFalsy();
    });

    it("handles negative answer length gracefully", () => {
      const { getByTestId } = render(
        <BottomNavigationBar
          {...defaultProps}
          currentGuess={["A"]}
          answerLength={-1}
        />
      );

      const submitButton = getByTestId("submit-button");
      expect(submitButton.props.disabled).toBeTruthy();
    });

    it("handles undefined callbacks gracefully", () => {
      const { getByTestId } = render(
        <BottomNavigationBar
          onProfilePress={undefined as any}
          onSettingsPress={undefined as any}
          onSubmitPress={undefined as any}
          currentGuess={["A", "P", "P", "L", "E"]}
          answerLength={5}
          gameOver={false}
        />
      );

      expect(() => {
        fireEvent.press(getByTestId("profile-button"));
        fireEvent.press(getByTestId("settings-button"));
        fireEvent.press(getByTestId("submit-button"));
      }).not.toThrow();
    });
  });

  describe("Performance", () => {
    it("updates correctly when props change", () => {
      const { getByTestId, rerender } = render(
        <BottomNavigationBar {...defaultProps} />
      );

      let submitButton = getByTestId("submit-button");
      expect(submitButton.props.disabled).toBeFalsy();

      rerender(<BottomNavigationBar {...defaultProps} currentGuess={["A"]} />);

      submitButton = getByTestId("submit-button");
      expect(submitButton.props.disabled).toBeTruthy();
    });

    it("handles rapid re-renders efficiently", () => {
      const { rerender } = render(<BottomNavigationBar {...defaultProps} />);

      // Simulate rapid state changes
      for (let i = 0; i < 10; i++) {
        rerender(
          <BottomNavigationBar
            {...defaultProps}
            currentGuess={i % 2 === 0 ? ["A", "P", "P", "L", "E"] : ["A"]}
          />
        );
      }

      // Should not throw errors
      expect(true).toBe(true);
    });
  });
});
