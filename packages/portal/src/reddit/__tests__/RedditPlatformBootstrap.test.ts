import {
  REDDIT_GATEWAY_REQUEST_TIMEOUT_MS,
  RedditPlatformBootstrap,
  postRedditGateway,
  selectMigratableGuestPreferences,
} from "../RedditPlatformBootstrap";
import {purchase} from "@devvit/payments/client";
import {getWebViewMode} from "@devvit/client";
import {raceMatchFailure} from "@qwordly/core/race";

jest.mock("@devvit/payments/client", () => ({purchase: jest.fn()}));
jest.mock("@devvit/client", () => ({getWebViewMode: jest.fn(() => "expanded")}));

/** Provides reply behavior. */
const reply = (payload: unknown, ok = true) => Promise.resolve({ok, json: async () => payload}) as Promise<Response>;
/** Provides values behavior. */
const values = new Map<string, string>();
/** Provides local storage behavior. */
const localStorage = {
  /** Gets length. */
  get length() {
    return values.size;
  },
  clear: () => values.clear(),
  getItem: (key: string) => values.get(key) ?? null,
  key: (index: number) => [...values.keys()][index] ?? null,
  removeItem: (key: string) => {
    values.delete(key);
  },
  setItem: (key: string, value: string) => {
    values.set(key, value);
  },
};
/** Provides enabled features behavior. */
const enabledFeatures = {
  identity: true,
  gameplay: true,
  commerce: true,
  referrals: true,
  notifications: true,
  matchmaking: true,
  tournaments: true,
  presence: true,
};

beforeAll(() => {
  Object.defineProperty(globalThis, "window", {value: {localStorage, addEventListener: jest.fn(), removeEventListener: jest.fn()}, configurable: true});
  Object.defineProperty(globalThis, "document", {
    value: {visibilityState: "visible", addEventListener: jest.fn(), removeEventListener: jest.fn()},
    configurable: true,
  });
});

beforeEach(() => {
  window.localStorage.clear();
  jest.restoreAllMocks();
  jest.mocked(getWebViewMode).mockReturnValue("expanded");
  jest.mocked(window.addEventListener).mockClear();
  jest.mocked(document.removeEventListener).mockClear();
});

it.each([
  ["/api/game/race.live.update", 409, "live-race-request-failed", "failed-precondition"],
  ["/api/game/race.live.join", 409, "live-race-request-failed", "failed-precondition"],
  ["/api/game/race.live.update", 503, "live-race-request-failed", "unavailable"],
  ["/api/game/race.live.update", 409, "other-error", "unavailable"],
  ["/api/game/race.resume", 409, "live-race-request-failed", "unavailable"],
])("preserves definitive live rejections only for their exact gateway contract: %s %i", async (path, status, marker, code) => {
  global.fetch = jest.fn(() => Promise.resolve({ok: false, status, json: async () => ({error: marker, code: "failed-precondition"})}) as Promise<Response>);
  await expect(postRedditGateway(path)).rejects.toMatchObject({code});
});

it.each([
  [503, raceMatchFailure("temporarily-unavailable", 1500), "retryable-failure"],
  [429, raceMatchFailure("search-budget-exceeded"), "retryable-failure"],
  [409, raceMatchFailure("intent-expired"), "retryable-failure"],
  [403, raceMatchFailure("access-denied"), "terminal-failure"],
] as const)("preserves typed matchmaking failure through HTTP %s", async (status, failure, expectedStatus) => {
  global.fetch = jest.fn(input => {
    /** Same-origin route distinguishes session/storage bootstrapping from matchmaking delivery. */
    const path = String(input);
    if (path === "/api/session") return reply({ok: true, authenticated: true, accountGeneration: 1,
      features: {...enabledFeatures, commerce: false, presence: false}});
    if (path === "/api/storage/read") return reply({ok: true, preferences: {}, playerData: null});
    return Promise.resolve({ok: false, status, json: async () => ({error: "raw server diagnostics", matchmaking: failure})}) as Promise<Response>;
  }) as typeof fetch;
  /** Authenticated adapter through which typed HTTP recovery crosses the public seam. */
  const session = await new RedditPlatformBootstrap().initialize(() => undefined);
  expect(session.status).toBe("success");
  if (session.status !== "success") throw new Error("expected-authenticated-session");
  /** Public failure result must retain recovery guidance without raw server diagnostics. */
  const result = await session.value.capabilities.matchmaking!.find({locale: "en", requestId: "same-intent"});
  expect(result).toMatchObject({status: expectedStatus, failure});
  expect(JSON.stringify(result)).not.toContain("raw server diagnostics");
  expect((global.fetch as jest.Mock).mock.calls.at(-1)).toMatchObject(["/api/game/race.match", {body: JSON.stringify({locale: "en", requestId: "same-intent"})}]);
});

