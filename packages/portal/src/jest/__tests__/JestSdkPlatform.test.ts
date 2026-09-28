import {JestSdkPlatform} from "../JestSdkPlatform";
import type {BridgeProfile} from "@qwordly/core/bridge";

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
  mock.payments.getProducts.mockResolvedValue({products: []});
  mock.payments.getIncompletePurchases.mockResolvedValue({purchases: []});
  await expect(platform.shareReferral({reference: "campaign"} as never)).resolves.toEqual({
    status: "success",
    value: undefined,
  });
  await expect(platform.listReferralsSigned()).resolves.toEqual({status: "success", value: "signed"});
  await expect(platform.getProducts()).resolves.toEqual({status: "success", value: {products: []}});
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
  mock.payments.getSubscriptions.mockResolvedValue({});
  await expect(platform.getSubscriptions()).resolves.toEqual({
    status: "success",
    value: {subscriptions: [], subscriptionsSigned: undefined},
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

it("times out a subscription checkout that never settles", async () => {
  /** Provides mock behavior. */
  const mock = sdk();
  mock.payments.beginSubscription.mockImplementation(() => new Promise(() => undefined));
  await expect(new JestSdkPlatform(mock, 1).beginSubscription("premium")).resolves.toEqual({
    status: "retryable-failure",
    message: "Jest subscription checkout timed out",
  });
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
