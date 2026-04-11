import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import AchievementUnlockFanfareModal from "../AchievementUnlockFanfareModal";

jest.mock("react-native/Libraries/Animated/Animated", () => {
  const { View } = require("react-native");
  class MockAnimatedValue {
    private _value: number;
    setValue = jest.fn((val: number) => {
      this._value = val;
    });
    stopAnimation = jest.fn((callback?: (value: number) => void) => {
      callback?.(this._value);
    });
    constructor(initial: number) {
      this._value = initial;
    }
    interpolate(config: { inputRange: number[]; outputRange: string[] }) {
      return config?.outputRange?.[0] ?? "0deg";
    }
  }
  const simpleAnim = () => ({ start: jest.fn(), stop: jest.fn() });
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
  return function MockWideButton({
    buttonText,
    onPress,
  }: {
    buttonText: string;
    onPress: () => void;
  }) {
    return React.createElement(
      "View",
      { accessible: true, onPress },
      React.createElement("Text", null, buttonText)
    );
  };
});

jest.mock("../../../../assets/images/modal-bg.svg", () => "ModalBgSvg");
jest.mock("../../../../assets/images/wheel-bg.svg", () => "WheelBgSvg");

describe("AchievementUnlockFanfareModal", () => {
  it("renders the unlocked achievement text", () => {
    const { getByText } = render(
      <AchievementUnlockFanfareModal
        isVisible={true}
        achievements={[
          {
            name: "First Victory",
            description: "Win your first game",
            icon: "*",
          },
        ]}
        onClose={jest.fn()}
      />
    );

    expect(getByText("Achievement Unlocked!")).toBeTruthy();
    expect(getByText("*")).toBeTruthy();
    expect(getByText("First Victory")).toBeTruthy();
    expect(getByText("Win your first game")).toBeTruthy();
  });

  it("shows aggregated count when multiple achievements unlock", () => {
    const { getByText } = render(
      <AchievementUnlockFanfareModal
        isVisible={true}
        achievements={[
          { name: "First Victory", description: "Win one game", icon: "*" },
          { name: "Speed Runner", description: "Solve quickly", icon: "!" },
          { name: "No Hint Hero", description: "Win without hints", icon: "#" },
        ]}
        onClose={jest.fn()}
      />
    );

    expect(getByText("+2 more unlocked")).toBeTruthy();
  });

  it("fires onClose when the CTA button is pressed", () => {
    const onClose = jest.fn();
    const { getByText } = render(
      <AchievementUnlockFanfareModal
        isVisible={true}
        achievements={[
          {
            name: "First Victory",
            description: "Win your first game",
            icon: "*",
          },
        ]}
        onClose={onClose}
      />
    );

    fireEvent.press(getByText("Nice"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
