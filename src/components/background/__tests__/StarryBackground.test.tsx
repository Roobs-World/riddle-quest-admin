import React from "react";
import {render, act} from "@testing-library/react-native";
import {StyleSheet} from "react-native";
import {withRepeat, withTiming, cancelAnimation} from "react-native-reanimated";

jest.mock("../SolarSystem3D", () => {
  const React = require("react");
  const {View} = require("react-native");
  return {
    __esModule: true,
    default: () => React.createElement(View, {testID: "solar-system-3d"}),
  };
});

import StarryBackground, {
  __STAR_COUNT_FOR_TESTS,
  __SHOOTING_STAR_COUNT_FOR_TESTS,
  __generateStarsForTests,
  __generateShootingStarsForTests,
} from "../StarryBackground";

describe("StarryBackground", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("generates deterministic stars with expected bounds", () => {
    const randomSpy = jest.spyOn(Math, "random").mockReturnValue(0.5);

    const stars = __generateStarsForTests(200, 100, 2);

    expect(stars).toHaveLength(2);
    expect(stars[0]).toMatchObject({
      id: 0,
      initialX: 100,
      initialY: 50,
      size: 2.75,
      opacity: 0.875,
      animationDuration: 27500,
      animationDelay: 5000,
    });
    expect(stars[1].id).toBe(1);
    expect(["#FFFFFF", "#FFD700", "#FFF8DC", "#FFFFE0", "#E8F4FF", "#FFE135"]).toContain(stars[0].color);

    randomSpy.mockRestore();
  });

  it("generates deterministic shooting stars with expected bounds", () => {
    const randomSpy = jest.spyOn(Math, "random").mockReturnValue(0.5);

    const shootingStars = __generateShootingStarsForTests(300, 200, 2);

    expect(shootingStars).toHaveLength(2);
    expect(shootingStars[0]).toMatchObject({
      id: 0,
      startX: 105,
      startY: 35,
      length: 26,
      angle: 140,
      distance: 220,
      duration: 3700,
      delay: 750,
      repeatInterval: 9500,
    });
    expect(shootingStars[1].id).toBe(1);

    randomSpy.mockRestore();
  });

  it("renders stars, shooting stars, and solar system", () => {
    const {getByTestId} = render(<StarryBackground />);

    expect(getByTestId("solar-system-3d")).toBeTruthy();
    expect(getByTestId("star-0")).toBeTruthy();
    expect(getByTestId(`star-${__STAR_COUNT_FOR_TESTS - 1}`)).toBeTruthy();
    expect(getByTestId("shooting-star-0")).toBeTruthy();
    expect(getByTestId(`shooting-star-${__SHOOTING_STAR_COUNT_FOR_TESTS - 1}`)).toBeTruthy();
  });

  it("keeps shooting stars behind the fully opaque solar system layer", () => {
    const {getByTestId} = render(<StarryBackground />);

    const shootingStarsLayerStyle = StyleSheet.flatten(getByTestId("shooting-stars-layer").props.style);
    const solarSystemLayerStyle = StyleSheet.flatten(getByTestId("solar-system-layer").props.style);

    expect(solarSystemLayerStyle.zIndex).toBeGreaterThan(shootingStarsLayerStyle.zIndex);
    expect(solarSystemLayerStyle.elevation).toBeGreaterThan(shootingStarsLayerStyle.elevation);
    expect(solarSystemLayerStyle.opacity).toBeUndefined();
  });

  it("starts animation sequences after timeout and cancels on unmount", () => {
    const {unmount} = render(<StarryBackground />);

    act(() => {
      jest.runOnlyPendingTimers();
    });

    expect(withTiming).toHaveBeenCalled();
    expect(withRepeat).toHaveBeenCalled();

    unmount();

    expect(cancelAnimation).toHaveBeenCalled();
  });
});