it("classifies a legacy HTTP quota failure as same-intent backoff", async () => {
  global.fetch = jest.fn(input => {
    if (input === "/api/session") return reply({ok: true, authenticated: true, accountGeneration: 1,
      features: {...enabledFeatures, commerce: false, presence: false}});
    if (input === "/api/storage/read") return reply({ok: true, preferences: {}, playerData: null});
    return Promise.resolve({ok: false, status: 429, json: async () => ({error: "rate-limited"})}) as Promise<Response>;
  }) as typeof fetch;
  /** Legacy quota response reaches the same authenticated web matchmaking adapter. */
  const session = await new RedditPlatformBootstrap().initialize(() => undefined);
  if (session.status !== "success") throw new Error("expected-authenticated-session");
  await expect(session.value.capabilities.matchmaking!.find("en")).resolves.toMatchObject({status: "retryable-failure",
    failure: raceMatchFailure("temporarily-unavailable", 1000)});
});

afterEach(() => {
  jest.useRealTimers();
});

it("reads Devvit mode on focus and cleans up lifecycle listeners", async () => {
  global.fetch = jest.fn(() => reply({ok: true, authenticated: false}));
  /** A real adapter session owns its provider lifecycle listeners. */
  const result = await new RedditPlatformBootstrap().initialize(() => undefined);
  if (result.status !== "success") throw new Error("expected-reddit-session");
  /** Host callbacks observe expanded-to-inline transitions while visibility stays visible. */
  const pause = jest.fn();
  /** Returning to expanded mode resumes only the active game. */
  const resume = jest.fn();
  /** Unsubscribes the exact listener registered with Devvit's browser lifecycle. */
  const unsubscribePause = result.value.capabilities.lifecycle!.onPause(pause);
  /** Resume listeners must also be removable on game teardown. */
  const unsubscribeResume = result.value.capabilities.lifecycle!.onResume(resume);
  /** Provider focus callbacks are driven independently of document visibility. */
  const focusListeners = jest.mocked(window.addEventListener).mock.calls.filter(([event]) => event === "focus");
  jest.mocked(getWebViewMode).mockReturnValue("inline");
  for (const [, listener] of focusListeners) (listener as EventListener)(new Event("focus"));
  expect(pause).toHaveBeenCalledTimes(1);
  expect(resume).not.toHaveBeenCalled();
  jest.mocked(getWebViewMode).mockReturnValue("expanded");
  for (const [, listener] of focusListeners) (listener as EventListener)(new Event("focus"));
  expect(pause).toHaveBeenCalledTimes(1);
  expect(resume).toHaveBeenCalledTimes(1);
  unsubscribePause();
  unsubscribeResume();
  for (const [, listener] of focusListeners) expect(window.removeEventListener).toHaveBeenCalledWith("focus", listener);
});

it.each([
  "https://attacker.example/api/session",
  "//attacker.example/api/session",
  "/functions/session",
  "/api/../functions/session",
  "/api/%2e%2e/functions/session",
  "/api\\session",
])("rejects a Reddit gateway path outside the exact same-origin namespace: %s", async (path) => {
  global.fetch = jest.fn();

  await expect(postRedditGateway(path)).rejects.toThrow("invalid-reddit-gateway-path");
  expect(global.fetch).not.toHaveBeenCalled();
});

