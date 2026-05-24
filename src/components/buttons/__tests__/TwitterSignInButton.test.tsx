import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import TwitterSignInButton from "../TwitterSignInButton";

jest.mock("../../icons/TwitterXIcon", () => {
  const React = require("react");
  const { View } = require("react-native");
  return function MockIcon(props: any) {
    return React.createElement(View, { testID: "twitter-x-icon", ...props });
  };
});

jest.mock("../../../styles", () => ({
  styles: { socialButtonText: {} },
  SPACING: { sm: 8, md: 16 },
  SIZING: { icon: { md: 24 } },
}));

jest.mock("../../../utils/responsive", () => ({
  dimensions: {
    screenWidth: 390,
    screenHeight: 844,
    isPhone: true,
    isTablet: false,
    isLargeTablet: false,
    isDesktop: false,
  },
  isPhone: true,
  isTablet: false,
  isLargeTablet: false,
  isDesktop: false,
  scale: (value: number) => value,
}));

describe("TwitterSignInButton", () => {
  it("renders enabled state and triggers onPress", () => {
    const onPress = jest.fn();
    const { getByText, getByTestId, UNSAFE_getByType } = render(
      <TwitterSignInButton onPress={onPress} />
    );

    expect(getByText("Continue with X")).toBeTruthy();
    expect(getByTestId("twitter-x-icon")).toBeTruthy();

    const TouchableOpacity = require("react-native").TouchableOpacity;
    const button = UNSAFE_getByType(TouchableOpacity);
    expect(button.props.disabled).toBe(false);
    expect(button.props.className).toContain("bg-white");

    fireEvent.press(button);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("renders disabled state without onPress handler", () => {
    const onPress = jest.fn();
    const { getByText, UNSAFE_getByType } = render(
      <TwitterSignInButton onPress={onPress} disabled={true} />
    );

    const TouchableOpacity = require("react-native").TouchableOpacity;
    const button = UNSAFE_getByType(TouchableOpacity);
    expect(button.props.disabled).toBe(true);
    expect(button.props.onPress).toBeUndefined();
    expect(button.props.className).toContain("bg-gray-100");
    expect(getByText("Continue with X").props.className).toContain(
      "text-gray-400"
    );
  });
});
