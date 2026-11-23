import {JestSdkPlatform} from "../JestSdkPlatform";
import {configureBrowserErrorReporter, resetBrowserErrorReporterForTests} from "../../../../../packages/web-game/src/observability/browserErrorReporter";

import type {BridgeProfile} from "@riddle-quest/core/bridge";

/** Completes profile. */
const completeProfile: BridgeProfile = {
  username: "Nova",
  coins: 425,
  level: 6,
  xp: 740,
  winStreak: 4,
  gamesPlayed: 12,
  wins: 8,
  achievements: ["first_win", "wins_5"],
  classicIndex: 9,
  dailyChallengeIndex: 3,
  dailyChallengeCurrentQuestion: 2,
  dailyPuzzlesCompleted: 5,
  bestStreak: 7,
  totalWordsGuessed: 51,
  winRate: 66.7,
  averageGuesses: 3.2,
  totalScore: 1400,
  highestLevelClassic: 9,
  challengeWins: 3,
  totalWins: 8,
  totalGuessesInWins: 26,
  totalHintsUsed: 2,
};

/** Provides sdk behavior. */
const sdk = () => ({
  init: jest.fn().mockResolvedValue(undefined),
  getPlayer: jest.fn(() => ({playerId: "p1", registered: false})),
  getPlayerSigned: jest.fn(),
  login: jest.fn().mockResolvedValue(undefined),
  getEntryPayload: jest.fn(() => ({gameMode: "classic"})),
  showRegistrationOverlay: jest.fn((options) => ({
    loginButtonAction: jest.fn(),
    closeButtonAction: () => options.onClose(),
  })),
  data: {
    getAll: jest.fn(() => ({locale: "en", coins: 999})),
    set: jest.fn(),
    delete: jest.fn(),
    flush: jest.fn().mockResolvedValue(undefined),
  },
  notifications: {scheduleNotification: jest.fn(), unscheduleNotification: jest.fn()},
  social: {getProfile: jest.fn(() => null), setScreenshotProvider: jest.fn()},
  referrals: {shareReferralLink: jest.fn(), listReferrals: jest.fn()},
  captureEvent: jest.fn(),
  payments: {
    getProducts: jest.fn(),
    beginPurchase: jest.fn(),
    getIncompletePurchases: jest.fn(),
    completePurchase: jest.fn(),
    getSubscriptions: jest.fn(),
    beginSubscription: jest.fn(),
    cancelSubscription: jest.fn(),
  },
  markFirstMilestone: jest.fn(),
  setLoadingProgress: jest.fn(),
  markGameLoaded: jest.fn(),
});

/** Saves d game. */
const savedGame = {
  schemaVersion: 1,
  savedAt: 10,
  riddleId: "riddle-1",
  sessionToken: "00000000-0000-4000-8000-000000000001",
  gameMode: "classic",
  currentLetters: ["A", ""],
  activeSlotIndex: 1,
  hintRevealedIndices: [0],
  guesses: [],
  engineSnapshot: {guesses: [], attemptsUsed: 0, hasUsedContinue: false, gameOver: false},
  awaitingContinue: false,
  letterStates: {},
};

it("stores only low-integrity preferences", () =>
  expect(new JestSdkPlatform(sdk()).readPreferences()).toEqual({
    locale: "en",
    muted: undefined,
    reducedMotion: undefined,
    highContrast: undefined,
    presenceEnabled: undefined,
    onboardingComplete: undefined,
    registrationPromptDismissedAt: undefined,
    firstMilestoneMarked: undefined,
  }));
