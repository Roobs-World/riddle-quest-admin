import {RedditPlatformBootstrap, selectMigratableGuestPreferences} from "../RedditPlatformBootstrap";
import {purchase} from "@devvit/payments/client";

jest.mock("@devvit/payments/client", () => ({purchase: jest.fn()}));

const reply = (payload: unknown, ok = true) => Promise.resolve({ok, json: async () => payload}) as Promise<Response>;
const values = new Map<string, string>();
const localStorage = {
  get length() { return values.size; },
  clear: () => values.clear(),
  getItem: (key: string) => values.get(key) ?? null,
  key: (index: number) => [...values.keys()][index] ?? null,
  removeItem: (key: string) => { values.delete(key); },
  setItem: (key: string, value: string) => { values.set(key, value); },
};
const enabledFeatures = {
  identity: true, gameplay: true, commerce: true, referrals: true,
  notifications: true, matchmaking: true, tournaments: true, presence: true,
};

beforeAll(() => {
  Object.defineProperty(globalThis, "window", {value: {localStorage}, configurable: true});
  Object.defineProperty(globalThis, "document", {
    value: {visibilityState: "visible", addEventListener: jest.fn(), removeEventListener: jest.fn()},
    configurable: true,
  });
});

beforeEach(() => {
  window.localStorage.clear();
  jest.restoreAllMocks();
});

it("creates transient guest storage without exposing optional platform capabilities", async () => {
  global.fetch = jest.fn(() => reply({ok: true, authenticated: false}));
  const progress: number[] = [];
  const result = await new RedditPlatformBootstrap().initialize((value) => progress.push(value));
  expect(result.status).toBe("success");
  if (result.status !== "success") return;
  expect(result.value).toMatchObject({platform: "reddit", playerId: "reddit-guest"});
  expect(result.value.initialPreferences).toEqual({});
  expect(result.value.capabilities).toEqual({lifecycle: expect.any(Object)});
  await result.value.storage.writePreferences({locale: "ar", muted: true});
  await expect(result.value.storage.readPreferences()).resolves.toMatchObject({locale: "ar", muted: true});
  expect(progress).toEqual([20, 80, 100]);
});

it("uses only same-origin gateway storage for authenticated Reddit sessions", async () => {
  global.fetch = jest.fn((input, init) => {
    const path = String(input);
    if (path === "/api/session") return reply({ok: true, authenticated: true, accountGeneration: 1, features: enabledFeatures});
    if (path === "/api/storage/read") return reply({ok: true, preferences: {locale: "ja"}, playerData: null});
    if (path === "/api/storage/write") return reply({ok: true, written: true});
    if (path === "/api/commerce/key") return reply({ok: true, key: "R".repeat(43), metadataKey: "riddle-account"});
    if (path === "/api/commerce/recover") return reply({ok: true, recovered: 1});
    if (path === "/api/game/race.match") return reply({ok: true, result: {
      status: "matched",
      challenge: {
        challengeId: "challenge-1", creator: {displayName: "Rival"}, categoryId: "history", locale: "ja",
        targetCorrect: 10, adjustedTimeToBeatMs: 40_000, rulesVersion: "race10_v1",
        expiresAtMs: 20_000, status: "active",
      },
    }});
    if (path === "/api/game/tournament.list") return reply({ok: true, result: {
      tournamentId: "reddit-race10-ja-2026-08-20", locale: "ja", startsAtMs: 1,
      endsAtMs: 86_400_001, sortOrder: "LOWER_IS_BETTER", rewardsEnabled: false,
      standings: [{rank: 1, adjustedTimeMs: 40_000, isCurrentPlayer: true}],
      currentPlayer: {rank: 1, adjustedTimeMs: 40_000, isCurrentPlayer: true},
    }});
    if (path === "/api/game/tournament.record") return reply({ok: true, result: {
      tournamentId: "reddit-race10-ja-2026-08-20", locale: "ja", runId: "run-1",
      adjustedTimeMs: 40_000, completedAtMs: 50_000, improved: true,
      sortOrder: "LOWER_IS_BETTER", rewardsEnabled: false,
    }});
    throw new Error(`unexpected path ${path} ${String(init?.method)}`);
  }) as typeof fetch;
  const result = await new RedditPlatformBootstrap().initialize(() => undefined);
  expect(result.status).toBe("success");
  if (result.status !== "success") return;
  expect(result.value.playerId).toBe("reddit-account");
  expect(result.value.initialPreferences).toEqual({locale: "ja"});
  await expect(result.value.capabilities.commerce?.listProducts()).resolves.toEqual({
    status: "success",
    value: expect.arrayContaining([
      expect.objectContaining({id: "riddle_quest_coins_250", price: "50 Gold", kind: "consumable"}),
      expect.objectContaining({id: "riddle_quest_coins_7000", price: "1000 Gold", kind: "consumable"}),
    ]),
  });
  (purchase as jest.Mock).mockResolvedValue({status: 1, orderId: "order-1"});
  await expect(result.value.capabilities.commerce?.purchase("riddle_quest_coins_250")).resolves.toEqual({
    status: "success", value: {providerReceiptId: "order-1"},
  });
  expect(purchase).toHaveBeenCalledWith("riddle_quest_coins_250", {"riddle-account": "R".repeat(43)});
  await expect(result.value.capabilities.commerce?.recover()).resolves.toEqual({status: "success", value: undefined});
  await expect(result.value.capabilities.matchmaking?.find("ja")).resolves.toMatchObject({
    status: "success", value: {status: "matched", challenge: {challengeId: "challenge-1", locale: "ja"}},
  });
  await expect(result.value.capabilities.tournaments?.list("ja")).resolves.toMatchObject({
    tournamentId: "reddit-race10-ja-2026-08-20", rewardsEnabled: false,
    standings: [{rank: 1, isCurrentPlayer: true}],
  });
  await expect(result.value.capabilities.tournaments?.record("run-1", "ja")).resolves.toMatchObject({
    runId: "run-1", adjustedTimeMs: 40_000, rewardsEnabled: false,
  });
  await expect(result.value.storage.readPreferences()).resolves.toEqual({locale: "ja"});
  await result.value.storage.writePreferences({locale: "ja", reducedMotion: true});
  expect(global.fetch).toHaveBeenCalledWith("/api/storage/write", expect.objectContaining({
    method: "POST",
    body: JSON.stringify({preferences: {locale: "ja", reducedMotion: true}}),
  }));
  expect([...((global.fetch as jest.Mock).mock.calls as [string][])].every(([path]) => path.startsWith("/api/"))).toBe(true);
});

