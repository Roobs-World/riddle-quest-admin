import React from "react";
import { render } from "@testing-library/react-native";
import { Animated } from "react-native";
import PulsingSpinner from "../PulsingSpinner";

describe("PulsingSpinner", () => {
  let start: jest.Mock;
  let stop: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    start = jest.fn();
    stop = jest.fn();
    const animationMock = { start, stop } as any;

    jest.spyOn(Animated, "timing").mockReturnValue(animationMock);
    jest.spyOn(Animated, "stagger").mockReturnValue(animationMock);
    jest.spyOn(Animated, "delay").mockReturnValue(animationMock);
    jest.spyOn(Animated, "sequence").mockReturnValue(animationMock);
    jest.spyOn(Animated, "parallel").mockReturnValue(animationMock);
    jest.spyOn(Animated, "loop").mockReturnValue(animationMock);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("renders inline spinner by default", () => {
    const { getByLabelText, getByTestId, getAllByTestId } = render(<PulsingSpinner />);

    expect(getByLabelText("Loading")).toBeTruthy();
    expect(getByTestId("spinner-ring")).toBeTruthy();
    expect(getAllByTestId("spinner-dot")).toHaveLength(8);
    expect(start).toHaveBeenCalledTimes(1);
  });

  it("supports custom dot count and size", () => {
    const { getByTestId, getAllByTestId } = render(<PulsingSpinner size={120} dotCount={5} />);

    const ring = getByTestId("spinner-ring");
    const flattenedStyle = Array.isArray(ring.props.style)
      ? Object.assign({}, ...ring.props.style)
      : ring.props.style;
    expect(flattenedStyle.width).toBe(120);
    expect(flattenedStyle.height).toBe(120);
    expect(getAllByTestId("spinner-dot")).toHaveLength(5);
  });

  it("returns null when overlay mode is hidden", () => {
    const { toJSON } = render(<PulsingSpinner visible={false} />);
    expect(toJSON()).toBeNull();
    expect(start).not.toHaveBeenCalled();
    expect(Animated.loop).not.toHaveBeenCalled();
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