it("creates transient guest storage without exposing optional platform capabilities", async () => {
  global.fetch = jest.fn(() => reply({ok: true, authenticated: false}));
  /** Provides progress behavior. */
  const progress: number[] = [];
  /** Provides result behavior. */
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

it("keeps guest state in memory while rejecting false durability acknowledgement", async () => {
  global.fetch = jest.fn(() => reply({ok: true, authenticated: false}));
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    get: () => {
      throw new DOMException("Storage is blocked", "SecurityError");
    },
  });

  try {
    /** Provides result behavior. */
    const result = await new RedditPlatformBootstrap().initialize(() => undefined);
    expect(result.status).toBe("success");
    if (result.status !== "success") return;

    await expect(result.value.storage.writePreferences({locale: "ar", muted: true})).rejects.toThrow("reddit-guest-storage-unavailable");
    await expect(result.value.storage.readPreferences()).resolves.toEqual({locale: "ar", muted: true});
    await expect(result.value.storage.clear()).resolves.toBeUndefined();
    await expect(result.value.storage.readPreferences()).resolves.toEqual({});
  } finally {
    Object.defineProperty(window, "localStorage", {configurable: true, value: localStorage});
  }
});

it("uses only same-origin gateway storage for authenticated Reddit sessions", async () => {
  global.fetch = jest.fn((input, init) => {
    /** Provides path behavior. */
    const path = String(input);
    if (path === "/api/session")
      return reply({ok: true, authenticated: true, accountGeneration: 1, features: enabledFeatures});
    if (path === "/api/storage/read") return reply({ok: true, preferences: {locale: "ja"}, playerData: null});
    if (path === "/api/storage/write") return reply({ok: true, written: true});
    if (path === "/api/commerce/key") return reply({ok: true, key: "R".repeat(43), metadataKey: "riddle-account"});
    if (path === "/api/commerce/recover") return reply({ok: true, recovered: 1});
    if (path === "/api/game/race.match")
      return reply({
        ok: true,
        result: {
          status: "matched",
          challenge: {
            challengeId: "challenge-1",
            creator: {displayName: "Rival"},
            categoryId: "history",
            locale: "ja",
            targetCorrect: 10,
            adjustedTimeToBeatMs: 40_000,
            rulesVersion: "race10_v1",
            expiresAtMs: 20_000,
            status: "active",
          },
        },
      });
    if (path === "/api/game/tournament.list")
      return reply({
        ok: true,
        result: {
          tournamentId: "reddit-race10-ja-2026-08-20",
          locale: "ja",
          startsAtMs: 1,
          endsAtMs: 86_400_001,
          sortOrder: "LOWER_IS_BETTER",
          rewardsEnabled: false,
          standings: [{rank: 1, adjustedTimeMs: 40_000, isCurrentPlayer: true}],
          currentPlayer: {rank: 1, adjustedTimeMs: 40_000, isCurrentPlayer: true},
        },
      });
    if (path === "/api/game/tournament.record")
      return reply({
        ok: true,
        result: {
          tournamentId: "reddit-race10-ja-2026-08-20",
          locale: "ja",
          runId: "run-1",
          adjustedTimeMs: 40_000,
          completedAtMs: 50_000,
          improved: true,
          sortOrder: "LOWER_IS_BETTER",
          rewardsEnabled: false,
        },
      });
    throw new Error(`unexpected path ${path} ${String(init?.method)}`);
  }) as typeof fetch;
  /** Provides result behavior. */
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
    status: "success",
    value: {providerReceiptId: "order-1"},
  });
  expect(purchase).toHaveBeenCalledWith("riddle_quest_coins_250", {"riddle-account": "R".repeat(43)});
  await expect(result.value.capabilities.commerce?.recover()).resolves.toEqual({status: "success", value: undefined});
  await expect(result.value.capabilities.matchmaking?.find("ja")).resolves.toMatchObject({
    status: "success",
    value: {status: "matched", challenge: {challengeId: "challenge-1", locale: "ja"}},
  });
  await expect(result.value.capabilities.tournaments?.list("ja")).resolves.toMatchObject({
    tournamentId: "reddit-race10-ja-2026-08-20",
    rewardsEnabled: false,
    standings: [{rank: 1, isCurrentPlayer: true}],
  });
  await expect(result.value.capabilities.tournaments?.record("run-1", "ja")).resolves.toMatchObject({
    runId: "run-1",
    adjustedTimeMs: 40_000,
    rewardsEnabled: false,
  });
  await expect(result.value.storage.readPreferences()).resolves.toEqual({locale: "ja"});
  await result.value.storage.writePreferences({locale: "ja", reducedMotion: true});
  expect(global.fetch).toHaveBeenCalledWith(
    "/api/storage/write",
    expect.objectContaining({
      method: "POST",
      body: JSON.stringify({preferences: {locale: "ja", reducedMotion: true}}),
    }),
  );
  expect([...((global.fetch as jest.Mock).mock.calls as [string][])].every(([path]) => path.startsWith("/api/"))).toBe(
    true,
  );
});

