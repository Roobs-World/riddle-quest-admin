import {describe, expect, it, jest} from "@jest/globals";
import type {GameSessionState} from "../gameSessionTypes";

/** Provides mock use memo behavior. */
const mockUseMemo = (factory: () => unknown) => factory();

jest.mock("react", () => ({
  useMemo: mockUseMemo,
  useSyncExternalStore: jest.fn(),
}));

import {useGameMessageRouter} from "../useGameMessageRouter";

describe("useGameMessageRouter", () => {
  it("consumes a successful bridge cancellation without notice, balance, or fanfare actions", async () => {
    /** Provides dispatch behavior. */
    const dispatch = jest.fn();
    /** Provides router behavior. */
    const router = useGameMessageRouter({
      dispatch,
      stateRef: {current: {} as GameSessionState},
      postToHost: jest.fn(),
      requestRiddle: jest.fn(),
    });

    await router({
      type: "host:operationResult",
      requestId: "purchase-cancelled-1",
      payload: {
        operation: "purchase",
        ok: true,
        data: {
          success: false,
          cancelled: true,
          productId: "coin-pack-1",
          purchaseType: "consumable",
        },
      },
    });

    expect(dispatch).not.toHaveBeenCalled();
  });
});