it.each([
  {state: "a new guest store", values: {}},
  {state: "a cleared guest snapshot", values: {riddleQuestPlayerState: null}},
  {state: "an unset guest snapshot", values: {riddleQuestPlayerState: undefined}},
])("returns no saved progress for $state", async ({values}) => {
  /** Provider-owned storage can be empty before play or after clearing progress. */
  const mock = sdk();
  mock.data.getAll.mockReturnValue(values);

  await expect(new JestSdkPlatform(mock).readPlayerData()).resolves.toBeNull();
});
it("loads a versioned player snapshot from the Jest player store", async () => {
  /** Provides mock behavior. */
  const mock = sdk();
  mock.getPlayer.mockReturnValue({playerId: "p1", registered: true});
  /** Provides active game behavior. */
  const activeGame = {
    schemaVersion: 1,
    savedAt: 10,
    riddleId: "riddle-1",
    sessionToken: "00000000-0000-4000-8000-000000000001",
    gameMode: "classic",
    currentLetters: ["A", ""],
    activeSlotIndex: 1,
    hintRevealedIndices: [0],
    guesses: [],
    engineSnapshot: {guesses: [], attemptsUsed: 0, hasUsedContinue: false, gameOver: false},
    awaitingContinue: false,
    letterStates: {},
  };
  mock.data.getAll.mockReturnValue({
    riddleQuestPlayerState: {
      schemaVersion: 1,
      updatedAt: 11,
      profile: completeProfile,
      activeGame,
    },
  });

  expect(await new JestSdkPlatform(mock).readPlayerData()).toEqual({
    schemaVersion: 1,
    updatedAt: 11,
    profile: completeProfile,
    activeGame,
  });
});
it("discards an incomplete Jest profile instead of restoring partial statistics", async () => {
  /** Provides mock behavior. */
  const mock = sdk();
  mock.getPlayer.mockReturnValue({playerId: "p1", registered: true});
  mock.data.getAll.mockReturnValue({
    riddleQuestPlayerState: {
      schemaVersion: 1,
      updatedAt: 11,
      profile: {username: "Partial", coins: 10},
    },
  });

  expect(await new JestSdkPlatform(mock).readPlayerData()).toEqual({
    schemaVersion: 1,
    updatedAt: 11,
  });
});
it("wires the custom registration overlay actions and options", () => {
  /** Provides mock behavior. */
  const mock = sdk();
  /** Provides on close behavior. */
  const onClose = jest.fn();
  /** Provides result behavior. */
  const result = new JestSdkPlatform(mock).showRegistrationOverlay({
    theme: "dark",
    message: "Keep my Riddle Quest progress! {{registrationCode}} is my registration code.",
    entryPayload: {source: "post_instructions"},
    onClose,
  });

  expect(mock.showRegistrationOverlay).toHaveBeenCalledWith({
    theme: "dark",
    message: "Keep my Riddle Quest progress! {{registrationCode}} is my registration code.",
    entryPayload: {source: "post_instructions"},
    onClose,
  });
  expect(result.status).toBe("success");
  if (result.status !== "success") return;
  result.value.closeButtonAction();
  expect(onClose).toHaveBeenCalledTimes(1);
});
it("passes entry attribution to guest login and skips the dialog for registered players", async () => {
  /** Provides guest sdk behavior. */
  const guestSdk = sdk();
  guestSdk.getPlayer
    .mockReturnValueOnce({playerId: "p1", registered: false})
    .mockReturnValue({playerId: "p1", registered: true});
  /** Provides guest result behavior. */
  const guestResult = await new JestSdkPlatform(guestSdk).login({source: "authoritative_win"});
  expect(guestSdk.login).toHaveBeenCalledWith({entryPayload: {source: "authoritative_win"}});
  expect(guestResult).toEqual({status: "success", value: {playerId: "p1", registered: true}});

  /** Provides registered sdk behavior. */
  const registeredSdk = sdk();
  registeredSdk.getPlayer.mockReturnValue({playerId: "p1", registered: true});
  /** Provides registered result behavior. */
  const registeredResult = await new JestSdkPlatform(registeredSdk).login({source: "post_instructions"});
  expect(registeredSdk.login).not.toHaveBeenCalled();
  expect(registeredResult).toEqual({status: "success", value: {playerId: "p1", registered: true}});
});
it("rejects unknown player snapshot versions", async () => {
  /** Provides mock behavior. */
  const mock = sdk();
  mock.getPlayer.mockReturnValue({playerId: "p1", registered: true});
  mock.data.getAll.mockReturnValue({
    riddleQuestPlayerState: {schemaVersion: 2, updatedAt: 11},
  });
  expect(await new JestSdkPlatform(mock).readPlayerData()).toBeNull();
});
it.each([Number.NaN, -1, 1.5, Number.MAX_SAFE_INTEGER + 1])(
  "rejects an invalid player snapshot timestamp (%s)",
  async (updatedAt) => {
    /** Provides mock behavior. */
    const mock = sdk();
    mock.data.getAll.mockReturnValue({riddleQuestPlayerState: {schemaVersion: 1, updatedAt}});
    expect(await new JestSdkPlatform(mock).readPlayerData()).toBeNull();
  },
);
it("flushes player snapshot writes to Jest", async () => {
  /** Provides mock behavior. */
  const mock = sdk();
  mock.getPlayer.mockReturnValue({playerId: "p1", registered: true});
  /** Provides player data behavior. */
  const playerData = {schemaVersion: 1 as const, updatedAt: 11, profile: completeProfile};
  await new JestSdkPlatform(mock).writePlayerData(playerData);
  expect(mock.data.set).toHaveBeenCalledWith("riddleQuestPlayerState", playerData);
  expect(mock.data.flush).toHaveBeenCalledTimes(1);
});
it("preserves player snapshots for guests using their stable Jest player store", async () => {
  /** Provides mock behavior. */
  const mock = sdk();
  /** Provides platform behavior. */
  const platform = new JestSdkPlatform(mock);
  /** Provides player data behavior. */
  const playerData = {schemaVersion: 1 as const, updatedAt: 11};
  mock.data.getAll.mockReturnValue({riddleQuestPlayerState: playerData});

  expect(await platform.readPlayerData()).toEqual(playerData);
  await platform.writePlayerData(playerData);

  expect(mock.data.set).toHaveBeenCalledWith("riddleQuestPlayerState", playerData);
  expect(mock.data.flush).toHaveBeenCalledTimes(1);
});
it("does not schedule or remove notifications for guests", async () => {
  /** Provides platform behavior. */
  const platform = new JestSdkPlatform(sdk());
  await expect(
    platform.scheduleNotification({
      identifier: "daily",
      scheduledInDays: 1,
      body: "Play",
      ctaText: "Open",
    }),
  ).resolves.toEqual({status: "unavailable", message: "Registration is required"});
  await expect(platform.removeNotification("daily")).resolves.toEqual({
    status: "unavailable",
    message: "Registration is required",
  });
});
it("treats invalid notification arguments as terminal", async () => {
  /** Provides mock behavior. */
  const mock = sdk();
  mock.getPlayer.mockReturnValue({playerId: "p1", registered: true});
  mock.notifications.scheduleNotification.mockRejectedValue(new Error("INVALID_ARGUMENTS"));
  await expect(
    new JestSdkPlatform(mock).scheduleNotification({
      identifier: "daily",
      scheduledInDays: 1,
      body: "Play",
      ctaText: "Open",
    }),
  ).resolves.toEqual({status: "terminal-failure", message: "INVALID_ARGUMENTS"});
});
it.each(["png", "jpeg", "webp"])("forwards inline %s notifications through the registered SDK adapter", async (format) => {
  /** Registered SDK fixture records provider dispatches. */
  const mock = sdk();
  mock.getPlayer.mockReturnValue({playerId: "p1", registered: true});
  /** Payload under test at the runtime adapter boundary. */
  const input = {identifier: "daily", scheduledInDays: 1, body: "Play", ctaText: "Open", asset: `data:image/${format};base64,YQ==`};
  await expect(new JestSdkPlatform(mock).scheduleNotification(input)).resolves.toEqual({status: "success", value: undefined});
  expect(mock.notifications.scheduleNotification).toHaveBeenCalledWith(input);
});
it.each(["https://example.com/card.png", `https://example.com/${"x".repeat(2048 - "https://example.com/".length)}`])("forwards HTTPS notification assets through the registered SDK adapter", async (asset) => {
  /** Registered SDK fixture records provider dispatches. */
  const mock = sdk();
  mock.getPlayer.mockReturnValue({playerId: "p1", registered: true});
  /** Payload under test at the runtime adapter boundary. */
  const input = {identifier: "daily", scheduledInDays: 1, body: "Play", ctaText: "Open", asset};
  await expect(new JestSdkPlatform(mock).scheduleNotification(input)).resolves.toEqual({status: "success", value: undefined});
  expect(mock.notifications.scheduleNotification).toHaveBeenCalledWith(input);
});
it.each([
  {asset: "data:image/png;base64,YQ==", assetReference: "approved-card"},
  {asset: "data:image/gif;base64,YQ=="},
  {asset: "http://example.com/card.png"},
  {asset: "https://example.com/card image.png"},
  {asset: `https://example.com/${"x".repeat(2049 - "https://example.com/".length)}`},
  {asset: `data:image/png;base64,${Buffer.alloc(2 * 1024 * 1024 + 1).toString("base64")}`},
])("rejects invalid inline notification arguments before SDK dispatch", async (image) => {
  /** Registered SDK fixture records provider dispatches. */
  const mock = sdk();
  mock.getPlayer.mockReturnValue({playerId: "p1", registered: true});
  // Deliberately bypass the compile-time union to verify the runtime boundary too.
  /** Payload under test at the runtime adapter boundary. */
  const input = {identifier: "daily", scheduledInDays: 1, body: "Play", ctaText: "Open", ...image};
  await expect(new JestSdkPlatform(mock).scheduleNotification(input as never)).resolves.toMatchObject({status: "terminal-failure"});
  expect(mock.notifications.scheduleNotification).not.toHaveBeenCalled();
});
it("distinguishes purchase cancellation", async () => {
  /** Provides mock behavior. */
  const mock = sdk();
  mock.payments.beginPurchase.mockResolvedValue({result: "cancel"});
  expect(await new JestSdkPlatform(mock).beginPurchase("coins")).toEqual({status: "cancelled"});
});
it("treats invalid products and tokens as terminal", async () => {
  /** Provides mock behavior. */
  const mock = sdk();
  mock.payments.beginPurchase.mockResolvedValue({result: "error", error: "invalid_product"});
  mock.payments.completePurchase.mockResolvedValue({result: "error", error: "invalid_token"});
  expect(await new JestSdkPlatform(mock).beginPurchase("bad")).toEqual({
    status: "terminal-failure",
    message: "invalid_product",
  });
  expect(await new JestSdkPlatform(mock).completePurchase("bad")).toEqual({
    status: "terminal-failure",
    message: "invalid_token",
  });
});
it("normalizes subscription catalogs and successful checkout", async () => {
  /** Provides mock behavior. */
  const mock = sdk();
  /** Provides subscription behavior. */
  const subscription = {
    sku: "premium",
    displayName: "Premium",
    displayDescription: null,
    price: 4.99,
    currency: "USD",
    billingPeriod: "monthly",
    status: "inactive",
  };
  mock.payments.getSubscriptions.mockResolvedValue({
    subscriptions: [subscription],
    signed: "catalog.signed",
  });
  mock.payments.beginSubscription.mockResolvedValue({
    result: "success",
    subscription: {...subscription, status: "active"},
    subscriptionSigned: "subscription.signed",
  });
  /** Provides platform behavior. */
  const platform = new JestSdkPlatform(mock);
  expect(await platform.getSubscriptions()).toEqual({
    status: "success",
    value: {subscriptions: [subscription], subscriptionsSigned: "catalog.signed"},
  });
  expect(await platform.beginSubscription("premium")).toEqual({
    status: "success",
    value: {
      subscription: {...subscription, status: "active"},
      subscriptionSigned: "subscription.signed",
    },
  });
  expect(mock.payments.beginSubscription).toHaveBeenCalledWith({subscriptionSku: "premium"});
});
it("maps subscription cancellation and non-retryable errors", async () => {
  /** Provides mock behavior. */
  const mock = sdk();
  mock.payments.beginSubscription
    .mockResolvedValueOnce({result: "cancel"})
    .mockResolvedValueOnce({result: "error", error: "invalid_subscription"})
    .mockResolvedValueOnce({result: "error", error: "guest_not_allowed"})
    .mockResolvedValueOnce({result: "error", error: "already_subscribed"});
  /** Provides platform behavior. */
  const platform = new JestSdkPlatform(mock);
  expect(await platform.beginSubscription("premium")).toEqual({status: "cancelled"});
  expect(await platform.beginSubscription("premium")).toEqual({
    status: "terminal-failure",
    message: "invalid_subscription",
  });
  expect(await platform.beginSubscription("premium")).toEqual({
    status: "unavailable",
    message: "guest_not_allowed",
  });
  expect(await platform.beginSubscription("premium")).toEqual({
    status: "unavailable",
    message: "already_subscribed",
  });
});
it("handles registered notifications, nullable profiles and referral cancellation", async () => {
  /** Provides mock behavior. */
  const mock = sdk();
  mock.getPlayer.mockReturnValue({playerId: "p1", registered: true});
  mock.referrals.shareReferralLink.mockResolvedValue({canceled: true});
  expect(await new JestSdkPlatform(mock).getProfile()).toBeNull();
  expect(
    await new JestSdkPlatform(mock).scheduleNotification({
      identifier: "daily",
      scheduledInDays: 1,
      body: "Play",
      ctaText: "Open",
    }),
  ).toEqual({status: "success", value: undefined});
  expect(
    await new JestSdkPlatform(mock).shareReferral({
      reference: "campaign",
      shareTitle: "Challenge",
      shareText: "Can you beat me?",
      shareImage: "data:image/png;base64,YQ==",
      entryPayload: {gameMode: "classic"},
    }),
  ).toEqual({status: "cancelled"});
  expect(mock.referrals.shareReferralLink).toHaveBeenCalledWith({
    reference: "campaign",
    shareTitle: "Challenge",
    shareText: "Can you beat me?",
    shareImage: "data:image/png;base64,YQ==",
    entryPayload: {gameMode: "classic"},
  });
});
it("maps thrown timeouts to retryable failures", async () => {
  /** Provides mock behavior. */
  const mock = sdk();
  mock.payments.beginPurchase.mockRejectedValue(new Error("timeout"));
  expect(await new JestSdkPlatform(mock).beginPurchase("coins")).toEqual({
    status: "retryable-failure",
    message: "timeout",
  });
});

