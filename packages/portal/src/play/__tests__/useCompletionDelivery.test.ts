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
/** Provides mock set retry signal behavior. */
const mockSetRetrySignal = jest.fn();

jest.mock("react", () => ({
  useCallback: (callback: unknown) => callback,
  useEffect: (effect: Effect) => mockEffects.push(effect),
  useRef: (initialValue: unknown) => {
    /** Provides ref behavior. */
    const ref = {current: initialValue};
    mockRefs.push(ref);
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

    handleResult(true);
    expect(dispatch).toHaveBeenCalledWith({type: "completionAcknowledged"});
    expect(window.clearTimeout).toHaveBeenLastCalledWith(2);
  });
});
