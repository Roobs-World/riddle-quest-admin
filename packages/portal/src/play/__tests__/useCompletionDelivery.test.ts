import {beforeEach, describe, expect, it, jest} from "@jest/globals";
import type {GameToHostMessage} from "@qwordly/core/bridge";

/** Describes effect. */
type Effect = () => void | (() => void);
/** Provides mock effects behavior. */
const mockEffects: Effect[] = [];
/** Provides mock refs behavior. */
const mockRefs: Array<{
  /** Stores current. */
  current: unknown;
}> = [];
/** Provides mock ref index behavior. */
let mockRefIndex = 0;
/** Provides mock set retry signal behavior. */
const mockSetRetrySignal = jest.fn();

jest.mock("react", () => ({
  useCallback: (callback: unknown) => callback,
  useEffect: (effect: Effect) => mockEffects.push(effect),
  useRef: (initialValue: unknown) => {
    /** Provides ref behavior. */
    const ref = mockRefs[mockRefIndex] ?? {current: initialValue};
    mockRefs[mockRefIndex] = ref;
    mockRefIndex += 1;
    return ref;
  },
  useState: () => [0, mockSetRetrySignal],
}));

jest.mock("../requestIds", () => ({createRequestId: () => "complete-request-stable"}));

import {useCompletionDelivery} from "../game/hooks/useCompletionDelivery";

describe("useCompletionDelivery", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockEffects.length = 0;
    mockRefs.length = 0;
    mockRefIndex = 0;
    /** Provides timer id behavior. */
    let timerId = 0;
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        clearTimeout: jest.fn(),
        setTimeout: jest.fn(() => ++timerId),
      },
    });
  });

  it("retries a failed completion with the same receipt and clears only after acknowledgement", () => {
    /** Provides post to host behavior. */
    const postToHost = jest.fn<(message: GameToHostMessage) => void>();
    /** Provides dispatch behavior. */
    const dispatch = jest.fn();
    /** Handles result. */
    const handleResult = useCompletionDelivery({
      outcome: {
        id: "classic-1-token-win-1",
        kind: "win",
        riddleId: "classic-1",
        gameMode: "classic",
        sessionToken: "00000000-0000-4000-8000-000000000001",
        attempts: 1,
        isCorrect: true,
      },
      dispatch,
      postToHost,
    });

    mockEffects[0]();
    handleResult(false);
    expect(dispatch).not.toHaveBeenCalled();
    expect(window.clearTimeout).not.toHaveBeenCalled();

    /** Provides schedule retry behavior. */
    const scheduleRetry = (window.setTimeout as jest.Mock).mock.calls[0][0] as () => void;
    scheduleRetry();
    expect(mockSetRetrySignal).toHaveBeenCalled();
    mockEffects[0]();

    expect(postToHost).toHaveBeenCalledTimes(2);
    expect(postToHost.mock.calls[0][0].requestId).toBe("complete-request-stable");
    expect(postToHost.mock.calls[1][0].requestId).toBe("complete-request-stable");
    expect(window.setTimeout).toHaveBeenNthCalledWith(1, expect.any(Function), 1_000);
    expect(window.setTimeout).toHaveBeenNthCalledWith(2, expect.any(Function), 2_000);

    handleResult(true, "complete-request-stable");
    expect(dispatch).toHaveBeenCalledWith({type: "completionAcknowledged"});
    expect(window.clearTimeout).toHaveBeenLastCalledWith(2);
  });

  it("keeps retrying after play advances and ignores a late acknowledgement for the new riddle", () => {
    /** Provides post to host behavior. */
    const postToHost = jest.fn<(message: GameToHostMessage) => void>();
    /** Provides dispatch behavior. */
    const dispatch = jest.fn();
    useCompletionDelivery({
      outcome: {
        id: "daily-win", kind: "win", riddleId: "daily-1", gameMode: "challenge",
        sessionToken: "00000000-0000-4000-8000-000000000001", attempts: 1, isCorrect: true,
      },
      dispatch,
      postToHost,
    });
    mockEffects[0]();
    mockRefIndex = 0;
    mockEffects.length = 0;
    /** Handles late result. */
    const handleLateResult = useCompletionDelivery({outcome: null, dispatch, postToHost});
    mockEffects[0]();
    /** Provides schedule retry behavior. */
    const scheduleRetry = (window.setTimeout as jest.Mock).mock.calls[0][0] as () => void;
    scheduleRetry();
    mockEffects[0]();
    expect(postToHost).toHaveBeenCalledTimes(2);
    expect(handleLateResult(true, "complete-request-stable")).toBe(false);
    expect(dispatch).not.toHaveBeenCalled();
  });
});
