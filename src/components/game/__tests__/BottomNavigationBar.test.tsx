import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import BottomNavigationBar from "../BottomNavigationBar";

// Mock icon components
jest.mock("../../icons/ProfileIcon", () => {
  const React = require("react");
  const { View } = require("react-native");

  const MockProfileIcon = (props: any) => (
    <View testID="profile-icon" {...props} />
  );

  MockProfileIcon.displayName = "MockProfileIcon";
  return MockProfileIcon;
});

jest.mock("../../icons/SettingsIcon", () => {
  const React = require("react");
  const { View } = require("react-native");

  const MockSettingsIcon = (props: any) => (
    <View testID="settings-icon" {...props} />
  );

  MockSettingsIcon.displayName = "MockSettingsIcon";
  return MockSettingsIcon;
});

jest.mock("../../../../assets/images/lets-play.svg", () => {
  const React = require("react");
  const { View } = require("react-native");

  const MockLetsPlayIcon = (props: any) => (
    <View testID="lets-play-icon" {...props} />
  );

  MockLetsPlayIcon.displayName = "MockLetsPlayIcon";
  return MockLetsPlayIcon;
});

describe("BottomNavigationBar", () => {
  const defaultProps = {
    onProfilePress: jest.fn(),
    onSettingsPress: jest.fn(),
    onHintPress: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Rendering", () => {
    it("renders all navigation elements correctly", () => {
      const { getByTestId } = render(<BottomNavigationBar {...defaultProps} />);

      expect(getByTestId("profile-icon")).toBeTruthy();
      expect(getByTestId("settings-icon")).toBeTruthy();
      expect(getByTestId("lets-play-icon")).toBeTruthy();
    });

    it("renders with correct layout structure", () => {
      const { UNSAFE_getByType } = render(
        <BottomNavigationBar {...defaultProps} />
      );

      const View = require("react-native").View;
      const container = UNSAFE_getByType(View);

      expect(container.props.className).toContain("flex-row");
      expect(container.props.className).toContain("justify-between");
      expect(container.props.className).toContain("items-center");
    });
  });

  describe("Button Interactions", () => {
    it("calls onProfilePress when profile button is pressed", () => {
      const { getAllByRole } = render(
        <BottomNavigationBar {...defaultProps} />
      );

      const buttons = getAllByRole("button");
      fireEvent.press(buttons[0]); // Profile button

      expect(defaultProps.onProfilePress).toHaveBeenCalledTimes(1);
    });

    it("calls onHintPress when hint button is pressed", () => {
      const { getAllByRole } = render(
        <BottomNavigationBar {...defaultProps} />
      );

      const buttons = getAllByRole("button");
      fireEvent.press(buttons[1]); // Hint button

      expect(defaultProps.onHintPress).toHaveBeenCalledTimes(1);
    });

    it("calls onSettingsPress when settings button is pressed", () => {
      const { getAllByRole } = render(
        <BottomNavigationBar {...defaultProps} />
      );

      const buttons = getAllByRole("button");
      fireEvent.press(buttons[2]); // Settings button

      expect(defaultProps.onSettingsPress).toHaveBeenCalledTimes(1);
    });

    it("handles multiple button presses correctly", () => {
      const { getAllByRole } = render(
        <BottomNavigationBar {...defaultProps} />
      );

      const buttons = getAllByRole("button");

      fireEvent.press(buttons[0]); // Profile
      fireEvent.press(buttons[1]); // Hint
      fireEvent.press(buttons[2]); // Settings

      expect(defaultProps.onProfilePress).toHaveBeenCalledTimes(1);
      expect(defaultProps.onHintPress).toHaveBeenCalledTimes(1);
      expect(defaultProps.onSettingsPress).toHaveBeenCalledTimes(1);
    });
  });

  describe("Accessibility", () => {
    it("has proper accessibility labels", () => {
      const { getAllByRole } = render(
        <BottomNavigationBar {...defaultProps} />
      );

      const buttons = getAllByRole("button");

      expect(buttons[0].props.accessibilityLabel).toBe("Open profile");
      expect(buttons[1].props.accessibilityLabel).toBe("Show hint");
      expect(buttons[2].props.accessibilityLabel).toBe("Open settings");
    });

    it("has proper accessibility hints", () => {
      const { getAllByRole } = render(
        <BottomNavigationBar {...defaultProps} />
      );

      const buttons = getAllByRole("button");

      expect(buttons[0].props.accessibilityHint).toContain("profile");
      expect(buttons[1].props.accessibilityHint).toContain("hint");
      expect(buttons[2].props.accessibilityHint).toContain("settings");
    });
  });
});