it("forwards acquisition events to Jest analytics", () => {
  /** Provides mock behavior. */
  const mock = sdk();
  new JestSdkPlatform(mock).captureEvent("registration_prompt_shown", {utmCampaign: "launch"});
  expect(mock.captureEvent).toHaveBeenCalledWith("registration_prompt_shown", {utmCampaign: "launch"});
});

it("uses the global SDK by default and initializes it safely", async () => {
  /** Provides original behavior. */
  const original = (
    globalThis as typeof globalThis & {
      /** Stores jest sdk. */
      JestSDK?: unknown;
    }
  ).JestSDK;
  /** Provides mock behavior. */
  const mock = sdk();
  (
    globalThis as typeof globalThis & {
      /** Stores jest sdk. */
      JestSDK?: unknown;
    }
  ).JestSDK = mock;

  /** Provides platform behavior. */
  const platform = new JestSdkPlatform();
  await expect(platform.init()).resolves.toEqual({status: "success", value: undefined});
  expect(mock.init).toHaveBeenCalledWith({autoLoginReminders: false});
  expect(platform.getPlayer()).toEqual({playerId: "p1", registered: false});
  platform.getPlayerSigned();
  expect(mock.getPlayerSigned).toHaveBeenCalled();

  (
    globalThis as typeof globalThis & {
      /** Stores jest sdk. */
      JestSDK?: unknown;
    }
  ).JestSDK = original;
});

it("resolves the global SDK lazily when it appears after construction", async () => {
  /** Provides target behavior. */
  const target = globalThis as typeof globalThis & {
    /** Stores jest sdk. */
    JestSDK?: unknown;
  };
  /** Provides original behavior. */
  const original = target.JestSDK;
  /** Provides mock behavior. */
  const mock = sdk();
  delete target.JestSDK;
  /** Provides platform behavior. */
  const platform = new JestSdkPlatform();
  target.JestSDK = mock;

  await expect(platform.init()).resolves.toEqual({status: "success", value: undefined});
  expect(mock.init).toHaveBeenCalledWith({autoLoginReminders: false});
  target.JestSDK = original;
});

it("waits for a delayed global SDK and contains a load timeout", async () => {
  /** Provides target behavior. */
  const target = globalThis as typeof globalThis & {
    /** Stores jest sdk. */
    JestSDK?: unknown;
  };
  /** Provides original behavior. */
  const original = target.JestSDK;
  /** Provides mock behavior. */
  const mock = sdk();
  delete target.JestSDK;
  /** Provides delayed platform behavior. */
  const delayedPlatform = new JestSdkPlatform(undefined, 30_000, 100);
  setTimeout(() => {
    target.JestSDK = mock;
  }, 0);

  await expect(delayedPlatform.init()).resolves.toEqual({status: "success", value: undefined});
  delete target.JestSDK;
  await expect(new JestSdkPlatform(undefined, 30_000, 0).init()).resolves.toEqual({
    status: "retryable-failure",
    message: "Jest SDK failed to load.",
  });
  target.JestSDK = original;
});

it("maps initialization and login failures", async () => {
  /** Provides mock behavior. */
  const mock = sdk();
  mock.init.mockRejectedValue("offline");
  mock.login.mockRejectedValue(new Error("BAD_REQUEST"));
  /** Provides platform behavior. */
  const platform = new JestSdkPlatform(mock);

  await expect(platform.init()).resolves.toEqual({status: "retryable-failure", message: "offline"});
  await expect(platform.login()).resolves.toEqual({status: "terminal-failure", message: "BAD_REQUEST"});
  expect(mock.login).toHaveBeenCalledWith(undefined);
});