it("omits matchmaking when its independent server capability is disabled", async () => {
  global.fetch = jest.fn((input) => {
    const path = String(input);
    if (path === "/api/session") return reply({ok: true, authenticated: true, accountGeneration: 1, features: {...enabledFeatures, matchmaking: false}});
    if (path === "/api/storage/read") return reply({ok: true, preferences: {}, playerData: null});
    throw new Error(`unexpected path ${path}`);
  }) as typeof fetch;
  const result = await new RedditPlatformBootstrap().initialize(() => undefined);
  expect(result.status).toBe("success");
  if (result.status === "success") expect(result.value.capabilities.matchmaking).toBeUndefined();
});

it("omits tournaments when its independent server capability is disabled", async () => {
  global.fetch = jest.fn((input) => {
    const path = String(input);
    if (path === "/api/session") return reply({ok: true, authenticated: true, accountGeneration: 1,
      features: {...enabledFeatures, tournaments: false}});
    if (path === "/api/storage/read") return reply({ok: true, preferences: {}, playerData: null});
    throw new Error(`unexpected path ${path}`);
  }) as typeof fetch;
  const result = await new RedditPlatformBootstrap().initialize(() => undefined);
  expect(result.status).toBe("success");
  if (result.status === "success") expect(result.value.capabilities.tournaments).toBeUndefined();
});

it("omits commerce when its independent approval capability is disabled", async () => {
  global.fetch = jest.fn((input) => {
    const path = String(input);
    if (path === "/api/session") return reply({ok: true, authenticated: true, accountGeneration: 1,
      features: {...enabledFeatures, commerce: false}});
    if (path === "/api/storage/read") return reply({ok: true, preferences: {}, playerData: null});
    throw new Error(`unexpected path ${path}`);
  }) as typeof fetch;
  const result = await new RedditPlatformBootstrap().initialize(() => undefined);
  expect(result.status).toBe("success");
  if (result.status === "success") expect(result.value.capabilities.commerce).toBeUndefined();
});

it("returns a recoverable startup failure for an invalid gateway response", async () => {
  global.fetch = jest.fn(() => reply({ok: false, error: "unavailable"}, false));
  await expect(new RedditPlatformBootstrap().initialize(() => undefined)).resolves.toEqual({
    status: "retryable-failure",
    message: "reddit-gateway-request-failed",
  });
});

it("falls back to isolated guest play when Reddit gameplay is emergency-disabled", async () => {
  global.fetch = jest.fn(() => reply({
    ok: true,
    authenticated: true,
    features: {...enabledFeatures, gameplay: false},
  }));
  const result = await new RedditPlatformBootstrap().initialize(() => undefined);
  expect(result.status).toBe("success");
  if (result.status !== "success") return;
  expect(result.value.playerId).toBe("reddit-guest");
  expect(global.fetch).toHaveBeenCalledTimes(1);
});

it("fails closed to guest play for malformed authenticated feature configuration", async () => {
  global.fetch = jest.fn(() => reply({ok: true, authenticated: true, features: {gameplay: true}}));
  const result = await new RedditPlatformBootstrap().initialize(() => undefined);
  expect(result.status).toBe("success");
  if (result.status !== "success") return;
  expect(result.value.playerId).toBe("reddit-guest");
});