it("omits matchmaking when its independent server capability is disabled", async () => {
  global.fetch = jest.fn((input) => {
    /** Provides path behavior. */
    const path = String(input);
    if (path === "/api/session")
      return reply({
        ok: true,
        authenticated: true,
        accountGeneration: 1,
        features: {...enabledFeatures, matchmaking: false},
      });
    if (path === "/api/storage/read") return reply({ok: true, preferences: {}, playerData: null});
    throw new Error(`unexpected path ${path}`);
  }) as typeof fetch;
  /** Provides result behavior. */
  const result = await new RedditPlatformBootstrap().initialize(() => undefined);
  expect(result.status).toBe("success");
  if (result.status === "success") expect(result.value.capabilities.matchmaking).toBeUndefined();
});

it("omits tournaments when its independent server capability is disabled", async () => {
  global.fetch = jest.fn((input) => {
    /** Provides path behavior. */
    const path = String(input);
    if (path === "/api/session")
      return reply({
        ok: true,
        authenticated: true,
        accountGeneration: 1,
        features: {...enabledFeatures, tournaments: false},
      });
    if (path === "/api/storage/read") return reply({ok: true, preferences: {}, playerData: null});
    throw new Error(`unexpected path ${path}`);
  }) as typeof fetch;
  /** Provides result behavior. */
  const result = await new RedditPlatformBootstrap().initialize(() => undefined);
  expect(result.status).toBe("success");
  if (result.status === "success") expect(result.value.capabilities.tournaments).toBeUndefined();
});

