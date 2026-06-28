import React from "react";
import {StyleSheet} from "react-native";
import {fireEvent, render} from "@testing-library/react-native";
import TooltipCalloutShell from "../TooltipCalloutShell";

describe("TooltipCalloutShell", () => {
  it("renders a full backdrop, lifted target, and pointer when anchored to a target", () => {
    const {getByTestId, queryByTestId} = render(
      <TooltipCalloutShell
        visible={true}
        targetRect={{x: 48, y: 120, width: 120, height: 44}}
        highlightElement={<></>}
        showPointer={true}
      >
        <></>
      </TooltipCalloutShell>,
    );

    expect(queryByTestId("tooltip-target-cutout")).toBeNull();
    expect(queryByTestId("tooltip-backdrop-top")).toBeNull();
    expect(queryByTestId("tooltip-backdrop-left")).toBeNull();
    expect(queryByTestId("tooltip-backdrop-right")).toBeNull();
    expect(queryByTestId("tooltip-backdrop-bottom")).toBeNull();
    expect(getByTestId("tooltip-backdrop")).toBeTruthy();
    expect(getByTestId("tooltip-highlighted-target")).toBeTruthy();
    expect(getByTestId("tooltip-pointer")).toBeTruthy();

    const pointerStyle = StyleSheet.flatten(getByTestId("tooltip-pointer").props.style);
    expect(pointerStyle.left).toBeGreaterThan(0);
    expect(pointerStyle.borderBottomColor).not.toBe("transparent");
  });

  it("can cut the backdrop around a measured target without rendering a duplicate target", () => {
    const {getByTestId, queryByTestId} = render(
      <TooltipCalloutShell
        visible={true}
        targetRect={{x: 48, y: 120, width: 120, height: 44}}
        cutoutTarget={true}
        showPointer={true}
      >
        <></>
      </TooltipCalloutShell>,
    );

    expect(getByTestId("tooltip-backdrop")).toBeTruthy();
    expect(getByTestId("tooltip-backdrop-piece-0")).toBeTruthy();
    expect(getByTestId("tooltip-backdrop-piece-1")).toBeTruthy();
    expect(getByTestId("tooltip-backdrop-piece-2")).toBeTruthy();
    expect(getByTestId("tooltip-backdrop-piece-3")).toBeTruthy();
    expect(queryByTestId("tooltip-highlighted-target")).toBeNull();
  });

  it("does not fall back to a full backdrop for a cutout tooltip without a target", () => {
    const {queryByTestId} = render(
      <TooltipCalloutShell
        visible={true}
        targetRect={null}
        cutoutTarget={true}
        showPointer={false}
      >
        <></>
      </TooltipCalloutShell>,
    );

    expect(queryByTestId("tooltip-backdrop")).toBeNull();
  });

  it("can render the callout without owning a backdrop", () => {
    const {getByTestId, queryByTestId} = render(
      <TooltipCalloutShell
        visible={true}
        targetRect={{x: 48, y: 120, width: 120, height: 44}}
        showBackdrop={false}
        showPointer={true}
      >
        <></>
      </TooltipCalloutShell>,
    );

    expect(queryByTestId("tooltip-backdrop")).toBeNull();
    expect(getByTestId("tooltip-panel")).toBeTruthy();
  });

  it("sizes the full backdrop from the viewport", () => {
    const {getByTestId} = render(
      <TooltipCalloutShell
        visible={true}
        targetRect={null}
        showPointer={true}
      >
        <></>
      </TooltipCalloutShell>,
    );

    const shellStyle = StyleSheet.flatten(getByTestId("tooltip-callout-shell").props.style);
    const backdropStyle = StyleSheet.flatten(getByTestId("tooltip-backdrop").props.style);

    expect(backdropStyle.left).toBe(0);
    expect(backdropStyle.top).toBe(0);
    expect(backdropStyle.width).toBe(shellStyle.width);
    expect(backdropStyle.height).toBe(shellStyle.height);
  });

  it("positions the lifted target at the measured target rect", () => {
    const targetRect = {x: 120, y: 420, width: 140, height: 48};
    const {getByTestId} = render(
      <TooltipCalloutShell visible={true} targetRect={targetRect} highlightElement={<></>} showPointer={true}>
        <></>
      </TooltipCalloutShell>,
    );

    const highlightedTargetStyle = StyleSheet.flatten(getByTestId("tooltip-highlighted-target").props.style);

    expect(highlightedTargetStyle.left).toBe(targetRect.x);
    expect(highlightedTargetStyle.top).toBe(targetRect.y);
    expect(highlightedTargetStyle.width).toBe(targetRect.width);
    expect(highlightedTargetStyle.height).toBe(targetRect.height);
  });

  it("does not draw around a measured target when no lifted target is supplied", () => {
    const {queryByTestId} = render(
      <TooltipCalloutShell visible={true} targetRect={{x: 120, y: 420, width: 140, height: 48}} showPointer={true}>
        <></>
      </TooltipCalloutShell>,
    );

    expect(queryByTestId("tooltip-highlighted-target")).toBeNull();
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

  it("uses measured panel height to point an above callout at the target top", () => {
    const targetRect = {x: 48, y: 360, width: 120, height: 44};
    const {getByTestId} = render(
      <TooltipCalloutShell visible={true} targetRect={targetRect} preferredPlacement="above" showPointer={true}>
        <></>
      </TooltipCalloutShell>,
    );

    fireEvent(getByTestId("tooltip-panel"), "layout", {nativeEvent: {layout: {height: 160}}});

    const panelStyle = StyleSheet.flatten(getByTestId("tooltip-panel").props.style);
    const pointerStyle = StyleSheet.flatten(getByTestId("tooltip-pointer").props.style);
    expect(pointerStyle.bottom).toBe(-9);
    expect(panelStyle.top + 160 + Math.abs(pointerStyle.bottom)).toBe(targetRect.y);
  });

  it("keeps the pointer on top when a low target prefers a below callout", () => {
    const {getByTestId} = render(
      <TooltipCalloutShell
        visible={true}
        targetRect={{x: 48, y: 620, width: 120, height: 44}}
        preferredPlacement="below"
        showPointer={true}
      >
        <></>
      </TooltipCalloutShell>,
    );

    const pointerStyle = StyleSheet.flatten(getByTestId("tooltip-pointer").props.style);
    expect(pointerStyle.top).toBeDefined();
    expect(pointerStyle.borderBottomColor).not.toBe("transparent");
    expect(pointerStyle.borderTopColor).toBe("transparent");
  });

  it("renders a full backdrop without a pointer when there is no target", () => {
    const {getByTestId, queryByTestId} = render(
      <TooltipCalloutShell visible={true} targetRect={null} showPointer={false}>
        <></>
      </TooltipCalloutShell>,
    );

    expect(getByTestId("tooltip-backdrop")).toBeTruthy();
    expect(getByTestId("tooltip-backdrop").props.pointerEvents).toBe("none");
    expect(StyleSheet.flatten(getByTestId("tooltip-backdrop").props.style).width).toBe(
      StyleSheet.flatten(getByTestId("tooltip-callout-shell").props.style).width,
    );
    expect(queryByTestId("tooltip-pointer")).toBeNull();
  });
});
