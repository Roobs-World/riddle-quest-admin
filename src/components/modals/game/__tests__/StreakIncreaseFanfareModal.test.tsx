import React from "react";
import {render, fireEvent} from "@testing-library/react-native";
import StreakIncreaseFanfareModal, {
  STREAK_INCREASE_FANFARE_MODAL_HEIGHT_MULTIPLIER,
} from "../StreakIncreaseFanfareModal";
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
    default: function MockModal({children, visible}: {children: React.ReactNode; visible: boolean}) {
      if (!visible) return null;
      return React.createElement("View", null, children);
    },
  };
});

jest.mock("../../../../assets/images/modal-bg.svg", () => "ModalBgSvg");
jest.mock("../../../../assets/images/wheel-bg.svg", () => "WheelBgSvg");

describe("StreakIncreaseFanfareModal", () => {
  it("renders streak and coin reward values", () => {
    const {getByText, queryByTestId} = render(
      <StreakIncreaseFanfareModal
        isVisible={true}
        streakValue={7}
        coinsAwarded={40}
        totalCoins={240}
        onClose={jest.fn()}
      />,
    );

    expect(getByText("Streak Increased!")).toBeTruthy();
    expect(queryByTestId("modal-sequence-breadcrumb")).toBeNull();
    expect(getByText("7-Day Streak")).toBeTruthy();
    expect(getByText("+40 Coins")).toBeTruthy();
    expect(getByText("Total Coins:")).toBeTruthy();
    expect(getByText("240")).toBeTruthy();
  });

  it("shows sequence progress and Next text for an intermediate popup", () => {
    const {getByTestId, getByText, queryByText} = render(
      <StreakIncreaseFanfareModal
        isVisible={true}
        streakValue={7}
        coinsAwarded={40}
        totalCoins={240}
        sequenceProgress={{
          currentPopupIndex: 2,
          totalPopups: 4,
          hasNextPopup: true,
          primaryActionText: "Next",
        }}
        onClose={jest.fn()}
      />,
    );

    expect(getByTestId("modal-sequence-breadcrumb")).toBeTruthy();
    expect(queryByText("2/4")).toBeNull();
    expect(getByText("Next")).toBeTruthy();
  });

  it("uses a compact decorative background frame", () => {
    const {getByTestId} = render(
      <StreakIncreaseFanfareModal
        isVisible={true}
        streakValue={7}
        coinsAwarded={40}
        totalCoins={240}
        onClose={jest.fn()}
      />,
    );
    const expectedHeight = getResponsiveModalHeight(
      STREAK_INCREASE_FANFARE_MODAL_HEIGHT_MULTIPLIER,
      MODAL_MAX_SCREEN_HEIGHT_FRACTION,
    );
    const previousHeight = getResponsiveModalHeight(1.4, MODAL_MAX_SCREEN_HEIGHT_FRACTION);

    expect(expectedHeight).toBeLessThan(previousHeight);
    expect(getByTestId("streak-increase-fanfare-frame").props.style).toEqual(
      expect.objectContaining({
        width: MODAL_WIDTH,
        height: expectedHeight,
      }),
    );
    expect(getByTestId("streak-increase-fanfare-background").props.height).toBe(expectedHeight);
    expect(getByTestId("streak-increase-fanfare-background").props.preserveAspectRatio).toBe("none");
  });

  it("does not render content when hidden", () => {
    const {queryByText} = render(
      <StreakIncreaseFanfareModal
        isVisible={false}
        streakValue={7}
        coinsAwarded={40}
        totalCoins={140}
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
        streakValue={7}
        coinsAwarded={40}
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