it("runs both registration overlay actions and contains overlay errors", () => {
  /** Provides mock behavior. */
  const mock = sdk();
  /** Provides login button action behavior. */
  const loginButtonAction = jest.fn();
  /** Provides close button action behavior. */
  const closeButtonAction = jest.fn();
  mock.showRegistrationOverlay.mockReturnValue({loginButtonAction, closeButtonAction});
  /** Provides platform behavior. */
  const platform = new JestSdkPlatform(mock);
  /** Provides result behavior. */
  const result = platform.showRegistrationOverlay({
    theme: "dark",
    message: "Keep my Riddle Quest progress! {{registrationCode}} is my registration code.",
    onClose: jest.fn(),
  });
  expect(result.status).toBe("success");
  if (result.status === "success") {
    result.value.loginButtonAction();
    result.value.closeButtonAction();
  }
  expect(loginButtonAction).toHaveBeenCalled();
  expect(closeButtonAction).toHaveBeenCalled();

  mock.showRegistrationOverlay.mockImplementation(() => {
    throw new Error("overlay unavailable");
  });
  expect(
    platform.showRegistrationOverlay({
      theme: "dark",
      message: "Keep my Riddle Quest progress! {{registrationCode}} is my registration code.",
      onClose: jest.fn(),
    }),
  ).toEqual({
    status: "retryable-failure",
    message: "overlay unavailable",
  });
});

it("round-trips every supported preference", async () => {
  /** Provides mock behavior. */
  const mock = sdk();
  /** Provides preferences behavior. */
  const preferences = {
    locale: "fr",
    muted: true,
    reducedMotion: false,
    highContrast: true,
    presenceEnabled: true,
    onboardingComplete: true,
    registrationPromptDismissedAt: 123,
    firstMilestoneMarked: false,
    jestGuestCompletedRiddles: 4,
  };
  mock.data.getAll.mockReturnValue(preferences);
  /** Provides platform behavior. */
  const platform = new JestSdkPlatform(mock);
  expect(platform.readPreferences()).toEqual(preferences);
  await platform.writePreferences(preferences);
  expect(mock.data.set).toHaveBeenCalledWith(preferences);
  expect(mock.data.flush).toHaveBeenCalled();
});

it("deletes every client-writable key and flushes once after authoritative account deletion", async () => {
  /** Provides mock behavior. */
  const mock = sdk();
  await new JestSdkPlatform(mock).clearPlayerState();

  expect(mock.data.delete.mock.calls.map(([key]) => key)).toEqual([
    "locale",
    "muted",
    "reducedMotion",
    "highContrast",
    "presenceEnabled",
    "onboardingComplete",
    "registrationPromptDismissedAt",
    "firstMilestoneMarked",
    "jestGuestCompletedRiddles",
    "riddleQuestPlayerState",
  ]);
  expect(mock.data.flush).toHaveBeenCalledTimes(1);
});

it("propagates a failed SDK flush so account deletion cannot report false client cleanup", async () => {
  /** Provides mock behavior. */
  const mock = sdk();
  mock.data.flush.mockRejectedValue(new Error("platform data unavailable"));

  await expect(new JestSdkPlatform(mock).clearPlayerState()).rejects.toThrow("platform data unavailable");
});

it.each([
  [],
  {...savedGame, schemaVersion: 2},
  {...savedGame, savedAt: "10"},
  {...savedGame, savedAt: Number.NaN},
  {...savedGame, riddleId: 1},
  {...savedGame, riddleId: "x".repeat(129)},
  {...savedGame, sessionToken: "short"},
  {...savedGame, sessionToken: "x".repeat(129)},
  {...savedGame, gameMode: "race"},
  {...savedGame, currentLetters: "A"},
  {...savedGame, currentLetters: [1]},
  {...savedGame, currentLetters: Array.from({length: 8}, () => "A")},
  {...savedGame, currentLetters: ["x".repeat(17), ""]},
  {...savedGame, activeSlotIndex: "1"},
  {...savedGame, activeSlotIndex: 2},
  {...savedGame, hintRevealedIndices: "0"},
  {...savedGame, hintRevealedIndices: ["0"]},
  {...savedGame, hintRevealedIndices: [0, 0]},
  {...savedGame, hintRevealedIndices: [2]},
  {...savedGame, guesses: null},
  {...savedGame, guesses: Array.from({length: 21}, () => ({guess: ["A", "B"], feedback: ["red", "red"]}))},
  {...savedGame, guesses: [{}]},
  {...savedGame, guesses: [{guess: [1, "B"], feedback: ["red", "red"]}]},
  {...savedGame, guesses: [{guess: ["A", "B"], feedback: ["blue", "red"]}]},
  {...savedGame, guesses: [{guess: ["A"], feedback: ["green"]}]},
  {...savedGame, engineSnapshot: []},
  {...savedGame, engineSnapshot: {guesses: [], attemptsUsed: 7, hasUsedContinue: false, gameOver: false}},
  {...savedGame, awaitingContinue: true},
  {...savedGame, letterStates: null},
  {...savedGame, letterStates: Object.fromEntries(Array.from({length: 65}, (_, index) => [`K${index}`, "red"]))},
  {...savedGame, letterStates: {A: "blue"}},
  {...savedGame, pendingOutcome: []},
  {...savedGame, pendingOutcome: {...savedGame, id: "result", kind: "draw", attempts: 1, isCorrect: false}},
  {...savedGame, pendingOutcome: {...savedGame, id: "result", kind: "win", attempts: 1, isCorrect: false}},
])("discards malformed active-game snapshots", async (activeGame) => {
  /** Provides mock behavior. */
  const mock = sdk();
  mock.data.getAll.mockReturnValue({riddleQuestPlayerState: {schemaVersion: 1, updatedAt: 11, activeGame}});
  expect(await new JestSdkPlatform(mock).readPlayerData()).toEqual({schemaVersion: 1, updatedAt: 11});
});

it("reconstructs a valid saved game without retaining unknown low-integrity fields", async () => {
  /** Provides mock behavior. */
  const mock = sdk();
  mock.data.getAll.mockReturnValue({
    riddleQuestPlayerState: {
      schemaVersion: 1,
      updatedAt: 11,
      activeGame: {
        ...savedGame,
        ignored: "x".repeat(10_000),
        engineSnapshot: {...savedGame.engineSnapshot, ignored: "x".repeat(10_000)},
      },
    },
  });

  expect(await new JestSdkPlatform(mock).readPlayerData()).toEqual({
    schemaVersion: 1,
    updatedAt: 11,
    activeGame: savedGame,
  });
});

it("restores authoritative-attempt recovery even when visual guess history was not saved", async () => {
  /** Provides mock behavior. */
  const mock = sdk();
  /** Provides awaiting game behavior. */
  const awaitingGame = {
    ...savedGame,
    guesses: [],
    engineSnapshot: {guesses: [], attemptsUsed: 5, hasUsedContinue: false, gameOver: false},
    awaitingContinue: true,
  };
  mock.data.getAll.mockReturnValue({
    riddleQuestPlayerState: {schemaVersion: 1, updatedAt: 11, activeGame: awaitingGame},
  });

  expect(await new JestSdkPlatform(mock).readPlayerData()).toEqual({
    schemaVersion: 1,
    updatedAt: 11,
    activeGame: awaitingGame,
  });
});

