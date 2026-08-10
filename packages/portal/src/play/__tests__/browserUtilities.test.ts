import {dispatchLocalBridge, GAME_TO_HOST_EVENT, HOST_TO_GAME_EVENT} from "../localBridge";
import {createRequestId} from "../requestIds";

describe("browser utility boundaries", () => {
  const originalCrypto = globalThis.crypto;
  const originalWindow = globalThis.window;
  const originalCustomEvent = globalThis.CustomEvent;

  afterEach(() => {
    Object.defineProperty(globalThis, "crypto", {configurable: true, value: originalCrypto});
    Object.defineProperty(globalThis, "window", {configurable: true, value: originalWindow});
    Object.defineProperty(globalThis, "CustomEvent", {configurable: true, value: originalCustomEvent});
    jest.restoreAllMocks();
  });

  it("creates UUID-backed request identifiers when browser crypto is available", () => {
    Object.defineProperty(globalThis, "crypto", {
      configurable: true,
      value: {randomUUID: () => "12345678-1234-1234-1234-123456789abc"},
    });

    expect(createRequestId("hint")).toBe("hint-12345678-1234-1234-1234-123456789abc");
  });

  it.each([undefined, {}])("creates deterministic fallback identifiers without randomUUID", (cryptoValue) => {
    Object.defineProperty(globalThis, "crypto", {configurable: true, value: cryptoValue});
    jest.spyOn(Date, "now").mockReturnValue(1234);
    jest.spyOn(Math, "random").mockReturnValue(0.5);

    expect(createRequestId("answer")).toMatch(/^answer-1234-/);
  });

  it("dispatches typed bridge events to the local host", () => {
    class TestCustomEvent {
      public readonly type: string;
      public readonly detail: unknown;

      public constructor(type: string, init: {detail: unknown}) {
        this.type = type;
        this.detail = init.detail;
      }
    }

    const dispatchEvent = jest.fn(() => true);
    Object.defineProperty(globalThis, "CustomEvent", {configurable: true, value: TestCustomEvent});
    Object.defineProperty(globalThis, "window", {configurable: true, value: {dispatchEvent}});

    expect(GAME_TO_HOST_EVENT).toBe("riddle-quest:game-to-host");
    expect(HOST_TO_GAME_EVENT).toBe("riddle-quest:host-to-game");
    expect(dispatchLocalBridge(GAME_TO_HOST_EVENT, {ready: true})).toBe(true);
    expect(dispatchEvent).toHaveBeenCalledWith(expect.objectContaining({
      type: GAME_TO_HOST_EVENT,
      detail: {ready: true},
    }));
  });
});
