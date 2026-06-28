import React from "react";
import {fireEvent, render} from "@testing-library/react-native";
import RankUpFanfareModal, {RANK_UP_FANFARE_MODAL_HEIGHT_MULTIPLIER} from "../RankUpFanfareModal";
import {MODAL_MAX_SCREEN_HEIGHT_FRACTION, MODAL_WIDTH, getResponsiveModalHeight} from "../../../../constants/layout";

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
    parallel: jest.fn(simpleAnim),
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

describe("RankUpFanfareModal", () => {
  it("renders the new rank crest, name, and description", () => {
    const {getByText, getByTestId, queryByTestId} = render(
      <RankUpFanfareModal isVisible={true} newLevel={3} onClose={jest.fn()} />,
    );

    expect(getByText("New Rank!")).toBeTruthy();
    expect(getByText("You reached a new rank.")).toBeTruthy();
    expect(getByText("Pathfinder")).toBeTruthy();
    expect(getByText("You are finding your way through tougher riddles.")).toBeTruthy();
    expect(getByTestId("rank-up-rank-badge")).toBeTruthy();
    expect(queryByTestId("modal-sequence-breadcrumb")).toBeNull();
  });

  it("uses the responsive decorated frame height", () => {
    const {getByTestId} = render(<RankUpFanfareModal isVisible={true} newLevel={3} onClose={jest.fn()} />);
    const expectedHeight = getResponsiveModalHeight(
      RANK_UP_FANFARE_MODAL_HEIGHT_MULTIPLIER,
      MODAL_MAX_SCREEN_HEIGHT_FRACTION,
    );

    expect(getByTestId("rank-up-fanfare-frame").props.style).toEqual(
      expect.objectContaining({
        width: MODAL_WIDTH,
        height: expectedHeight,
      }),
    );
    expect(getByTestId("rank-up-fanfare-background").props.height).toBe(expectedHeight);
    expect(getByTestId("rank-up-fanfare-background").props.preserveAspectRatio).toBe("none");
  });

  it("shows sequence progress and custom next text for intermediate flow steps", () => {
    const {getByTestId, getByText} = render(
      <RankUpFanfareModal
        isVisible={true}
        newLevel={3}
        sequenceProgress={{
          currentPopupIndex: 3,
          totalPopups: 4,
          hasNextPopup: true,
          primaryActionText: "Next",
        }}
        onClose={jest.fn()}
      />,
    );

    expect(getByTestId("modal-sequence-breadcrumb")).toBeTruthy();
    expect(getByText("Next")).toBeTruthy();
  });

  it("runs continue flow then closes when tapped", () => {
    const onContinue = jest.fn();
    const onClose = jest.fn();
    const {getByTestId} = render(
      <RankUpFanfareModal isVisible={true} newLevel={3} onContinue={onContinue} onClose={onClose} />,
    );

    fireEvent.press(getByTestId("rank-up-fanfare-modal"));

    expect(onContinue).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