it("reconstructs bounded scored guesses and a pending terminal outcome", async () => {
  /** Provides mock behavior. */
  const mock = sdk();
  /** Provides scored guess behavior. */
  const scoredGuess = {guess: ["A", "B"], feedback: ["green", "red"]};
  /** Completes d game. */
  const completedGame = {
    ...savedGame,
    currentLetters: ["A", "B"],
    activeSlotIndex: 0,
    guesses: [scoredGuess],
    engineSnapshot: {
      guesses: [scoredGuess],
      attemptsUsed: 1,
      hasUsedContinue: false,
      gameOver: true,
    },
    letterStates: {A: "green", B: "red"},
    pendingOutcome: {
      id: "riddle-1-win-1",
      kind: "win",
      riddleId: savedGame.riddleId,
      gameMode: savedGame.gameMode,
      sessionToken: savedGame.sessionToken,
      attempts: 1,
      isCorrect: true,
    },
  };
  mock.data.getAll.mockReturnValue({
    riddleQuestPlayerState: {schemaVersion: 1, updatedAt: 11, activeGame: completedGame},
  });

  expect(await new JestSdkPlatform(mock).readPlayerData()).toEqual({
    schemaVersion: 1,
    updatedAt: 11,
    activeGame: completedGame,
  });
});

it("supports explicitly cleared active games and missing SDK data", async () => {
  /** Provides mock behavior. */
  const mock = sdk();
  mock.data.getAll.mockReturnValue({riddleQuestPlayerState: {schemaVersion: 1, updatedAt: 11, activeGame: null}});
  expect(await new JestSdkPlatform(mock).readPlayerData()).toEqual({schemaVersion: 1, updatedAt: 11, activeGame: null});
  expect(new JestSdkPlatform({}).readPreferences()).toEqual({
    locale: undefined,
    muted: undefined,
    reducedMotion: undefined,
    highContrast: undefined,
    presenceEnabled: undefined,
    onboardingComplete: undefined,
    registrationPromptDismissedAt: undefined,
    firstMilestoneMarked: undefined,
  });
  expect(new JestSdkPlatform({}).getEntryIntent()).toEqual({});
});

it("constructs safely when the global SDK is absent", () => {
  /** Provides target behavior. */
  const target = globalThis as typeof globalThis & {
    /** Stores jest sdk. */
    JestSDK?: unknown;
  };
  /** Provides original behavior. */
  const original = target.JestSDK;
  delete target.JestSDK;
  expect(new JestSdkPlatform()).toBeInstanceOf(JestSdkPlatform);
  target.JestSDK = original;
});

it("reads entry intent, configures screenshots, and forwards lifecycle state", () => {
  /** Provides mock behavior. */
  const mock = sdk();
  /** Provides platform behavior. */
  const platform = new JestSdkPlatform(mock);
  expect(platform.getEntryIntent()).toMatchObject({gameMode: "classic"});
  /** Provides provider behavior. */
  const provider = jest.fn();
  platform.setScreenshotProvider(provider);
  platform.setLoadingProgress(72);
  platform.markGameLoaded();
  expect(mock.social.setScreenshotProvider).toHaveBeenCalledWith(provider);
  expect(mock.setLoadingProgress).toHaveBeenCalledWith(72);
  expect(mock.markGameLoaded).toHaveBeenCalled();
});

it("handles registered notification removal and notification failures", async () => {
  /** Provides mock behavior. */
  const mock = sdk();
  mock.getPlayer.mockReturnValue({playerId: "p1", registered: true});
  /** Provides platform behavior. */
  const platform = new JestSdkPlatform(mock);
  await expect(platform.removeNotification("daily")).resolves.toEqual({status: "success", value: undefined});
  expect(mock.notifications.unscheduleNotification).toHaveBeenCalledWith({identifier: "daily"});
  mock.notifications.unscheduleNotification.mockRejectedValue(new Error("timeout"));
  await expect(platform.removeNotification("daily")).resolves.toEqual({
    status: "retryable-failure",
    message: "timeout",
  });
  mock.notifications.scheduleNotification.mockRejectedValue(new Error("timeout"));
  await expect(
    platform.scheduleNotification({identifier: "daily", scheduledInDays: 1, body: "Play", ctaText: "Open"}),
  ).resolves.toEqual({status: "retryable-failure", message: "timeout"});
});

it("handles referrals, product catalogs, and incomplete purchases", async () => {
  /** Provides mock behavior. */
  const mock = sdk();
  /** Provides platform behavior. */
  const platform = new JestSdkPlatform(mock);
  mock.referrals.shareReferralLink.mockResolvedValue({canceled: false});
  mock.referrals.listReferrals.mockResolvedValue({referralsSigned: "signed"});
  mock.payments.getProducts.mockResolvedValue([
    {sku: "coins_small", name: "Small coin pack", description: null, price: 0.99, currency: "USD"},
  ]);
  mock.payments.getIncompletePurchases.mockResolvedValue({purchases: []});
  await expect(platform.shareReferral({reference: "campaign"} as never)).resolves.toEqual({
    status: "success",
    value: undefined,
  });
  await expect(platform.listReferralsSigned()).resolves.toEqual({status: "success", value: "signed"});
  await expect(platform.getProducts()).resolves.toEqual({status: "success", value: [
    {sku: "coins_small", name: "Small coin pack", description: undefined, price: 0.99, currency: "USD"},
  ]});
  await expect(platform.getIncompletePurchases()).resolves.toEqual({status: "success", value: {purchases: []}});

  mock.referrals.shareReferralLink.mockRejectedValue(new Error("offline"));
  mock.referrals.listReferrals.mockRejectedValue(new Error("offline"));
  mock.payments.getProducts.mockRejectedValue(new Error("offline"));
  mock.payments.getIncompletePurchases.mockRejectedValue(new Error("offline"));
  await expect(platform.shareReferral({reference: "campaign"} as never)).resolves.toMatchObject({
    status: "retryable-failure",
  });
  await expect(platform.listReferralsSigned()).resolves.toMatchObject({status: "retryable-failure"});
  await expect(platform.getProducts()).resolves.toMatchObject({status: "retryable-failure"});
  await expect(platform.getIncompletePurchases()).resolves.toMatchObject({status: "retryable-failure"});
});

it.each(["getIncompletePurchases", "completePurchase"] as const)(
  "bounds a permanently pending %s recovery call at 15 seconds",
  async (operation) => {
    jest.useFakeTimers();
    try {
      /** Provides the SDK fixture whose recovery call never settles. */
      const mock = sdk();
      mock.payments[operation].mockImplementation(() => new Promise(() => undefined));
      /** Runs the selected recovery call with bounded provider waits. */
      const platform = new JestSdkPlatform(mock);
      /** Records recovery outcomes to verify the deadline. */
      const settled: unknown[] = [];
      /** Tracks the selected recovery operation through its timeout. */
      const pending = operation === "getIncompletePurchases"
        ? platform.getIncompletePurchases()
        : platform.completePurchase("recoverable-token");
      void pending.then((result) => settled.push(result));

      await jest.advanceTimersByTimeAsync(14_999);
      expect(settled).toEqual([]);
      await jest.advanceTimersByTimeAsync(1);
      expect(settled).toEqual([{
        status: "retryable-failure",
        message: operation === "getIncompletePurchases"
          ? "Jest incomplete purchase read timed out"
          : "Jest purchase completion timed out",
      }]);
      expect(jest.getTimerCount()).toBe(0);
    } finally {
      jest.useRealTimers();
    }
  },
);

