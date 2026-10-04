import {beforeEach, describe, expect, it, jest} from "@jest/globals";
import type {GameToHostMessage} from "@qwordly/core/bridge";

/** Describes effect. */
type Effect = () => void | (() => void);
/** Provides mock effects behavior. */
const mockEffects: Effect[] = [];
/** Layout effects are committed before passive delivery in this legacy hook harness. */
const mockLayoutEffects: Effect[] = [];
/** Runs the explicit React commit before executing the retained delivery effect. */
function commitDeliveryEffect() {
  mockLayoutEffects.splice(0).forEach(effect => effect());
  mockEffects[0]();
}
/** Retained state slots model lazy holders across explicit hook rerenders. */
const mockStates: unknown[] = [];
/** Index of the state slot visited by the current render. */
let mockStateIndex = 0;

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
  useLayoutEffect: (effect: Effect) => mockLayoutEffects.push(effect),
  useRef: (initialValue: unknown) => {
    /** Provides ref behavior. */
    const ref = mockRefs[mockRefIndex] ?? {current: initialValue};
    mockRefs[mockRefIndex] = ref;
    mockRefIndex += 1;
    return ref;
  },
  useState: (initial: unknown) => {
    /** Lazily initialized state persists until the fixture starts a new mount. */
    const index = mockStateIndex++;
    if (!(index in mockStates)) mockStates[index] = typeof initial === "function" ? initial() : initial;
    return [mockStates[index], mockSetRetrySignal];
  },
}));

jest.mock("../requestIds", () => ({createRequestId: () => "complete-request-stable"}));

import {useCompletionDelivery} from "../game/hooks/useCompletionDelivery";

