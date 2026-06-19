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

  it("renders backdrop segments and a pointer when target rect is available", () => {
    const {getByTestId, getByText, queryByTestId} = render(
      <TooltipOverlay
        visible={true}
        targetRect={{x: 20, y: 80, width: 120, height: 48}}
        content={content}
        onDismiss={jest.fn()}
      />,
    );

    expect(getByTestId("tooltip-overlay")).toBeTruthy();
    expect(getByTestId("tooltip-backdrop-top")).toBeTruthy();
    expect(queryByTestId("tooltip-target-cutout")).toBeNull();
    expect(getByTestId("tooltip-pointer")).toBeTruthy();
    expect(getByText("Submit your answer")).toBeTruthy();
  });

  it("does not use a native modal that would trap game input", () => {
    const {UNSAFE_queryByType} = render(
      <TooltipOverlay visible={true} targetRect={null} content={content} onDismiss={jest.fn()} />,
    );

    expect(UNSAFE_queryByType(Modal)).toBeNull();
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
