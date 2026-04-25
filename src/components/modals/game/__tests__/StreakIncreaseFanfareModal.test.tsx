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

jest.mock("../../../../assets/images/modal-bg.svg", () => "ModalBgSvg");
jest.mock("../../../../assets/images/wheel-bg.svg", () => "WheelBgSvg");

describe("StreakIncreaseFanfareModal", () => {
  it("renders streak and coin reward values", () => {
    const {getByText} = render(
      <StreakIncreaseFanfareModal
        isVisible={true}
        streakValue={4}
        coinsAwarded={50}
        totalCoins={250}
        onClose={jest.fn()}
      />,
    );

    expect(getByText("Streak Increased!")).toBeTruthy();
    expect(getByText("4-Day Streak")).toBeTruthy();
    expect(getByText("+50 Coins")).toBeTruthy();
    expect(getByText("Total Coins:")).toBeTruthy();
    expect(getByText("250")).toBeTruthy();
  });

  it("does not render content when hidden", () => {
    const {queryByText} = render(
      <StreakIncreaseFanfareModal
        isVisible={false}
        streakValue={2}
        coinsAwarded={50}
        totalCoins={150}
        onClose={jest.fn()}
      />,
    );

    expect(queryByText("Streak Increased!")).toBeNull();
  });

  it("runs continue flow then closes when tapped", () => {
    const onContinue = jest.fn();
    const onClose = jest.fn();
    const {getByText} = render(
      <StreakIncreaseFanfareModal
        isVisible={true}
        streakValue={3}
        coinsAwarded={20}
        totalCoins={200}
        onContinue={onContinue}
        onClose={onClose}
      />,
    );

    fireEvent.press(getByText("Streak Increased!"));

    expect(onContinue).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