describe("useCompletionDelivery", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockEffects.length = 0;
    mockLayoutEffects.length = 0;
    mockRefs.length = 0;
    mockStates.length = 0;
    mockRefIndex = 0;
    mockStateIndex = 0;
    /** Provides timer id behavior. */
    let timerId = 0;
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        clearTimeout: jest.fn(),
        setTimeout: jest.fn(() => ++timerId),
      },
    });
  });

  it("retires queued receipts and rejects acknowledgements when the account changes", () => {
    /** Counts terminal receipt dispatches across account replacement. */
    const postToHost = jest.fn<(message: GameToHostMessage) => void>();
    /** Old responses cannot acknowledge the new player outcome. */
    const dispatch = jest.fn();
    useCompletionDelivery({ownerKey: "alice:1", outcome: {
      id: "alice-win", kind: "win", riddleId: "classic-1", gameMode: "classic",
      sessionToken: "00000000-0000-4000-8000-000000000001", attempts: 1, isCorrect: true,
    }, dispatch, postToHost});
    commitDeliveryEffect();
    mockRefIndex = 0;
    mockStateIndex = 0;
    mockEffects.length = 0;
    /** Render revokes old acknowledgements before effect cleanup. */
    const acknowledge = useCompletionDelivery({ownerKey: "bob:1", outcome: null, dispatch, postToHost});
    expect(acknowledge(true, "complete-request-stable")).toBe(false);
    commitDeliveryEffect();
    expect(window.clearTimeout).toHaveBeenCalledWith(1);
    commitDeliveryEffect();
    expect(postToHost).toHaveBeenCalledTimes(1);
    expect(acknowledge(true, "complete-request-stable")).toBe(false);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("resumes retries when React replays the mounted effects", () => {
    /** The same idempotent outcome survives React development effect replay. */
    const postToHost = jest.fn<(message: GameToHostMessage) => void>();
    useCompletionDelivery({outcome: {
      id: "replayed-win", kind: "win", riddleId: "classic-1", gameMode: "classic",
      sessionToken: "00000000-0000-4000-8000-000000000001", attempts: 1, isCorrect: true,
    }, dispatch: jest.fn(), postToHost});
    commitDeliveryEffect();
    /** StrictMode cleans up and restarts the same effects with retained ref cells. */
    const cleanup = mockEffects[1]();
    if (cleanup) cleanup();
    commitDeliveryEffect();
    expect(postToHost).toHaveBeenCalledTimes(2);
    expect(window.setTimeout).toHaveBeenCalledTimes(2);
  });

  it("cancels its retry even when the local bridge acknowledges synchronously", () => {
    /** Receipt callback becomes available before the effects deliver the local message. */
    let acknowledge: (ok: boolean, requestId?: string) => boolean;
    /** A synchronous bridge listener represents an already-completed idempotent operation. */
    const postToHost = jest.fn<(message: GameToHostMessage) => void>(message => {
      acknowledge(true, message.requestId);
    });
    acknowledge = useCompletionDelivery({outcome: {
      id: "immediate-win", kind: "win", riddleId: "classic-1", gameMode: "classic",
      sessionToken: "00000000-0000-4000-8000-000000000001", attempts: 1, isCorrect: true,
    }, dispatch: jest.fn(), postToHost});
    commitDeliveryEffect();
    expect(window.clearTimeout).toHaveBeenCalledWith(1);
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

    commitDeliveryEffect();
    handleResult(false);
    expect(dispatch).not.toHaveBeenCalled();
    expect(window.clearTimeout).not.toHaveBeenCalled();

    /** Provides schedule retry behavior. */
    const scheduleRetry = (window.setTimeout as jest.Mock).mock.calls[0][0] as () => void;
    scheduleRetry();
    expect(mockSetRetrySignal).toHaveBeenCalled();
    commitDeliveryEffect();

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
    commitDeliveryEffect();
    mockRefIndex = 0;
    mockStateIndex = 0;
    mockEffects.length = 0;
    /** Handles late result. */
    const handleLateResult = useCompletionDelivery({outcome: null, dispatch, postToHost});
    commitDeliveryEffect();
    /** Provides schedule retry behavior. */
    const scheduleRetry = (window.setTimeout as jest.Mock).mock.calls[0][0] as () => void;
    scheduleRetry();
    commitDeliveryEffect();
    expect(postToHost).toHaveBeenCalledTimes(2);
    expect(handleLateResult(true, "complete-request-stable")).toBe(false);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("keeps one delivery when Continue's provisional row count becomes the authoritative total", () => {
    /** A Continued board previews one local row; the server reports all six attempts. */
    const provisional = {id: "session-win-1", kind: "win" as const, riddleId: "classic-17", gameMode: "classic" as const,
      sessionToken: "00000000-0000-4000-8000-000000000017", attempts: 1, isCorrect: true};
    /** The current question remains identical while only authoritative attempt metadata changes. */
    const confirmed = {...provisional, id: "session-win-6", attempts: 6};
    /** Actual delivery effects share refs across both reducer outcomes. */
    const postToHost = jest.fn<(message: GameToHostMessage) => void>();
    /** The acknowledgement must apply to the canonical version of the same question. */
    const dispatch = jest.fn();
    useCompletionDelivery({outcome: provisional, dispatch, postToHost});
    commitDeliveryEffect();
    mockRefIndex = 0;
    mockStateIndex = 0;
    mockEffects.length = 0;
    /** Correlates the response with the canonical question outcome. */
    const acknowledge = useCompletionDelivery({outcome: confirmed, dispatch, postToHost});
    commitDeliveryEffect();
    expect(postToHost).toHaveBeenCalledTimes(1);
    expect(acknowledge(true, "complete-request-stable")).toBe(true);
    expect(dispatch).toHaveBeenCalledWith({type: "completionAcknowledged"});
    mockRefIndex = 0;
    mockStateIndex = 0;
    mockEffects.length = 0;
    useCompletionDelivery({outcome: confirmed, dispatch, postToHost});
    commitDeliveryEffect();
    expect(postToHost).toHaveBeenCalledTimes(1);
  });

  it("rejoins acknowledgement when the canonical Continue row count arrives after completion", () => {
    /** First response may confirm completion before the guess receipt corrects attempt metadata. */
    const outcome = {id: "continued-win-1", kind: "win" as const, riddleId: "classic-17", gameMode: "classic" as const,
      sessionToken: "00000000-0000-4000-8000-000000000017", attempts: 1, isCorrect: true};
    /** Exact same issued question must retain its completed receipt. */
    const postToHost = jest.fn<(message: GameToHostMessage) => void>();
    /** Canonical guess reduction clears completionAcknowledged and must rejoin that receipt. */
    const dispatch = jest.fn();
    /** Captures completion before canonical attempt metadata arrives. */
    const acknowledge = useCompletionDelivery({outcome, dispatch, postToHost});
    commitDeliveryEffect();
    expect(acknowledge(true, "complete-request-stable")).toBe(true);
    dispatch.mockClear();
    mockRefIndex = 0;
    mockStateIndex = 0;
    mockEffects.length = 0;
    useCompletionDelivery({outcome: {...outcome, id: "continued-win-6", attempts: 6}, dispatch, postToHost});
    commitDeliveryEffect();
    expect(postToHost).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith({type: "completionAcknowledged"});
  });
});