it.each([
  ["getIncompletePurchases", "resolve"],
  ["getIncompletePurchases", "reject"],
  ["completePurchase", "resolve"],
  ["completePurchase", "reject"],
] as const)("retires a late %s recovery %s and permits a successful retry", async (operation, settlement) => {
  jest.useFakeTimers();
  try {
    /** Provides the SDK fixture for delayed settlement and a subsequent retry. */
    const mock = sdk();
    /** Resolves the original provider call after its deadline. */
    let resolveProvider!: (value: unknown) => void;
    /** Rejects the original provider call after its deadline. */
    let rejectProvider!: (reason: unknown) => void;
    mock.payments[operation].mockImplementationOnce(() => new Promise((resolve, reject) => {
      resolveProvider = resolve;
      rejectProvider = reject;
    }));
    /** Provides the operation-specific successful response for the retry. */
    const providerSuccess = operation === "getIncompletePurchases"
      ? {purchases: [], purchasesSigned: "signed", hasMore: false}
      : {result: "success"};
    mock.payments[operation].mockResolvedValue(providerSuccess);
    /** Applies recovery deadlines to the delayed SDK fixture. */
    const platform = new JestSdkPlatform(mock);
    /** Repeats the same recovery operation and receipt token. */
    const call = () => operation === "getIncompletePurchases"
      ? platform.getIncompletePurchases()
      : platform.completePurchase("recoverable-token");
    /** Captures the timeout outcome so late provider settlement cannot replace it. */
    const settled: unknown[] = [];
    void call().then((result) => settled.push(result));

    await jest.advanceTimersByTimeAsync(15_000);
    expect(settled).toEqual([expect.objectContaining({status: "retryable-failure"})]);
    if (settlement === "resolve") resolveProvider(providerSuccess);
    else rejectProvider(new Error("late provider failure"));
    await jest.advanceTimersByTimeAsync(0);
    expect(settled).toEqual([expect.objectContaining({status: "retryable-failure"})]);
    await expect(call()).resolves.toEqual({
      status: "success",
      value: operation === "getIncompletePurchases" ? providerSuccess : undefined,
    });
    expect(jest.getTimerCount()).toBe(0);
    expect(mock.payments[operation]).toHaveBeenCalledTimes(2);
  } finally {
    jest.useRealTimers();
  }
});

describe.each<["getProducts" | "getSubscriptions", string, string]>([
  ["getProducts", "Failed to fetch products", "Jest product catalog read timed out"],
  ["getSubscriptions", "Failed to fetch subscriptions", "Jest subscription catalog read timed out"],
])("%s catalog recovery", (operation, providerRejection, timeoutMessage) => {
  it("recovers one provider-negative reply and preserves its successful catalog", async () => {
    /** Receives only unrecovered SDK failures. */
    const report = jest.fn();
    configureBrowserErrorReporter(report);
    try {
      /** Models the parent bridge refusing one read before it recovers. */
      const mock = sdk();
      /** Retains provider prices, descriptions and opaque signatures through retry. */
      const providerValue = operation === "getProducts"
        ? [{sku: "coins", name: "Coins", description: null, price: 0.99, currency: "USD"}]
        : {subscriptions: [{sku: "premium", status: "active"}], signed: "catalog.signed"};
      mock.payments[operation].mockRejectedValueOnce(new Error(providerRejection)).mockResolvedValue(providerValue);
      /** Applies the actual public adapter read to the provider fixture. */
      const result = await new JestSdkPlatform(mock)[operation]();
      expect(result).toEqual({
        status: "success",
        value: operation === "getProducts"
          ? [{sku: "coins", name: "Coins", description: undefined, price: 0.99, currency: "USD"}]
          : {subscriptions: [{sku: "premium", status: "active"}], subscriptionsSigned: "catalog.signed"},
      });
      expect(mock.payments[operation]).toHaveBeenCalledTimes(2);
      expect(report).not.toHaveBeenCalled();
    } finally { resetBrowserErrorReporterForTests(); }
  });

  it("reports a persistent provider rejection once after its only retry", async () => {
    /** Observes the final failure rather than each attempted read. */
    const report = jest.fn();
    configureBrowserErrorReporter(report);
    try {
      /** Refuses both catalog attempts with the current SDK's exact error. */
      const mock = sdk();
      mock.payments[operation].mockRejectedValue(new Error(providerRejection));
      await expect(new JestSdkPlatform(mock)[operation]()).resolves.toEqual({
        status: "retryable-failure", message: providerRejection,
      });
      expect(mock.payments[operation]).toHaveBeenCalledTimes(2);
      expect(report).toHaveBeenCalledTimes(1);
    } finally { resetBrowserErrorReporterForTests(); }
  });

  it.each(["unrelated", "typed", "untyped", "terminal"])("does not retry a %s failure", async kind => {
    /** Makes only the exact plain provider-negative error eligible for another read. */
    const error = kind === "typed" ? new TypeError(providerRejection)
      : kind === "untyped" ? providerRejection
        : new Error(kind === "terminal" ? "INVALID_ARGUMENTS: invalid sku" : "offline");
    /** Rejects before any successful provider catalog exists. */
    const mock = sdk();
    mock.payments[operation].mockRejectedValue(error);
    await expect(new JestSdkPlatform(mock)[operation]()).resolves.toMatchObject({
      status: kind === "terminal" ? "terminal-failure" : "retryable-failure",
    });
    expect(mock.payments[operation]).toHaveBeenCalledTimes(1);
  });

  it("bounds a permanently pending catalog read at 15 seconds", async () => {
    jest.useFakeTimers();
    try {
      /** Models a parent response that never arrives. */
      const mock = sdk();
      mock.payments[operation].mockImplementation(() => new Promise(() => undefined));
      /** Records the public result before and at its deadline. */
      const outcomes: unknown[] = [];
      void new JestSdkPlatform(mock)[operation]().then(value => outcomes.push(value));
      await jest.advanceTimersByTimeAsync(14_999);
      expect(outcomes).toEqual([]);
      await jest.advanceTimersByTimeAsync(1);
      expect(outcomes).toEqual([{status: "retryable-failure", message: timeoutMessage}]);
      expect(mock.payments[operation]).toHaveBeenCalledTimes(1);
      expect(jest.getTimerCount()).toBe(0);
    } finally { jest.useRealTimers(); }
  });

  it("keeps both catalog attempts inside one 15-second deadline", async () => {
    jest.useFakeTimers();
    try {
      /** Leaves one millisecond for the second attempt. */
      const mock = sdk();
      mock.payments[operation].mockImplementationOnce(() => new Promise((_resolve, reject) => {
        setTimeout(() => reject(new Error(providerRejection)), 14_999);
      })).mockImplementationOnce(() => new Promise(() => undefined));
      /** Observes the deadline shared by the initial read and its retry. */
      const outcomes: unknown[] = [];
      void new JestSdkPlatform(mock)[operation]().then(value => outcomes.push(value));
      await jest.advanceTimersByTimeAsync(14_999);
      expect(mock.payments[operation]).toHaveBeenCalledTimes(2);
      expect(outcomes).toEqual([]);
      await jest.advanceTimersByTimeAsync(1);
      expect(outcomes).toEqual([{status: "retryable-failure", message: timeoutMessage}]);
      expect(jest.getTimerCount()).toBe(0);
    } finally { jest.useRealTimers(); }
  });

  it.each([15_000, 16_000])("does not start a retry after a provider rejection at %ims", async delay => {
    jest.useFakeTimers();
    /** Captures one public failure even when the provider settles after the deadline. */
    const report = jest.fn();
    configureBrowserErrorReporter(report);
    try {
      /** Delays the first negative reply beyond the available read budget. */
      const mock = sdk();
      mock.payments[operation].mockImplementationOnce(() => new Promise((_resolve, reject) => {
        setTimeout(() => reject(new Error(providerRejection)), delay);
      }));
      /** Settles through the public adapter before inspecting provider call count. */
      const pending = new JestSdkPlatform(mock)[operation]();
      await jest.advanceTimersByTimeAsync(delay);
      await expect(pending).resolves.toMatchObject({status: "retryable-failure"});
      expect(mock.payments[operation]).toHaveBeenCalledTimes(1);
      expect(report).toHaveBeenCalledTimes(1);
      expect(jest.getTimerCount()).toBe(0);
    } finally { jest.useRealTimers(); resetBrowserErrorReporterForTests(); }
  });
});

