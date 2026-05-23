import React from "react";
import { fireEvent, render } from "@testing-library/react-native";
import TooltipOverlay from "../TooltipOverlay";

describe("TooltipOverlay", () => {
  const content = {
    title: "Submit your answer",
    body: "Tap submit.",
    action: "Got it",
  };

  it("renders backdrop segments and a target cutout when target rect is available", () => {
    const { getByTestId, getByText } = render(
      <TooltipOverlay
        visible={true}
        targetRect={{ x: 20, y: 80, width: 120, height: 48 }}
        content={content}
        onDismiss={jest.fn()}
      />
    );

    expect(getByTestId("tooltip-overlay")).toBeTruthy();
    expect(getByTestId("tooltip-backdrop-top")).toBeTruthy();
    expect(getByTestId("tooltip-target-cutout")).toBeTruthy();
    expect(getByText("Submit your answer")).toBeTruthy();
  });

  it("renders a full backdrop when no target is available", () => {
    const { getByTestId } = render(
      <TooltipOverlay
        visible={true}
        targetRect={null}
        content={content}
        onDismiss={jest.fn()}
      />
    );

    expect(getByTestId("tooltip-backdrop")).toBeTruthy();
  });

  it("calls onDismiss from the action button", () => {
    const onDismiss = jest.fn();
    const { getByTestId } = render(
      <TooltipOverlay
        visible={true}
        targetRect={null}
        content={content}
        onDismiss={onDismiss}
      />
    );

    fireEvent.press(getByTestId("tooltip-dismiss-button"));
    expect(onDismiss).toHaveBeenCalled();
  });
});
