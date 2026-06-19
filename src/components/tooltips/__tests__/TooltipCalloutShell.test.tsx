import React from "react";
import {StyleSheet} from "react-native";
import {render} from "@testing-library/react-native";
import TooltipCalloutShell from "../TooltipCalloutShell";

describe("TooltipCalloutShell", () => {
  it("renders backdrop cutout segments and pointer when anchored to a target", () => {
    const {getByTestId, queryByTestId} = render(
      <TooltipCalloutShell
        visible={true}
        targetRect={{x: 48, y: 120, width: 120, height: 44}}
        showPointer={true}
      >
        <></>
      </TooltipCalloutShell>,
    );

    expect(queryByTestId("tooltip-target-cutout")).toBeNull();
    expect(getByTestId("tooltip-pointer")).toBeTruthy();
    expect(getByTestId("tooltip-backdrop-top").props.pointerEvents).toBe("none");

    const pointerStyle = StyleSheet.flatten(getByTestId("tooltip-pointer").props.style);
    expect(pointerStyle.left).toBeGreaterThan(0);
    expect(pointerStyle.borderBottomColor).not.toBe("transparent");
  });

  it("fills the pointer when the callout is above the target", () => {
    const {getByTestId} = render(
      <TooltipCalloutShell
        visible={true}
        targetRect={{x: 48, y: 620, width: 120, height: 44}}
        showPointer={true}
      >
        <></>
      </TooltipCalloutShell>,
    );

    const pointerStyle = StyleSheet.flatten(getByTestId("tooltip-pointer").props.style);
    expect(pointerStyle.borderTopColor).not.toBe("transparent");
    expect(pointerStyle.borderBottomColor).toBe("transparent");
  });

  it("renders a full backdrop without a pointer when there is no target", () => {
    const {getByTestId, queryByTestId} = render(
      <TooltipCalloutShell visible={true} targetRect={null} showPointer={false}>
        <></>
      </TooltipCalloutShell>,
    );

    expect(getByTestId("tooltip-backdrop")).toBeTruthy();
    expect(getByTestId("tooltip-backdrop").props.pointerEvents).toBe("none");
    expect(queryByTestId("tooltip-pointer")).toBeNull();
  });
});
