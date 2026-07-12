import {describe, expect, it, jest} from "@jest/globals";
import {BRIDGE_PROTOCOL_VERSION} from "@qwordly/core/bridge/constants";
import {createGameMessageRouter, createHostMessageRouter} from "../bridgeRouter";

describe("portal bridge routers", () => {
  it("routes game messages to host handlers", async () => {
    const loadRiddle = jest.fn();
    const router = createHostMessageRouter({
      ready: jest.fn(),
      resize: jest.fn(),
      loadRiddle,
      completeGame: jest.fn(),
      requestHint: jest.fn(),
      spendCoins: jest.fn(),
      requestPurchase: jest.fn(),
      requestRewardedAd: jest.fn(),
      analytics: jest.fn(),
      error: jest.fn(),
    });

    await router({
      type: "game:loadRiddle",
      requestId: "load-1",
      payload: {
        gameMode: "classic",
        locale: "en",
        classicIndex: 2,
      },
    });

    expect(loadRiddle).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "game:loadRiddle",
        requestId: "load-1",
      }),
    );
  });

  it("routes host messages to the game session", async () => {
    const init = jest.fn();
    const router = createGameMessageRouter({
      init,
      authState: jest.fn(),
      riddleLoaded: jest.fn(),
      operationResult: jest.fn(),
      pause: jest.fn(),
      resume: jest.fn(),
    });

    await router({
      type: "host:init",
      requestId: "init-1",
      payload: {
        protocolVersion: BRIDGE_PROTOCOL_VERSION,
        sessionId: "session-1",
        locale: "en",
        user: null,
        profile: null,
        gameMode: "classic",
        products: [],
      },
    });

    expect(init).toHaveBeenCalledWith(expect.objectContaining({type: "host:init"}));
  });

  it("rejects invalid incoming envelopes", async () => {
    const router = createHostMessageRouter({
      ready: jest.fn(),
      resize: jest.fn(),
      loadRiddle: jest.fn(),
      completeGame: jest.fn(),
      requestHint: jest.fn(),
      spendCoins: jest.fn(),
      requestPurchase: jest.fn(),
      requestRewardedAd: jest.fn(),
      analytics: jest.fn(),
      error: jest.fn(),
    });

    await expect(router({type: "game:spendCoins", payload: {reason: "magic"}})).rejects.toThrow();
  });
});
