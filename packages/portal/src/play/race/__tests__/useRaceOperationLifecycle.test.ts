import {beforeEach, describe, expect, it, jest} from "@jest/globals";
import type {GameToHostMessage} from "@qwordly/core/bridge";
import type {RaceOperation} from "../logic/raceOperations";

type Effect = () => void | (() => void);

const mockEffects: Effect[] = [];
const mockRefs: Array<{current: unknown}> = [];
const mockSetPending = jest.fn();
const mockSetRaceGuessLoading = jest.fn();
const mockCreateRequestId = jest.fn((operation: string) => `request-${operation}`);
let mockStateCall = 0;

jest.mock("react", () => ({
  useCallback: (callback: unknown) => callback,
  useEffect: (effect: Effect) => mockEffects.push(effect),
  useRef: (initialValue: unknown) => {
    const ref = {current: initialValue};
    mockRefs.push(ref);
    return ref;
  },
  useState: () => mockStateCall++ === 0
    ? [null, mockSetPending]
    : [false, mockSetRaceGuessLoading],
}));

jest.mock("../../requestIds", () => ({
  createRequestId: mockCreateRequestId,
}));

import {useRaceOperationLifecycle} from "../hooks/useRaceOperationLifecycle";

const createHarness = () => {
  const postToHost = jest.fn<(message: GameToHostMessage) => void>();
  const setError = jest.fn();
  const lifecycle = useRaceOperationLifecycle({postToHost, setError: setError as never});
  expect(mockRefs).toHaveLength(5);
  expect(mockEffects).toHaveLength(1);
  return {lifecycle, postToHost, setError};
};

beforeEach(() => {
  jest.clearAllMocks();
  mockEffects.length = 0;
  mockRefs.length = 0;
  mockStateCall = 0;
  Object.defineProperty(globalThis, "performance", {
    configurable: true,
    value: {now: jest.fn(() => 0)},
  });
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      clearTimeout: jest.fn(),
      setTimeout: jest.fn(() => 17),
    },
  });
});

describe("useRaceOperationLifecycle", () => {
  it("correlates read operations without adding mutation receipts", () => {
    const {lifecycle, postToHost, setError} = createHarness();

    lifecycle.send("raceInbox", "game:listRaceInbox", {limit: 20});

    expect(lifecycle.expectedRequestRef.current).toBe("request-raceInbox");
    expect(mockSetPending).toHaveBeenCalledWith("raceInbox");
    expect(setError).toHaveBeenCalledWith(null);
    expect(postToHost).toHaveBeenCalledWith({
      type: "game:listRaceInbox",
      requestId: "request-raceInbox",
      payload: {limit: 20},
    });
    const cleanup = mockEffects[0]() as () => void;
    cleanup();
    expect(window.clearTimeout).not.toHaveBeenCalled();
  });

  it("adds the same idempotency receipt used for bridge correlation to mutations", () => {
    const {lifecycle, postToHost} = createHarness();

    lifecycle.send("raceHint", "game:requestRaceHint", {runId: "run-1", riddleId: "riddle-1"});

    expect(postToHost).toHaveBeenCalledWith({
      type: "game:requestRaceHint",
      requestId: "request-raceHint",
      payload: {
        runId: "run-1",
        riddleId: "riddle-1",
        requestId: "request-raceHint",
      },
    });
  });

  it("keeps the answer loader visible for its minimum duration", () => {
    const {lifecycle} = createHarness();
    lifecycle.send("raceGuess", "game:submitRaceGuess", {});

    expect(mockSetRaceGuessLoading).toHaveBeenCalledWith(true);
    lifecycle.finishOperation("raceGuess");

    const pendingUpdater = mockSetPending.mock.calls.at(-1)?.[0] as (
      current: RaceOperation | null,
    ) => RaceOperation | null;
    expect(pendingUpdater("raceGuess")).toBeNull();
    expect(pendingUpdater("raceHint")).toBe("raceHint");
    expect(window.setTimeout).toHaveBeenCalledWith(expect.any(Function), 180);
    const finishLoader = (window.setTimeout as jest.Mock).mock.calls[0][0] as () => void;
    finishLoader();
    expect(mockSetRaceGuessLoading).toHaveBeenLastCalledWith(false);
  });

  it("hands a completed guess loader over to the outcome request", () => {
    const {lifecycle} = createHarness();
    lifecycle.send("raceGuess", "game:submitRaceGuess", {});
    lifecycle.setRaceGuessAwaitingOutcome(true);

    lifecycle.finishOperation("raceGuess");
    expect(window.setTimeout).not.toHaveBeenCalled();
    lifecycle.finishOperation("raceOutcome");
    expect(window.setTimeout).toHaveBeenCalledTimes(1);
  });

  it("cancels stale loader timers on a new guess and during unmount", () => {
    const {lifecycle} = createHarness();
    lifecycle.send("raceGuess", "game:submitRaceGuess", {});
    lifecycle.finishOperation("raceGuess");

    lifecycle.send("raceGuess", "game:submitRaceGuess", {});
    expect(window.clearTimeout).toHaveBeenCalledWith(17);
    lifecycle.finishOperation("raceGuess");
    const cleanup = mockEffects[0]() as () => void;
    cleanup();
    expect(window.clearTimeout).toHaveBeenLastCalledWith(17);
  });
});