it("recovers one exact incomplete-purchase provider rejection before reporting a failure", async () => {
  /** Observes only final failures from the provider boundary. */
  const report = jest.fn();
  configureBrowserErrorReporter(report);
  try {
    /** Returns the current SDK's negative response once, then the signed recovery envelope. */
    const mock = sdk();
    mock.payments.getIncompletePurchases.mockRejectedValueOnce(new Error("Failed to fetch incomplete purchases"))
      .mockResolvedValue({purchases: [], purchasesSigned: "signed", hasMore: false});
    await expect(new JestSdkPlatform(mock).getIncompletePurchases()).resolves.toEqual({
      status: "success", value: {purchases: [], purchasesSigned: "signed", hasMore: false},
    });
    expect(mock.payments.getIncompletePurchases).toHaveBeenCalledTimes(2);
    expect(report).not.toHaveBeenCalled();
  } finally { resetBrowserErrorReporterForTests(); }
});

it("reports an exhausted incomplete-purchase provider retry exactly once", async () => {
  /** Receives the final unrecovered provider error. */
  const report = jest.fn();
  configureBrowserErrorReporter(report);
  try {
    /** Models a provider refusal that does not recover. */
    const mock = sdk();
    mock.payments.getIncompletePurchases.mockRejectedValue(new Error("Failed to fetch incomplete purchases"));
    await expect(new JestSdkPlatform(mock).getIncompletePurchases()).resolves.toEqual({
      status: "retryable-failure", message: "Failed to fetch incomplete purchases",
    });
    expect(mock.payments.getIncompletePurchases).toHaveBeenCalledTimes(2);
    expect(report).toHaveBeenCalledTimes(1);
  } finally { resetBrowserErrorReporterForTests(); }
});

it.each([new Error("offline"), new TypeError("Failed to fetch incomplete purchases"), "Failed to fetch incomplete purchases"])(
  "does not retry unrelated or untyped incomplete-purchase failures: %p", async error => {
    /** Rejects outside the exact provider-negative classification. */
    const mock = sdk();
    mock.payments.getIncompletePurchases.mockRejectedValue(error);
    await expect(new JestSdkPlatform(mock).getIncompletePurchases()).resolves.toMatchObject({status: "retryable-failure"});
    expect(mock.payments.getIncompletePurchases).toHaveBeenCalledTimes(1);
  },
);

it.each<["beginPurchase" | "completePurchase" | "beginSubscription"]>([
  ["beginPurchase"], ["completePurchase"], ["beginSubscription"],
])("does not retry the paid %s action for any provider-negative read error", async operation => {
  /** Uses read-error messages without extending retry to a payment mutation. */
  const mock = sdk();
  /** Calls the selected payment mutation once. */
  const platform = new JestSdkPlatform(mock);
  for (const message of ["Failed to fetch products", "Failed to fetch subscriptions", "Failed to fetch incomplete purchases"]) {
    mock.payments[operation].mockClear().mockRejectedValueOnce(new Error(message));
    await expect(operation === "beginPurchase" ? platform.beginPurchase("sku")
      : operation === "completePurchase" ? platform.completePurchase("token") : platform.beginSubscription("premium"))
      .resolves.toMatchObject({status: "retryable-failure"});
    expect(mock.payments[operation]).toHaveBeenCalledTimes(1);
  }
});

it("keeps both incomplete-purchase attempts inside the original 15-second deadline", async () => {
  jest.useFakeTimers();
  try {
    /** Leaves only one millisecond for the second provider attempt. */
    const mock = sdk();
    mock.payments.getIncompletePurchases.mockImplementationOnce(() => new Promise((_resolve, reject) => {
      setTimeout(() => reject(new Error("Failed to fetch incomplete purchases")), 14_999);
    })).mockImplementationOnce(() => new Promise(() => undefined));
    /** Records the single final outcome before advancing the shared deadline. */
    const outcomes: unknown[] = [];
    void new JestSdkPlatform(mock).getIncompletePurchases().then(value => outcomes.push(value));
    await jest.advanceTimersByTimeAsync(14_999);
    expect(mock.payments.getIncompletePurchases).toHaveBeenCalledTimes(2);
    expect(outcomes).toEqual([]);
    await jest.advanceTimersByTimeAsync(1);
    expect(outcomes).toEqual([{status: "retryable-failure", message: "Jest incomplete purchase read timed out"}]);
    expect(jest.getTimerCount()).toBe(0);
  } finally { jest.useRealTimers(); }
});

it.each([15_000, 16_000])("does not retry a provider-negative response arriving at %ims", async delay => {
  jest.useFakeTimers();
  /** Observes only the one final failure, including a late upstream rejection. */
  const report = jest.fn();
  configureBrowserErrorReporter(report);
  try {
    /** Reaches or exceeds the shared budget before rejecting its original read. */
    const mock = sdk();
    mock.payments.getIncompletePurchases.mockImplementationOnce(() => new Promise((_resolve, reject) => {
      setTimeout(() => reject(new Error("Failed to fetch incomplete purchases")), delay);
    }));
    /** Awaits completion while advancing both the local and upstream timers. */
    const pending = new JestSdkPlatform(mock).getIncompletePurchases();
    await jest.advanceTimersByTimeAsync(delay);
    await expect(pending).resolves.toMatchObject({status: "retryable-failure"});
    expect(mock.payments.getIncompletePurchases).toHaveBeenCalledTimes(1);
    expect(report).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
  } finally { jest.useRealTimers(); resetBrowserErrorReporterForTests(); }
});

