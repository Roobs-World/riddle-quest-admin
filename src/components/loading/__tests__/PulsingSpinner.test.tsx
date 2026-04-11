import React from "react";
import { render } from "@testing-library/react-native";
import { Animated } from "react-native";
import PulsingSpinner from "../PulsingSpinner";

jest.mock("react-native-svg", () => {
  const React = require("react");
  const { View } = require("react-native");

  const Svg = ({ children, ...props }: any) =>
    React.createElement(View, { testID: "spinner-svg", ...props }, children);
  const Circle = ({ ...props }: any) =>
    React.createElement(View, { testID: "spinner-dot", ...props });

  return {
    __esModule: true,
    default: Svg,
    Circle,
  };
});

describe("PulsingSpinner", () => {
  let start: jest.Mock;
  let stop: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    start = jest.fn();
    stop = jest.fn();

    jest.spyOn(Animated, "timing").mockReturnValue({} as any);
    jest.spyOn(Animated, "stagger").mockReturnValue({} as any);
    jest.spyOn(Animated, "delay").mockReturnValue({} as any);
    jest.spyOn(Animated, "sequence").mockReturnValue({} as any);
    jest.spyOn(Animated, "loop").mockReturnValue({ start, stop } as any);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("renders inline spinner by default", () => {
    const { getByLabelText, getByTestId, getAllByTestId } = render(
      <PulsingSpinner />
    );

    expect(getByLabelText("Loading")).toBeTruthy();
    expect(getByTestId("spinner-svg")).toBeTruthy();
    expect(getAllByTestId("spinner-dot")).toHaveLength(8);
    expect(start).toHaveBeenCalledTimes(1);
  });

  it("supports custom dot count and size", () => {
    const { getByTestId, getAllByTestId } = render(
      <PulsingSpinner size={120} dotCount={5} />
    );

    const svg = getByTestId("spinner-svg");
    expect(svg.props.width).toBe(120);
    expect(svg.props.height).toBe(120);
    expect(getAllByTestId("spinner-dot")).toHaveLength(5);
  });

  it("returns null when overlay mode is hidden", () => {
    const { toJSON } = render(<PulsingSpinner visible={false} />);
    expect(toJSON()).toBeNull();
  });

  it("renders overlay mode when visible", () => {
    const { getByTestId, getByLabelText } = render(
      <PulsingSpinner visible={true} opacity={0.8} />
    );

    const modal = getByTestId("mock-modal");
    expect(modal.props["data-modal-visible"]).toBe(true);
    expect(getByLabelText("Loading")).toBeTruthy();
  });

  it("stops animation loop on unmount", () => {
    const { unmount } = render(<PulsingSpinner duration={2000} />);
    unmount();
    expect(stop).toHaveBeenCalledTimes(1);
  });
});
