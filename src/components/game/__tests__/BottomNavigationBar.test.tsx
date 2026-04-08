import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import BottomNavigationBar from "../BottomNavigationBar";

// Mock styles
jest.mock("../../../styles", () => ({
  SPACING: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, "2xl": 48 },
}));

// Mock responsive utilities
jest.mock("../../../utils/responsive", () => ({
  scale: (n: number) => n,
  responsiveSizes: {
    textXs: 12, textSm: 14, textBase: 16, textLg: 18, textXl: 20,
    text2xl: 24, text3xl: 30, text4xl: 36, textTitle: 28, textDisplay: 32, textTile: 28,
    spacingXs: 4, spacingSm: 8, spacingMd: 16, spacingLg: 24, spacingXl: 32, spacing2xl: 48,
    buttonHeight: 48, inputHeight: 48, headerHeight: 60, tabBarHeight: 60,
    radiusSm: 4, radiusMd: 8, radiusLg: 12, radiusXl: 16, radiusXxl: 20, radiusFull: 9999,
  },
}));

// Mock icon components
jest.mock("../../icons/ProfileIcon", () => {
  return function MockProfileIcon(props: any) {
    return require("react").createElement("View", { testID: "profile-icon", ...props });
  };
});

jest.mock("../../icons/SettingsIcon", () => {
  return function MockSettingsIcon(props: any) {
    return require("react").createElement("View", { testID: "settings-icon", ...props });
  };
});

jest.mock("../../../../assets/images/lets-play.svg", () => {
  return function MockLetsPlayIcon(props: any) {
    return require("react").createElement("View", { testID: "lets-play-icon", ...props });
  };
});

describe("BottomNavigationBar", () => {
  const defaultProps = {
    onProfilePress: jest.fn(),
    onSettingsPress: jest.fn(),
    onChangeGameModePress: jest.fn(),
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

      expect(container.props.style).toMatchObject({
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
      });
    });
  });

  describe("Button Interactions", () => {
    it("calls onSettingsPress when settings button is pressed", () => {
      const { getAllByRole } = render(
        <BottomNavigationBar {...defaultProps} />
      );

      const buttons = getAllByRole("button");
      fireEvent.press(buttons[0]); // Settings button (left)

      expect(defaultProps.onSettingsPress).toHaveBeenCalledTimes(1);
    });

    it("calls onChangeGameModePress when hint button is pressed", () => {
      const { getAllByRole } = render(
        <BottomNavigationBar {...defaultProps} />
      );

      const buttons = getAllByRole("button");
      fireEvent.press(buttons[1]); // ChangeGameMode button (center)

      expect(defaultProps.onChangeGameModePress).toHaveBeenCalledTimes(1);
    });

    it("calls onProfilePress when profile button is pressed", () => {
      const { getAllByRole } = render(
        <BottomNavigationBar {...defaultProps} />
      );

      const buttons = getAllByRole("button");
      fireEvent.press(buttons[2]); // Profile button (right)

      expect(defaultProps.onProfilePress).toHaveBeenCalledTimes(1);
    });

    it("handles multiple button presses correctly", () => {
      const { getAllByRole } = render(
        <BottomNavigationBar {...defaultProps} />
      );

      const buttons = getAllByRole("button");

      fireEvent.press(buttons[0]); // Settings
      fireEvent.press(buttons[1]); // ChangeGameMode
      fireEvent.press(buttons[2]); // Profile

      expect(defaultProps.onSettingsPress).toHaveBeenCalledTimes(1);
      expect(defaultProps.onChangeGameModePress).toHaveBeenCalledTimes(1);
      expect(defaultProps.onProfilePress).toHaveBeenCalledTimes(1);
    });
  });

  describe("Accessibility", () => {
    it("has proper accessibility labels", () => {
      const { getAllByRole } = render(
        <BottomNavigationBar {...defaultProps} />
      );

      const buttons = getAllByRole("button");

      expect(buttons[0].props.accessibilityLabel).toBe("Open settings");
      expect(buttons[1].props.accessibilityLabel).toBe("Change game mode");
      expect(buttons[2].props.accessibilityLabel).toBe("Open profile");
    });

    it("has proper accessibility hints", () => {
      const { getAllByRole } = render(
        <BottomNavigationBar {...defaultProps} />
      );

      const buttons = getAllByRole("button");

      expect(buttons[0].props.accessibilityHint).toContain("settings");
      expect(buttons[1].props.accessibilityHint).toContain("mode");
      expect(buttons[2].props.accessibilityHint).toContain("profile");
    });
  });
});
