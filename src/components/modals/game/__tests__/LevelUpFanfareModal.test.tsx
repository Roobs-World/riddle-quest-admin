import React from "react";
import {fireEvent, render} from "@testing-library/react-native";
import LevelUpFanfareModal, {
  LEVEL_UP_FANFARE_MODAL_HEIGHT_MULTIPLIER,
} from "../LevelUpFanfareModal";
import {
  MODAL_MAX_SCREEN_HEIGHT_FRACTION,
  MODAL_WIDTH,
  getResponsiveModalHeight,
} from "../../../../constants/layout";

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

describe("LevelUpFanfareModal", () => {
  it("renders level and coin reward values without sequence progress by default", () => {
    const {getByText, queryByTestId} = render(
      <LevelUpFanfareModal
        isVisible={true}
        newLevel={4}
        coinsAwarded={50}
        totalCoins={250}
        onClose={jest.fn()}
      />,
    );

    expect(getByText("Level Up!")).toBeTruthy();
    expect(getByText("Level 4")).toBeTruthy();
    expect(getByText("+50 Coins")).toBeTruthy();
    expect(queryByTestId("modal-sequence-breadcrumb")).toBeNull();
  });

  it("uses the taller DSI-035 decorative background frame", () => {
    const {getByTestId} = render(
      <LevelUpFanfareModal
        isVisible={true}
        newLevel={4}
        coinsAwarded={50}
        totalCoins={250}
        onClose={jest.fn()}
      />,
    );
    const expectedHeight = getResponsiveModalHeight(
      LEVEL_UP_FANFARE_MODAL_HEIGHT_MULTIPLIER,
      MODAL_MAX_SCREEN_HEIGHT_FRACTION,
    );
    const previousHeight = getResponsiveModalHeight(1.4, MODAL_MAX_SCREEN_HEIGHT_FRACTION);

    expect(expectedHeight).toBeGreaterThan(previousHeight);
    expect(getByTestId("level-up-fanfare-frame").props.style).toEqual(
      expect.objectContaining({
        width: MODAL_WIDTH,
        height: expectedHeight,
      }),
    );
    expect(getByTestId("level-up-fanfare-background").props.height).toBe(expectedHeight);
    expect(getByTestId("level-up-fanfare-background").props.preserveAspectRatio).toBe("none");
  });

  it("shows sequence progress and final action text", () => {
    const {getByTestId, getByText, queryByText} = render(
      <LevelUpFanfareModal
        isVisible={true}
        newLevel={4}
        coinsAwarded={50}
        totalCoins={250}
        sequenceProgress={{
          currentPopupIndex: 4,
          totalPopups: 4,
          hasNextPopup: false,
        }}
        onClose={jest.fn()}
      />,
    );

    expect(getByTestId("modal-sequence-breadcrumb")).toBeTruthy();
    expect(queryByText("4/4")).toBeNull();
    expect(getByText("Awesome")).toBeTruthy();
  });

  it("runs continue flow then closes when tapped", () => {
    const onContinue = jest.fn();
    const onClose = jest.fn();
    const {getByText} = render(
      <LevelUpFanfareModal
        isVisible={true}
        newLevel={2}
        coinsAwarded={10}
        totalCoins={120}
        onContinue={onContinue}
        onClose={onClose}
      />,
    );

    fireEvent.press(getByText("Level Up!"));

    expect(onContinue).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
