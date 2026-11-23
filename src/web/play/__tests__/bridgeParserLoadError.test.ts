import {describe, expect, it, jest} from "@jest/globals";
import type {HostMessageHandlers} from "../bridgeRouter";

/** A single callback records any authority entry after actual message parsing. */
const handlers = (callback: () => void) => new Proxy({}, {get: () => callback}) as HostMessageHandlers;

describe("bridge parser startup recovery", () => {
  it("classifies one coalesced failed module load without executing queued commands", async () => {
    /** The same transport failure must remain available for target-owned diagnostics. */
    const cause = new TypeError("Failed to fetch dynamically imported module: /assets/validation.js");
    /** The actual dynamic import is the failure boundary, rather than a mocked message router. */
    const load = jest.fn(() => {throw cause;});
    jest.doMock("../../../core/bridge", load);
    try {
      await jest.isolateModulesAsync(async () => {
        /** A fresh router starts without a warm parser cache. */
        const {createHostMessageRouter, BridgeParserLoadError} = await import("../bridgeRouter");
        /** No unavailable schema can authorize a host command. */
        const command = jest.fn<() => void>();
        /** Simultaneous readiness and resize messages share the loader. */
        const route = createHostMessageRouter(handlers(command));
        /** Captures both rejections without leaking an unhandled promise. */
        const results = await Promise.allSettled([
          route({type: "game:resize", payload: {width: 390, height: 844}}),
          route({type: "game:resize", payload: {width: 390, height: 800}}),
        ]);
        expect(load).toHaveBeenCalledTimes(1);
        for (const result of results) {
          expect(result.status).toBe("rejected");
          if (result.status === "rejected") {
            expect(result.reason).toBeInstanceOf(BridgeParserLoadError);
            expect(result.reason.cause).toBe(cause);
            expect(result.reason.message).toBe("bridge-validation-unavailable");
          }
        }
        expect(command).not.toHaveBeenCalled();
      });
    } finally {
      jest.dontMock("src/core/bridge");
    }
  });

  it("keeps malformed messages and authority failures distinct from unavailable startup code", async () => {
    await jest.isolateModulesAsync(async () => {
      /** Successful real validation enables ordinary schema and command failures. */
      const {createHostMessageRouter, BridgeParserLoadError} = await import("../bridgeRouter");
      /** A command failure must retain its existing retry and error treatment. */
      const failure = new Error("service-temporarily-unavailable");
      /** Valid messages reach the real handler once. */
      const command = jest.fn<() => void>(() => {throw failure;});
      /** Real schema validation rejects the malformed payload before authority entry. */
      const route = createHostMessageRouter(handlers(command));
      await expect(route({type: "game:resize", payload: {width: "invalid", height: 844}})).rejects.not.toBeInstanceOf(BridgeParserLoadError);
      expect(command).not.toHaveBeenCalled();
      await expect(route({type: "game:resize", payload: {width: 390, height: 844}})).rejects.toBe(failure);
      expect(command).toHaveBeenCalledTimes(1);
    });
  });
});