it("maps every purchase completion result", async () => {
  /** Provides mock behavior. */
  const mock = sdk();
  /** Provides platform behavior. */
  const platform = new JestSdkPlatform(mock);
  mock.payments.beginPurchase
    .mockResolvedValueOnce({result: "success", purchase: {sku: "coins"}, purchaseSigned: "signed"})
    .mockResolvedValueOnce({result: "error", error: "gateway"});
  await expect(platform.beginPurchase("coins")).resolves.toEqual({
    status: "success",
    value: {purchase: {sku: "coins"}, purchaseSigned: "signed"},
  });
  await expect(platform.beginPurchase("coins")).resolves.toEqual({status: "retryable-failure", message: "gateway"});

  mock.payments.completePurchase
    .mockResolvedValueOnce({result: "success"})
    .mockResolvedValueOnce({result: "error", error: "gateway"})
    .mockRejectedValueOnce(new Error("offline"));
  await expect(platform.completePurchase("token")).resolves.toEqual({status: "success", value: undefined});
  await expect(platform.completePurchase("token")).resolves.toEqual({status: "retryable-failure", message: "gateway"});
  await expect(platform.completePurchase("token")).resolves.toEqual({status: "retryable-failure", message: "offline"});
});

it("handles empty and failed subscription catalogs and checkout failures", async () => {
  /** Provides mock behavior. */
  const mock = sdk();
  /** Provides platform behavior. */
  const platform = new JestSdkPlatform(mock);
  mock.payments.getSubscriptions.mockResolvedValue({subscriptions: [], signed: "empty.signed"});
  await expect(platform.getSubscriptions()).resolves.toEqual({
    status: "success",
    value: {subscriptions: [], subscriptionsSigned: "empty.signed"},
  });
  mock.payments.getSubscriptions.mockRejectedValue(new Error("offline"));
  await expect(platform.getSubscriptions()).resolves.toEqual({status: "retryable-failure", message: "offline"});
  mock.payments.beginSubscription
    .mockResolvedValueOnce({result: "error", error: "gateway"})
    .mockRejectedValueOnce(new Error("offline"));
  await expect(platform.beginSubscription("premium")).resolves.toEqual({
    status: "retryable-failure",
    message: "gateway",
  });
  await expect(platform.beginSubscription("premium")).resolves.toEqual({
    status: "retryable-failure",
    message: "offline",
  });
});

it("keeps subscription checkout pending until the provider settles after the confirmation deadline", async () => {
  /** Provider SDK fixture whose checkout remains unresolved past the confirmation deadline. */
  const mock = sdk();
  /** Releases the pending provider checkout with an explicit cancellation. */
  let settleCheckout: (result: {
    /** Provider cancellation discriminator delivered when the player dismisses checkout. */
    result: "cancel"
  }) => void = () => { throw new Error("Checkout has not started"); };
  mock.payments.beginSubscription.mockImplementation(() => new Promise((resolve) => { settleCheckout = resolve; }));
  jest.useFakeTimers();
  try {
    /** Observed checkout results, which must stay empty while the provider remains open. */
    const settled: unknown[] = [];
    /** Subscription request that must retain ownership until the provider responds. */
    const checkout = new JestSdkPlatform(mock, 1).beginSubscription("premium");
    void checkout.then((result) => settled.push(result));
    await jest.advanceTimersByTimeAsync(30_000);
    expect(settled).toEqual([]);
    settleCheckout({result: "cancel"});
    await expect(checkout).resolves.toEqual({status: "cancelled"});
  } finally {
    jest.useRealTimers();
  }
});

it("marks the first milestone and contains milestone failures", async () => {
  /** Provides mock behavior. */
  const mock = sdk();
  /** Provides platform behavior. */
  const platform = new JestSdkPlatform(mock);
  await expect(platform.markFirstMilestone()).resolves.toEqual({status: "success", value: undefined});
  mock.markFirstMilestone.mockRejectedValue(new Error("offline"));
  await expect(platform.markFirstMilestone()).resolves.toEqual({status: "retryable-failure", message: "offline"});
});

it("normalizes subscription cancellation without treating dismissal as success", async () => {
  /** Creates a provider SDK fixture. */
  const mock = sdk();
  /** Uses a short timeout to cover an unresolved confirmation. */
  const platform = new JestSdkPlatform(mock, 1);
  for (const [response, expected] of [
    [{result: "success"}, {status: "success", value: undefined}],
    [{result: "cancel"}, {status: "cancelled"}],
    [{result: "error", error: "not_found"}, {status: "terminal-failure", message: "not_found"}],
    [{result: "error", error: "not_active"}, {status: "unavailable", message: "not_active"}],
    [{result: "error", error: "guest_not_allowed"}, {status: "unavailable", message: "guest_not_allowed"}],
    [{result: "error", error: "internal_error"}, {status: "retryable-failure", message: "internal_error"}],
    [null, {status: "retryable-failure", message: "invalid_response"}],
  ]) {
    mock.payments.cancelSubscription.mockResolvedValueOnce(response);
    await expect(platform.cancelSubscription("premium")).resolves.toEqual(expected);
  }
  expect(mock.payments.cancelSubscription).toHaveBeenCalledWith({subscriptionSku: "premium"});
  mock.payments.cancelSubscription.mockRejectedValueOnce(new Error("offline"));
  await expect(platform.cancelSubscription("premium")).resolves.toMatchObject({status: "retryable-failure"});
  mock.payments.cancelSubscription.mockImplementationOnce(() => new Promise(() => undefined));
  await expect(platform.cancelSubscription("premium")).resolves.toMatchObject({status: "retryable-failure", message: expect.stringContaining("timed out")});
});

it("reports bounded cancellation diagnostics without exposing provider responses", async () => {
  /** Extracts the fixture or authority fields required by this transition. */
  const {configureBrowserErrorReporter, resetBrowserErrorReporterForTests} = await import("../../../../../packages/web-game/src/observability/browserErrorReporter");
  /** Captured delivery reports expose optional browser error reporting. */
  const reports: Array<{
    /** Original failure is preserved through reporting and recovery checks. */
    error: unknown;
    /** Captured reporting context identifies the failing operation. */
    context: unknown}> = [];
  configureBrowserErrorReporter((error, context) => { reports.push({error, context}); });
  try {
    /** Controlled SDK adapter isolates provider behavior. */
    const mock = sdk();
    /** Provider adapter under test owns identity and optional SDK behavior. */
    const platform = new JestSdkPlatform(mock, 1);
    mock.payments.cancelSubscription.mockResolvedValueOnce({result: "error", error: "not_found"});
    await platform.cancelSubscription("premium");
    expect(reports[0].context).toEqual({component: "jest_sdk", operation: "cancel_subscription", reason: "not_found"});
    mock.payments.cancelSubscription.mockResolvedValueOnce({result: "error", error: "not_active"});
    await platform.cancelSubscription("premium");
    expect(reports).toHaveLength(1);
    mock.payments.cancelSubscription.mockResolvedValueOnce({result: "error", error: "opaque-private-provider-response"});
    await platform.cancelSubscription("premium");
    expect(reports[1].context).toEqual({component: "jest_sdk", operation: "cancel_subscription", reason: "unknown_provider_error"});
    expect(String(reports[1].error)).not.toContain("opaque-private-provider-response");
    mock.payments.cancelSubscription.mockImplementationOnce(() => new Promise(() => undefined));
    await platform.cancelSubscription("premium");
    expect(reports[2].context).toEqual({component: "jest_sdk", operation: "cancel_subscription", reason: "timeout"});
  } finally {
    resetBrowserErrorReporterForTests();
  }
});

it("reports a missing provider payment module as a recoverable catalog failure", async () => {
  await expect(new JestSdkPlatform({}).getProducts()).resolves.toEqual({
    status: "retryable-failure",
    message: "Jest SDK payments module is unavailable.",
  });
});
