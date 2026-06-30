import React from "react";
import {act, renderHook, waitFor} from "@testing-library/react-native";
import {TooltipProvider, useTooltip} from "../TooltipContext";
import {
  hasSeenTooltip,
  hasSeenTooltipSequence,
  markTooltipSeen,
  markTooltipSequenceSeen,
} from "../../components/tooltips/tooltipStorage";
import type {TooltipRequest} from "../../components/tooltips/types";

let mockDevShowTips = false;

jest.mock("../../constants/tooltips", () => ({
  get DEV_SHOW_TIPS() {
    return mockDevShowTips;
  },
}));

jest.mock("../../components/tooltips/tooltipStorage", () => ({
  hasSeenTooltip: jest.fn(),
  hasSeenTooltipSequence: jest.fn(),
  markTooltipSeen: jest.fn(),
  markTooltipSequenceSeen: jest.fn(),
}));

const mockTooltipOverlay = jest.fn();

jest.mock("../../components/tooltips/TooltipOverlay", () => {
  const React = require("react");
  const {View} = require("react-native");

  return function MockTooltipOverlay(props: any) {
    mockTooltipOverlay(props);
    return React.createElement(View, {
      testID: "tooltip-overlay",
      "data-visible": props.visible,
      "data-title": props.content?.title,
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
    mockTooltipOverlay.mockClear();
    mockDevShowTips = false;
    (hasSeenTooltip as jest.Mock).mockResolvedValue(false);
    (hasSeenTooltipSequence as jest.Mock).mockResolvedValue(false);
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

  it("retries target measurement when the first layout pass has no size", async () => {
    const measureInWindow = jest
      .fn()
      .mockImplementationOnce((cb) => cb(0, 0, 0, 0))
      .mockImplementationOnce((cb) => cb(12, 24, 48, 36));
    const targetRef: TooltipRequest["targetRef"] = {
      current: {measureInWindow} as any,
    };
    const {result} = renderHook(() => useTooltip(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await expect(
        result.current.showTooltipOnce({
          id: "submitAnswer",
          userId: "user-4",
          targetRef,
          content: {
            title: "Submit answer",
            body: "Tap submit.",
            action: "Got it",
          },
        }),
      ).resolves.toBe(true);
    });

    await waitFor(() => {
      expect(measureInWindow).toHaveBeenCalledTimes(2);
      expect(mockTooltipOverlay).toHaveBeenLastCalledWith(
        expect.objectContaining({
          targetRect: {x: 12, y: 24, width: 48, height: 36},
        }),
      );
    });
  });

  it("applies an optional vertical offset to the measured target", async () => {
    const {result} = renderHook(() => useTooltip(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await expect(
        result.current.showTooltipOnce({
          id: "gameCoins",
          userId: "user-4",
          targetRef: createTargetRef(),
          targetOffsetY: 32,
          content: {
            title: "Coins",
            body: "Tap the coins.",
            action: "Got it",
          },
        }),
      ).resolves.toBe(true);
    });

    await waitFor(() => {
      expect(mockTooltipOverlay).toHaveBeenLastCalledWith(
        expect.objectContaining({
          targetRect: {x: 12, y: 56, width: 48, height: 36},
        }),
      );
    });
  });

  it("retries target measurement when the first layout pass is offscreen", async () => {
    const measureInWindow = jest
      .fn()
      .mockImplementationOnce((cb) => cb(133, -18, 93, 37))
      .mockImplementationOnce((cb) => cb(133, 586, 93, 48));
    const targetRef: TooltipRequest["targetRef"] = {
      current: {measureInWindow} as any,
    };
    const {result} = renderHook(() => useTooltip(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await expect(
        result.current.showTooltipOnce({
          id: "submitAnswer",
          userId: "user-5",
          targetRef,
          content: {
            title: "Submit answer",
            body: "Tap submit.",
            action: "Got it",
          },
        }),
      ).resolves.toBe(true);
    });

    await waitFor(() => {
      expect(measureInWindow).toHaveBeenCalledTimes(2);
      expect(mockTooltipOverlay).toHaveBeenLastCalledWith(
        expect.objectContaining({
          targetRect: {x: 133, y: 586, width: 93, height: 48},
        }),
      );
    });
  });

  it("uses the window overlay for submit tooltips so window target measurements line up", async () => {
    const {result} = renderHook(() => useTooltip(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await expect(
        result.current.showTooltipOnce({
          id: "submitAnswer",
          userId: "user-6",
          targetRef: createTargetRef(),
          content: {
            title: "Submit answer",
            body: "Tap submit.",
            action: "Got it",
          },
        }),
      ).resolves.toBe(true);
    });

    await waitFor(() => {
      expect(mockTooltipOverlay).toHaveBeenLastCalledWith(
        expect.objectContaining({
          cutoutTarget: false,
          showBackdrop: true,
          useNativeModal: true,
        }),
      );
    });
  });

  it("uses a cutout spotlight for the original profile progression content", async () => {
    const {result} = renderHook(() => useTooltip(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await expect(
        result.current.showTooltipOnce({
          id: "profileProgression",
          userId: "user-7",
          targetRef: createTargetRef(),
          content: {
            title: "User progression",
            body: "Track your XP.",
            action: "Got it",
          },
        }),
      ).resolves.toBe(true);
    });

    await waitFor(() => {
      expect(mockTooltipOverlay).toHaveBeenLastCalledWith(
        expect.objectContaining({
          cutoutTarget: true,
          showBackdrop: true,
          useNativeModal: true,
        }),
      );
    });
  });

  it("uses a cutout spotlight for the original profile treasure chest card", async () => {
    const {result} = renderHook(() => useTooltip(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await expect(
        result.current.showTooltipOnce({
          id: "profileCoins",
          userId: "user-7",
          targetRef: createTargetRef(),
          content: {
            title: "Treasure chest",
            body: "Track your coins.",
            action: "Got it",
          },
        }),
      ).resolves.toBe(true);
    });

    await waitFor(() => {
      expect(mockTooltipOverlay).toHaveBeenLastCalledWith(
        expect.objectContaining({
          cutoutTarget: true,
          showBackdrop: true,
          useNativeModal: true,
        }),
      );
    });
  });

  it("lets tooltip requests opt out of native modal presentation", async () => {
    const {result} = renderHook(() => useTooltip(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await expect(
        result.current.showTooltipOnce({
          id: "profileProgression",
          userId: "user-7",
          targetRef: createTargetRef(),
          content: {
            title: "User progression",
            body: "Track your XP.",
            action: "Got it",
          },
          useNativeModal: false,
        }),
      ).resolves.toBe(true);
    });

    await waitFor(() => {
      expect(mockTooltipOverlay).toHaveBeenLastCalledWith(
        expect.objectContaining({
          useNativeModal: false,
        }),
      );
    });
  });

  it("skips already seen tooltip requests when starting a sequence", async () => {
    (hasSeenTooltip as jest.Mock).mockImplementation((tooltipId: string) =>
      Promise.resolve(tooltipId === "profileProgression"),
    );

    const {result} = renderHook(() => useTooltip(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await expect(
        result.current.showTooltipSequence([
          {
            id: "profileProgression",
            userId: "user-8",
            targetRef: createTargetRef(),
            content: {
              title: "User progression",
              body: "Track your XP.",
              action: "Got it",
            },
          },
          {
            id: "profileDailyPuzzles",
            userId: "user-8",
            targetRef: createTargetRef(),
            content: {
              title: "Daily puzzles",
              body: "Track daily puzzles.",
              action: "Got it",
            },
          },
        ]),
      ).resolves.toBe(true);
    });

    expect(hasSeenTooltip).toHaveBeenCalledWith("profileProgression", "user-8");
    expect(hasSeenTooltip).toHaveBeenCalledWith("profileDailyPuzzles", "user-8");
    expect(result.current.activeTooltipId).toBe("profileDailyPuzzles");
  });

  it("ignores duplicate sequence starts while a tooltip sequence is already active", async () => {
    const {result} = renderHook(() => useTooltip(), {
      wrapper: createWrapper(),
    });

    const profileSequence: TooltipRequest[] = [
      {
        id: "profileProgression",
        userId: "user-9",
        targetRef: createTargetRef(),
        content: {
          title: "User progression",
          body: "Track your XP.",
          action: "Got it",
        },
      },
      {
        id: "profileDailyPuzzles",
        userId: "user-9",
        targetRef: createTargetRef(),
        content: {
          title: "Daily puzzles",
          body: "Track daily puzzles.",
          action: "Got it",
        },
      },
    ];

    await act(async () => {
      await expect(
        result.current.showTooltipSequence(profileSequence, {sequenceId: "profileTour", userId: "user-9"}),
      ).resolves.toBe(true);
    });

    await act(async () => {
      await expect(
        result.current.showTooltipSequence(profileSequence, {sequenceId: "profileTour", userId: "user-9"}),
      ).resolves.toBe(false);
    });

    expect(hasSeenTooltipSequence).toHaveBeenCalledWith("profileTour", "user-9");
    expect(hasSeenTooltip).not.toHaveBeenCalled();
    expect(result.current.activeTooltipId).toBe("profileProgression");
  });

  it("advances inline tooltip sequences on dismiss and stops after the last tooltip", async () => {
    const {result} = renderHook(() => useTooltip(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await expect(
        result.current.showTooltipSequence(
          [
            {
              id: "profileProgression",
              userId: "user-13",
              targetRef: createTargetRef(),
              content: {
                title: "User progression",
                body: "Track your XP.",
                action: "Got it",
              },
              useNativeModal: false,
            },
            {
              id: "profileDailyPuzzles",
              userId: "user-13",
              targetRef: createTargetRef(),
              content: {
                title: "Daily puzzles",
                body: "Track daily puzzles.",
                action: "Got it",
              },
              useNativeModal: false,
            },
          ],
          {sequenceId: "profileTour", userId: "user-13"},
        ),
      ).resolves.toBe(true);
    });

    expect(result.current.activeTooltipId).toBe("profileProgression");

    act(() => {
      result.current.dismissTooltip("profileProgression");
    });

    await waitFor(() => {
      expect(result.current.activeTooltipId).toBe("profileDailyPuzzles");
    });
    expect(markTooltipSequenceSeen).not.toHaveBeenCalled();

    act(() => {
      result.current.dismissTooltip("profileDailyPuzzles");
    });

    await waitFor(() => {
      expect(result.current.activeTooltipId).toBeNull();
      expect(markTooltipSequenceSeen).toHaveBeenCalledWith("profileTour", "user-13");
    });
    expect(markTooltipSeen).toHaveBeenCalledWith("profileProgression", "user-13");
    expect(markTooltipSeen).toHaveBeenCalledWith("profileDailyPuzzles", "user-13");
  });

  it("plays a sequence-id tour even when individual tooltip ids were seen before", async () => {
    (hasSeenTooltip as jest.Mock).mockResolvedValue(true);
    (hasSeenTooltipSequence as jest.Mock).mockResolvedValue(false);

    const {result} = renderHook(() => useTooltip(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await expect(
        result.current.showTooltipSequence(
          [
            {
              id: "profileProgression",
              userId: "user-11",
              targetRef: createTargetRef(),
              content: {
                title: "User progression",
                body: "Track your XP.",
                action: "Got it",
              },
            },
          ],
          {sequenceId: "profileTour", userId: "user-11"},
        ),
      ).resolves.toBe(true);
    });

    expect(hasSeenTooltipSequence).toHaveBeenCalledWith("profileTour", "user-11");
    expect(hasSeenTooltip).not.toHaveBeenCalled();
    expect(result.current.activeTooltipId).toBe("profileProgression");
  });

  it("does not play a completed sequence-id tour", async () => {
    (hasSeenTooltipSequence as jest.Mock).mockResolvedValue(true);

    const {result} = renderHook(() => useTooltip(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await expect(
        result.current.showTooltipSequence(
          [
            {
              id: "profileProgression",
              userId: "user-12",
              targetRef: createTargetRef(),
              content: {
                title: "User progression",
                body: "Track your XP.",
                action: "Got it",
              },
            },
          ],
          {sequenceId: "profileTour", userId: "user-12"},
        ),
      ).resolves.toBe(false);
    });

    expect(hasSeenTooltipSequence).toHaveBeenCalledWith("profileTour", "user-12");
    expect(hasSeenTooltip).not.toHaveBeenCalled();
    expect(result.current.activeTooltipId).toBeNull();
  });

  it("does not replay a fully seen tooltip sequence even when dev tips are enabled", async () => {
    mockDevShowTips = true;
    (hasSeenTooltip as jest.Mock).mockResolvedValue(true);

    const {result} = renderHook(() => useTooltip(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await expect(
        result.current.showTooltipSequence([
          {
            id: "profileProgression",
            userId: "user-10",
            targetRef: createTargetRef(),
            content: {
              title: "User progression",
              body: "Track your XP.",
              action: "Got it",
            },
          },
          {
            id: "profileDailyPuzzles",
            userId: "user-10",
            targetRef: createTargetRef(),
            content: {
              title: "Daily puzzles",
              body: "Track daily puzzles.",
              action: "Got it",
            },
          },
        ]),
      ).resolves.toBe(false);
    });

    expect(hasSeenTooltip).toHaveBeenCalledWith("profileProgression", "user-10");
    expect(hasSeenTooltip).toHaveBeenCalledWith("profileDailyPuzzles", "user-10");
    expect(result.current.activeTooltipId).toBeNull();
    expect(mockTooltipOverlay).not.toHaveBeenCalled();
  });

});
