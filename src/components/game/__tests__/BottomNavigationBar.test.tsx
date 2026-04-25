import React from "react";
import {render, fireEvent} from "@testing-library/react-native";
import BottomNavigationBar from "../BottomNavigationBar";

jest.mock("../../../styles", () => ({
  SPACING: {xs: 4, sm: 8, md: 16, lg: 24, xl: 32, "2xl": 48},
}));

jest.mock("../../../utils/responsive", () => ({
  scale: (n: number) => n,
}));

jest.mock("../../icons/ProfileIcon", () => {
  return function MockProfileIcon(props: any) {
    return require("react").createElement("View", {testID: "profile-icon", ...props});
  };
});

jest.mock("../../icons/SettingsIcon", () => {
  return function MockSettingsIcon(props: any) {
    return require("react").createElement("View", {testID: "settings-icon", ...props});
  };
});

describe("BottomNavigationBar", () => {
  const defaultProps = {
    onProfilePress: jest.fn(),
    onSettingsPress: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders the navigation icons", () => {
    const {getByTestId} = render(<BottomNavigationBar {...defaultProps} />);

    expect(getByTestId("profile-icon")).toBeTruthy();
    expect(getByTestId("settings-icon")).toBeTruthy();
  });

  it("calls the correct callbacks when buttons are pressed", () => {
    const {getByTestId} = render(<BottomNavigationBar {...defaultProps} />);

    fireEvent.press(getByTestId("settings-button"));
    fireEvent.press(getByTestId("profile-button"));

    expect(defaultProps.onSettingsPress).toHaveBeenCalledTimes(1);
    expect(defaultProps.onProfilePress).toHaveBeenCalledTimes(1);
  });

  it("does not crash when required callbacks are provided", () => {
    const {getByTestId} = render(
      <BottomNavigationBar
        onProfilePress={defaultProps.onProfilePress}
        onSettingsPress={defaultProps.onSettingsPress}
      />,
    );

    expect(() => fireEvent.press(getByTestId("settings-button"))).not.toThrow();
    expect(() => fireEvent.press(getByTestId("profile-button"))).not.toThrow();
  });

  it("applies expected accessibility labels", () => {
    const {getByTestId} = render(<BottomNavigationBar {...defaultProps} />);

    expect(getByTestId("settings-button").props.accessibilityLabel).toBe("Open settings");
    expect(getByTestId("profile-button").props.accessibilityLabel).toBe("Open profile");
  });
});