it("omits commerce when its independent approval capability is disabled", async () => {
  global.fetch = jest.fn((input) => {
    /** Provides path behavior. */
    const path = String(input);
    if (path === "/api/session")
      return reply({
        ok: true,
        authenticated: true,
        accountGeneration: 1,
        features: {...enabledFeatures, commerce: false},
      });
    if (path === "/api/storage/read") return reply({ok: true, preferences: {}, playerData: null});
    throw new Error(`unexpected path ${path}`);
  }) as typeof fetch;
  /** Provides result behavior. */
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

it("aborts Reddit gateway requests that exceed their deadline", async () => {
  jest.useFakeTimers();
  global.fetch = jest.fn(
    (_input, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
      }),
  );

  /** Provides pending behavior. */
  const pending = postRedditGateway("/api/session");
  /** Provides rejection behavior. */
  const rejection = expect(pending).rejects.toThrow("reddit-gateway-request-timed-out");
  await jest.advanceTimersByTimeAsync(REDDIT_GATEWAY_REQUEST_TIMEOUT_MS);

  await rejection;
  expect(((global.fetch as jest.Mock).mock.calls[0]?.[1] as RequestInit).signal?.aborted).toBe(true);
});

it("falls back to isolated guest play when Reddit gameplay is emergency-disabled", async () => {
  global.fetch = jest.fn(() =>
    reply({
      ok: true,
      authenticated: true,
      features: {...enabledFeatures, gameplay: false},
    }),
  );
  /** Provides result behavior. */
  const result = await new RedditPlatformBootstrap().initialize(() => undefined);
  expect(result.status).toBe("success");
  if (result.status !== "success") return;
  expect(result.value.playerId).toBe("reddit-guest");
  expect(global.fetch).toHaveBeenCalledTimes(1);
});

it("fails closed to guest play for malformed authenticated feature configuration", async () => {
  global.fetch = jest.fn(() => reply({ok: true, authenticated: true, features: {gameplay: true}}));
  /** Provides result behavior. */
  const result = await new RedditPlatformBootstrap().initialize(() => undefined);
  expect(result.status).toBe("success");
  if (result.status !== "success") return;
  expect(result.value.playerId).toBe("reddit-guest");
});

it("migrates only safe guest preferences after login and discards forged player state", async () => {
  window.localStorage.setItem(
    "riddleQuestRedditGuestV1",
    JSON.stringify({
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
    }),
  );
  global.fetch = jest.fn((input) => {
    /** Provides path behavior. */
    const path = String(input);
    if (path === "/api/session")
      return reply({ok: true, authenticated: true, accountGeneration: 1, features: enabledFeatures});
    if (path === "/api/storage/read")
      return reply({
        ok: true,
        preferences: {locale: "ja", highContrast: true},
        playerData: null,
      });
    if (path === "/api/storage/write") return reply({ok: true, written: true});
    throw new Error(`unexpected path ${path}`);
  }) as typeof fetch;

  /** Provides result behavior. */
  const result = await new RedditPlatformBootstrap().initialize(() => undefined);
  expect(result.status).toBe("success");
  if (result.status === "success")
    expect(result.value.initialPreferences).toEqual({
      locale: "ja",
      muted: true,
      onboardingComplete: true,
      highContrast: true,
    });
  expect(global.fetch).toHaveBeenCalledWith(
    "/api/storage/write",
    expect.objectContaining({
      body: JSON.stringify({
        preferences: {
          locale: "ja",
          muted: true,
          onboardingComplete: true,
          highContrast: true,
        },
      }),
    }),
  );
  expect(window.localStorage.getItem("riddleQuestRedditGuestV1")).toBeNull();
  expect(JSON.stringify((global.fetch as jest.Mock).mock.calls)).not.toContain("99_999");
  expect(JSON.stringify((global.fetch as jest.Mock).mock.calls)).not.toContain("firstMilestoneMarked");
  expect(JSON.stringify((global.fetch as jest.Mock).mock.calls)).not.toContain("presenceEnabled");
});

it("retains guest state when the authenticated migration cannot be acknowledged", async () => {
  window.localStorage.setItem("riddleQuestRedditGuestV1", JSON.stringify({preferences: {locale: "de"}}));
  global.fetch = jest.fn((input) => {
    /** Provides path behavior. */
    const path = String(input);
    if (path === "/api/session")
      return reply({ok: true, authenticated: true, accountGeneration: 1, features: enabledFeatures});
    if (path === "/api/storage/read") return reply({ok: true, preferences: {}, playerData: null});
    return reply({ok: false, error: "unavailable"}, false);
  }) as typeof fetch;

  /** Provides result behavior. */
  const result = await new RedditPlatformBootstrap().initialize(() => undefined);
  expect(result).toEqual({status: "retryable-failure", message: "reddit-gateway-request-failed"});
  expect(window.localStorage.getItem("riddleQuestRedditGuestV1")).not.toBeNull();
});

it("excludes account, economy, notification, and presence fields from guest migration", () => {
  expect(
    selectMigratableGuestPreferences({
      locale: "fr",
      registrationPromptDismissedAt: 1,
      firstMilestoneMarked: true,
      presenceEnabled: true,
      facebookNotificationPermission: "accepted",
      facebookNotificationLastPromptAtMs: 2,
    }),
  ).toEqual({locale: "fr"});
});

it("maps browser visibility to pause/resume and unregisters lifecycle listeners", async () => {
  global.fetch = jest.fn(() => reply({ok: true, authenticated: false}));
  /** Provides result behavior. */
  const result = await new RedditPlatformBootstrap().initialize(() => undefined);
  expect(result.status).toBe("success");
  if (result.status !== "success") return;
  /** Provides pause behavior. */
  const pause = jest.fn();
  /** Provides resume behavior. */
  const resume = jest.fn();
  /** Removes pause. */
  const removePause = result.value.capabilities.lifecycle?.onPause(pause);
  /** Removes resume. */
  const removeResume = result.value.capabilities.lifecycle?.onResume(resume);
  /** Lists eners. */
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
  /** Provides first behavior. */
  const first = await new RedditPlatformBootstrap().initialize(() => undefined);
  expect(first.status).toBe("success");
  if (first.status !== "success") return;
  await first.value.storage.writePlayerData({
    schemaVersion: 1,
    updatedAt: 10,
    profile: {
      username: "Guest Solver",
      coins: 0,
      level: 1,
      xp: 0,
      winStreak: 0,
      gamesPlayed: 2,
      wins: 1,
      achievements: [],
      classicIndex: 2,
    },
    activeGame: null,
  });
  /** Provides reloaded behavior. */
  const reloaded = await new RedditPlatformBootstrap().initialize(() => undefined);
  expect(reloaded.status).toBe("success");
  if (reloaded.status !== "success") return;
  await expect(reloaded.value.storage.readPlayerData()).resolves.toMatchObject({
    schemaVersion: 1,
    profile: {coins: 0, xp: 0, gamesPlayed: 2, wins: 1, classicIndex: 2},
    activeGame: null,
  });
});
it("preserves newer unsaved guest fields while an older stored record remains readable", async () => {
  global.fetch = jest.fn(() => reply({ok: true, authenticated: false}));
  /** Public guest bootstrap supplies the actual local adapter. */
  const result = await new RedditPlatformBootstrap().initialize(() => undefined);
  if (result.status !== "success") throw new Error("guest-startup-failed");
  /** Older acknowledged progress remains readable during the injected quota failure. */
  const oldProfile = {username: "Guest Solver", coins: 0, level: 1, xp: 0, winStreak: 0,
    gamesPlayed: 1, wins: 0, achievements: [], classicIndex: 1};
  await result.value.storage.writePreferences({locale: "en", muted: false});
  await result.value.storage.writePlayerData({schemaVersion: 1, updatedAt: 1, profile: oldProfile, activeGame: null});
  /** Writes fail independently of reads, reproducing a full localStorage quota. */
  const blockedWrite = jest.spyOn(localStorage, "setItem").mockImplementation(() => {throw new DOMException("Quota full", "QuotaExceededError");});
  /** Accepted new progress must not be overwritten by the older durable snapshot. */
  const next = {schemaVersion: 1 as const, updatedAt: 2, profile: {...oldProfile, gamesPlayed: 2, wins: 1, classicIndex: 2}, activeGame: null};
  await result.value.storage.writePlayerData(next).catch(() => undefined);
  await result.value.storage.writePreferences({locale: "ar", muted: true}).catch(() => undefined);
  await expect(result.value.storage.readPlayerData()).resolves.toMatchObject({profile: {classicIndex: 2, gamesPlayed: 2, wins: 1}});
  await expect(result.value.storage.readPreferences()).resolves.toEqual({locale: "ar", muted: true});
  expect(JSON.parse(values.get("riddleQuestRedditGuestV1")!).playerData.profile.classicIndex).toBe(1);
  blockedWrite.mockRestore();
  await result.value.storage.writePreferences({locale: "ar", muted: true});
  /** A new adapter sees only the complete successfully recovered local record. */
  const reloaded = await new RedditPlatformBootstrap().initialize(() => undefined);
  if (reloaded.status !== "success") throw new Error("guest-reload-failed");
  await expect(reloaded.value.storage.readPlayerData()).resolves.toMatchObject({profile: {classicIndex: 2, gamesPlayed: 2, wins: 1}});
  await expect(reloaded.value.storage.readPreferences()).resolves.toEqual({locale: "ar", muted: true});
});

it("does not revive an older guest record after best-effort cleanup cannot remove it", async () => {
  global.fetch = jest.fn(() => reply({ok: true, authenticated: false}));
  /** The public adapter owns local guest storage, including login cleanup. */
  const result = await new RedditPlatformBootstrap().initialize(() => undefined);
  if (result.status !== "success") throw new Error("guest-startup-failed");
  await result.value.storage.writePreferences({locale: "ar", muted: true});
  /** Browser policy may reject removals while still exposing the older record to reads. */
  const blockedRemoval = jest.spyOn(localStorage, "removeItem").mockImplementation(() => {throw new DOMException("Storage blocked", "SecurityError");});
  await expect(result.value.storage.clear()).resolves.toBeUndefined();
  expect(JSON.parse(values.get("riddleQuestRedditGuestV1")!).preferences.locale).toBe("ar");
  await expect(result.value.storage.readPreferences()).resolves.toEqual({});
  await expect(result.value.storage.readPlayerData()).resolves.toBeNull();
  blockedRemoval.mockRestore();
  await result.value.storage.writePreferences({locale: "en"});
  expect(JSON.parse(values.get("riddleQuestRedditGuestV1")!)).toEqual({preferences: {locale: "en"}, playerData: null});
});
