import React from "react";
import {StyleSheet} from "react-native";
import {render} from "@testing-library/react-native";
import TooltipCalloutShell from "../TooltipCalloutShell";

describe("TooltipCalloutShell", () => {
  it("renders the target cutout and pointer when anchored to a target", () => {
    const {getByTestId} = render(
      <TooltipCalloutShell
        visible={true}
        targetRect={{x: 48, y: 120, width: 120, height: 44}}
        showPointer={true}
      >
        <></>
      </TooltipCalloutShell>,
    );

    expect(getByTestId("tooltip-target-cutout")).toBeTruthy();
    expect(getByTestId("tooltip-pointer")).toBeTruthy();

    const pointerStyle = StyleSheet.flatten(getByTestId("tooltip-pointer").props.style);
    expect(pointerStyle.left).toBeGreaterThan(0);
  });

  it("renders a full backdrop without a pointer when there is no target", () => {
    const {getByTestId, queryByTestId} = render(
      <TooltipCalloutShell visible={true} targetRect={null} showPointer={false}>
        <></>
      </TooltipCalloutShell>,
    );

    expect(getByTestId("tooltip-backdrop")).toBeTruthy();
    expect(queryByTestId("tooltip-pointer")).toBeNull();
  });
});
