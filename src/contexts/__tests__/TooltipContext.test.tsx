import React from "react";
import {act, renderHook, waitFor} from "@testing-library/react-native";
import {TooltipProvider, useTooltip} from "../TooltipContext";
import {hasSeenTooltip, markTooltipSeen} from "../../components/tooltips/tooltipStorage";
import type {TooltipRequest} from "../../components/tooltips/types";

let mockDevShowTips = false;

jest.mock("../../constants/tooltips", () => ({
  get DEV_SHOW_TIPS() {
    return mockDevShowTips;
  },
}));

jest.mock("../../components/tooltips/tooltipStorage", () => ({
  hasSeenTooltip: jest.fn(),
  markTooltipSeen: jest.fn(),
}));

jest.mock("../../components/tooltips/TooltipOverlay", () => {
  const React = require("react");
  const {View} = require("react-native");

  return function MockTooltipOverlay({visible, content}: any) {
    return React.createElement(View, {
      testID: "tooltip-overlay",
      "data-visible": visible,
      "data-title": content?.title,
    });
  };
});

const createWrapper = () => {
  const Wrapper: React.FC<{children: React.ReactNode}> = ({children}) => {
    return <TooltipProvider>{children}</TooltipProvider>;
  };
  return Wrapper;
};

const createTargetRef = (): TooltipRequest["targetRef"] => ({
  current: {
    measureInWindow: jest.fn((cb) => cb(12, 24, 48, 36)),
  } as any,
});

describe("TooltipContext", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDevShowTips = false;
    (hasSeenTooltip as jest.Mock).mockResolvedValue(false);
  });

  it("marks a tooltip as seen only when dismissed", async () => {
    const {result} = renderHook(() => useTooltip(), {
      wrapper: createWrapper(),
    });

    const request: TooltipRequest = {
      id: "submitAnswer",
      userId: "user-1",
      targetRef: createTargetRef(),
      content: {
        title: "Submit answer",
        body: "Tap submit.",
        action: "Got it",
      },
    };

    await act(async () => {
      await expect(result.current.showTooltipOnce(request)).resolves.toBe(true);
    });

    expect(hasSeenTooltip).toHaveBeenCalledWith("submitAnswer", "user-1");
    expect(markTooltipSeen).not.toHaveBeenCalled();

    act(() => {
      result.current.dismissTooltip("submitAnswer");
    });

    await waitFor(() => {
      expect(markTooltipSeen).toHaveBeenCalledWith("submitAnswer", "user-1");
    });
  });

  it("respects seen state when dev tips are disabled", async () => {
    (hasSeenTooltip as jest.Mock).mockResolvedValueOnce(true);

    const {result} = renderHook(() => useTooltip(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await expect(
        result.current.showTooltipOnce({
          id: "hintAfterWrongGuess",
          userId: "user-2",
          targetRef: createTargetRef(),
          content: {
            title: "Hint",
            body: "Use a hint.",
            action: "Got it",
          },
        }),
      ).resolves.toBe(false);
    });

    expect(markTooltipSeen).not.toHaveBeenCalled();
  });

  it("bypasses seen-state suppression when DEV_SHOW_TIPS is enabled", async () => {
    mockDevShowTips = true;
    (hasSeenTooltip as jest.Mock).mockResolvedValueOnce(true);

    const {result} = renderHook(() => useTooltip(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await expect(
        result.current.showTooltipOnce({
          id: "shopOutOfCoins",
          userId: "user-3",
          targetRef: createTargetRef(),
          content: {
            title: "Shop",
            body: "You are out of coins.",
            action: "Got it",
          },
        }),
      ).resolves.toBe(true);
    });

    expect(hasSeenTooltip).not.toHaveBeenCalled();
    expect(result.current.activeTooltipId).toBe("shopOutOfCoins");

    act(() => {
      result.current.dismissTooltip("shopOutOfCoins");
    });

    await waitFor(() => {
      expect(markTooltipSeen).toHaveBeenCalledWith("shopOutOfCoins", "user-3");
    });
  });
});