it("migrates only safe guest preferences after login and discards forged player state", async () => {
  window.localStorage.setItem("riddleQuestRedditGuestV1", JSON.stringify({
    preferences: {
      locale: "ar",
      muted: true,
      onboardingComplete: true,
      firstMilestoneMarked: true,
      presenceEnabled: true,
    },
    playerData: {
      schemaVersion: 1,
      updatedAt: 10,
      profile: {coins: 99_999},
      activeGame: {forged: true},
    },
  }));
  global.fetch = jest.fn((input) => {
    const path = String(input);
    if (path === "/api/session") return reply({ok: true, authenticated: true, accountGeneration: 1, features: enabledFeatures});
    if (path === "/api/storage/read") return reply({
      ok: true,
      preferences: {locale: "ja", highContrast: true},
      playerData: null,
    });
    if (path === "/api/storage/write") return reply({ok: true, written: true});
    throw new Error(`unexpected path ${path}`);
  }) as typeof fetch;

  const result = await new RedditPlatformBootstrap().initialize(() => undefined);
  expect(result.status).toBe("success");
  if (result.status === "success") expect(result.value.initialPreferences).toEqual({
    locale: "ja", muted: true, onboardingComplete: true, highContrast: true,
  });
  expect(global.fetch).toHaveBeenCalledWith("/api/storage/write", expect.objectContaining({
    body: JSON.stringify({preferences: {
      locale: "ja",
      muted: true,
      onboardingComplete: true,
      highContrast: true,
    }}),
  }));
  expect(window.localStorage.getItem("riddleQuestRedditGuestV1")).toBeNull();
  expect(JSON.stringify((global.fetch as jest.Mock).mock.calls)).not.toContain("99_999");
  expect(JSON.stringify((global.fetch as jest.Mock).mock.calls)).not.toContain("firstMilestoneMarked");
  expect(JSON.stringify((global.fetch as jest.Mock).mock.calls)).not.toContain("presenceEnabled");
});

it("retains guest state when the authenticated migration cannot be acknowledged", async () => {
  window.localStorage.setItem("riddleQuestRedditGuestV1", JSON.stringify({preferences: {locale: "de"}}));
  global.fetch = jest.fn((input) => {
    const path = String(input);
    if (path === "/api/session") return reply({ok: true, authenticated: true, accountGeneration: 1, features: enabledFeatures});
    if (path === "/api/storage/read") return reply({ok: true, preferences: {}, playerData: null});
    return reply({ok: false, error: "unavailable"}, false);
  }) as typeof fetch;

  const result = await new RedditPlatformBootstrap().initialize(() => undefined);
  expect(result).toEqual({status: "retryable-failure", message: "reddit-gateway-request-failed"});
  expect(window.localStorage.getItem("riddleQuestRedditGuestV1")).not.toBeNull();
});

it("excludes account, economy, notification, and presence fields from guest migration", () => {
  expect(selectMigratableGuestPreferences({
    locale: "fr",
    registrationPromptDismissedAt: 1,
    firstMilestoneMarked: true,
    presenceEnabled: true,
    facebookNotificationPermission: "accepted",
    facebookNotificationLastPromptAtMs: 2,
  })).toEqual({locale: "fr"});
});

it("maps browser visibility to pause/resume and unregisters lifecycle listeners", async () => {
  global.fetch = jest.fn(() => reply({ok: true, authenticated: false}));
  const result = await new RedditPlatformBootstrap().initialize(() => undefined);
  expect(result.status).toBe("success");
  if (result.status !== "success") return;
  const pause = jest.fn();
  const resume = jest.fn();
  const removePause = result.value.capabilities.lifecycle?.onPause(pause);
  const removeResume = result.value.capabilities.lifecycle?.onResume(resume);
  const listeners = (document.addEventListener as jest.Mock).mock.calls
    .filter(([name]) => name === "visibilitychange")
    .map(([, listener]) => listener as () => void);
  Object.defineProperty(document, "visibilityState", {value: "hidden", configurable: true});
  listeners.forEach((listener) => listener());
  expect(pause).toHaveBeenCalledTimes(1);
  expect(resume).not.toHaveBeenCalled();
  Object.defineProperty(document, "visibilityState", {value: "visible", configurable: true});
  listeners.forEach((listener) => listener());
  expect(resume).toHaveBeenCalledTimes(1);
  removePause?.();
  removeResume?.();
  expect(document.removeEventListener).toHaveBeenCalledTimes(2);
});

it("preserves a valid guest solo snapshot across an expanded-view reload", async () => {
  global.fetch = jest.fn(() => reply({ok: true, authenticated: false}));
  const first = await new RedditPlatformBootstrap().initialize(() => undefined);
  expect(first.status).toBe("success");
  if (first.status !== "success") return;
  await first.value.storage.writePlayerData({
    schemaVersion: 1,
    updatedAt: 10,
    profile: {
      username: "Guest Solver", coins: 0, level: 1, xp: 0, winStreak: 0,
      gamesPlayed: 2, wins: 1, achievements: [], classicIndex: 2,
    },
    activeGame: null,
  });
  const reloaded = await new RedditPlatformBootstrap().initialize(() => undefined);
  expect(reloaded.status).toBe("success");
  if (reloaded.status !== "success") return;
  await expect(reloaded.value.storage.readPlayerData()).resolves.toMatchObject({
    schemaVersion: 1,
    profile: {coins: 0, xp: 0, gamesPlayed: 2, wins: 1, classicIndex: 2},
    activeGame: null,
  });
});
