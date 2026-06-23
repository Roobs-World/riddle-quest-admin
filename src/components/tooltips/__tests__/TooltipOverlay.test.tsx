import React from "react";
import {fireEvent, render} from "@testing-library/react-native";
import {Animated, Modal} from "react-native";
import TooltipOverlay from "../TooltipOverlay";

jest.mock("../../../qa/qaRuntime", () => ({
  isQASurfaceRuntimeActive: jest.fn(() => false),
}));

const {isQASurfaceRuntimeActive} = require("../../../qa/qaRuntime");

describe("TooltipOverlay", () => {
  const content = {
    title: "Submit your answer",
    body: "Tap submit.",
    action: "Got it",
  };

  it("renders a full backdrop, lifted target, and pointer when target rect is available", () => {
    const {getByTestId, getByText, queryByTestId} = render(
      <TooltipOverlay
        visible={true}
        targetRect={{x: 20, y: 80, width: 120, height: 48}}
        highlightElement={<></>}
        content={content}
        onDismiss={jest.fn()}
      />,
    );

    expect(getByTestId("tooltip-overlay")).toBeTruthy();
    expect(getByTestId("tooltip-backdrop")).toBeTruthy();
    expect(getByTestId("tooltip-highlighted-target")).toBeTruthy();
    expect(queryByTestId("tooltip-backdrop-top")).toBeNull();
    expect(queryByTestId("tooltip-backdrop-left")).toBeNull();
    expect(queryByTestId("tooltip-backdrop-right")).toBeNull();
    expect(queryByTestId("tooltip-backdrop-bottom")).toBeNull();
    expect(queryByTestId("tooltip-target-cutout")).toBeNull();
    expect(getByTestId("tooltip-pointer")).toBeTruthy();
    expect(getByText("Submit your answer")).toBeTruthy();
  });

  it("can render an inline cutout overlay without cloning the target", () => {
    const {UNSAFE_queryByType, getByTestId, queryByTestId} = render(
      <TooltipOverlay
        visible={true}
        targetRect={{x: 20, y: 80, width: 120, height: 48}}
        cutoutTarget={true}
        useNativeModal={false}
        content={content}
        onDismiss={jest.fn()}
      />,
    );

    expect(UNSAFE_queryByType(Modal)).toBeNull();
    expect(getByTestId("tooltip-backdrop-piece-0")).toBeTruthy();
    expect(queryByTestId("tooltip-highlighted-target")).toBeNull();
  });

  it("does not draw a full inline backdrop for a cutout tooltip without a target", () => {
    const {UNSAFE_queryByType, queryByTestId} = render(
      <TooltipOverlay
        visible={true}
        targetRect={null}
        cutoutTarget={true}
        useNativeModal={false}
        content={content}
        onDismiss={jest.fn()}
      />,
    );

    expect(UNSAFE_queryByType(Modal)).toBeNull();
    expect(queryByTestId("tooltip-backdrop")).toBeNull();
  });

  it("does not leave the inline submit overlay mounted after it becomes inactive", () => {
    const {queryByTestId} = render(
      <TooltipOverlay
        visible={false}
        targetRect={{x: 20, y: 80, width: 120, height: 48}}
        cutoutTarget={true}
        useNativeModal={false}
        content={content}
        onDismiss={jest.fn()}
      />,
    );

    expect(queryByTestId("tooltip-overlay")).toBeNull();
    expect(queryByTestId("tooltip-backdrop")).toBeNull();
  });

  it("uses a native modal so tooltips appear above modal overlays", () => {
    const {UNSAFE_queryByType} = render(
      <TooltipOverlay visible={true} targetRect={null} content={content} onDismiss={jest.fn()} />,
    );

    expect(UNSAFE_queryByType(Modal)).toBeTruthy();
  });

  it("renders a full backdrop when no target is available", () => {
    const {getByTestId} = render(
      <TooltipOverlay visible={true} targetRect={null} content={content} onDismiss={jest.fn()} />,
    );

    expect(getByTestId("tooltip-backdrop")).toBeTruthy();
  });

  it("calls onDismiss from the action button", () => {
    const onDismiss = jest.fn();
    const {getByTestId} = render(
      <TooltipOverlay visible={true} targetRect={null} content={content} onDismiss={onDismiss} />,
    );

    fireEvent.press(getByTestId("tooltip-dismiss-button"));
    expect(onDismiss).toHaveBeenCalled();
  });

  it("stays static in QA surface runtime and still clears on exit", () => {
    (isQASurfaceRuntimeActive as jest.Mock).mockReturnValue(true);
    const timingSpy = jest.spyOn(Animated, "timing");
    const loopSpy = jest.spyOn(Animated, "loop");
    const onExited = jest.fn();

    const {rerender, getByTestId} = render(
      <TooltipOverlay visible={true} targetRect={null} content={content} onDismiss={jest.fn()} onExited={onExited} />,
    );

    expect(timingSpy).not.toHaveBeenCalled();
    expect(loopSpy).not.toHaveBeenCalled();

    const panelStyle = getByTestId("tooltip-panel").props.style;
    expect(panelStyle.opacity).toBeDefined();

    rerender(<TooltipOverlay visible={false} targetRect={null} content={content} onDismiss={jest.fn()} onExited={onExited} />);

    expect(onExited).toHaveBeenCalled();

    timingSpy.mockRestore();
    loopSpy.mockRestore();
  });
});
