import React from "react";
import {render, fireEvent} from "@testing-library/react-native";
import StreakIncreaseFanfareModal from "../StreakIncreaseFanfareModal";

jest.mock("react-native/Libraries/Animated/Animated", () => {
  const {View} = require("react-native");
  class MockAnimatedValue {
    private _value: number;

    setValue = jest.fn((val: number) => {
      this._value = val;
    });

    stopAnimation = jest.fn((callback?: (value: number) => void) => {
      callback?.(this._value);
    });

    resetAnimation = jest.fn((callback?: (value: number) => void) => {
      this._value = 0;
      callback?.(this._value);
    });

    constructor(initial: number) {
      this._value = initial;
    }

    interpolate(config: {inputRange: number[]; outputRange: string[]}) {
      return config?.outputRange?.[0] ?? "0deg";
    }
  }

  const simpleAnim = () => ({start: jest.fn(), stop: jest.fn()});
  const Animated = {
    View,
    Value: MockAnimatedValue,
    timing: jest.fn(simpleAnim),
    loop: jest.fn(simpleAnim),
  };

  return {
    __esModule: true,
    default: Animated,
    ...Animated,
  };
});

jest.mock("react-native/Libraries/Modal/Modal", () => {
  const React = require("react");
  return {
    __esModule: true,
    default: function MockModal({
      children,
      visible,
    }: {
      children: React.ReactNode;
      visible: boolean;
    }) {
      if (!visible) return null;
      return React.createElement("View", null, children);
    },
  };
});

jest.mock("../../../buttons/WideButton", () => {
  const React = require("react");
  const {TouchableOpacity, Text} = require("react-native");
  return function MockWideButton({
    buttonText,
    onPress,
  }: {
    buttonText: string;
    onPress: () => void;
  }) {
    return React.createElement(
      TouchableOpacity,
      {testID: "wide-button", accessibilityRole: "button", onPress},
      React.createElement(Text, null, buttonText),
    );
  };
});

jest.mock("../../../../assets/images/modal-bg.svg", () => "ModalBgSvg");
jest.mock("../../../../assets/images/wheel-bg.svg", () => "WheelBgSvg");
jest.mock("../../../../assets/images/large-coin-stack.svg", () => "CoinStackSvg");

describe("StreakIncreaseFanfareModal", () => {
  it("renders streak and coin reward values", () => {
    const {getByText} = render(
      <StreakIncreaseFanfareModal
        isVisible={true}
        streakValue={4}
        coinsAwarded={50}
        onClose={jest.fn()}
      />,
    );

    expect(getByText("Streak Increased!")).toBeTruthy();
    expect(getByText("4-Day Streak")).toBeTruthy();
    expect(getByText("+50 Coins")).toBeTruthy();
  });

  it("fires onClose when the CTA button is pressed", () => {
    const onClose = jest.fn();
    const {getByText} = render(
      <StreakIncreaseFanfareModal
        isVisible={true}
        streakValue={2}
        coinsAwarded={50}
        onClose={onClose}
      />,
    );

    fireEvent.press(getByText("Keep Going"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
