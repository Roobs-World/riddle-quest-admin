import {JestSdkPlatform} from "../JestSdkPlatform";
import type {BridgeProfile} from "@qwordly/core/bridge";

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

const sdk = () => ({
  init: jest.fn().mockResolvedValue(undefined), getPlayer: jest.fn(() => ({playerId: "p1", registered: false})),
  getPlayerSigned: jest.fn(), login: jest.fn().mockResolvedValue(undefined), getEntryPayload: jest.fn(() => ({gameMode: "classic"})),
  showRegistrationOverlay: jest.fn((options) => ({
    loginButtonAction: jest.fn(),
    closeButtonAction: () => options.onClose(),
  })),
  data: {getAll: jest.fn(() => ({locale: "en", coins: 999})), set: jest.fn(), flush: jest.fn().mockResolvedValue(undefined)},
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
  },
  markFirstMilestone: jest.fn(),
  setLoadingProgress: jest.fn(),
  markGameLoaded: jest.fn(),
});

const savedGame = {
  schemaVersion: 1,
  savedAt: 10,
  riddleId: "riddle-1",
  gameMode: "classic",
  currentLetters: ["A", ""],
  activeSlotIndex: 1,
  hintRevealedIndices: [0],
  guesses: [],
  engineSnapshot: {attemptsRemaining: 5},
  letterStates: {},
};

it("stores only low-integrity preferences", () => expect(new JestSdkPlatform(sdk()).readPreferences()).toEqual({
  locale: "en",
  muted: undefined,
  reducedMotion: undefined,
  highContrast: undefined,
  onboardingComplete: undefined,
  registrationPromptDismissedAt: undefined,
  firstMilestoneMarked: undefined,
}));
it("loads a versioned player snapshot from the Jest player store", async () => {
  const mock = sdk();
  mock.getPlayer.mockReturnValue({playerId: "p1", registered: true});
  const activeGame = {
    schemaVersion: 1,
    savedAt: 10,
    riddleId: "riddle-1",
    gameMode: "classic",
    currentLetters: ["A", ""],
    activeSlotIndex: 1,
    hintRevealedIndices: [0],
    guesses: [],
    engineSnapshot: {attemptsRemaining: 5},
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
  const mock = sdk();
  const onClose = jest.fn();
  const result = new JestSdkPlatform(mock).showRegistrationOverlay({
    theme: "dark",
    entryPayload: {source: "post_instructions"},
    onClose,
  });

  expect(mock.showRegistrationOverlay).toHaveBeenCalledWith({
    theme: "dark",
    entryPayload: {source: "post_instructions"},
    onClose,
  });
  expect(result.status).toBe("success");
  if (result.status !== "success") return;
  result.value.closeButtonAction();
  expect(onClose).toHaveBeenCalledTimes(1);
});
it("passes entry attribution to guest login and skips the dialog for registered players", async () => {
  const guestSdk = sdk();
  guestSdk.getPlayer
    .mockReturnValueOnce({playerId: "p1", registered: false})
    .mockReturnValue({playerId: "p1", registered: true});
  const guestResult = await new JestSdkPlatform(guestSdk).login({source: "authoritative_win"});
  expect(guestSdk.login).toHaveBeenCalledWith({entryPayload: {source: "authoritative_win"}});
  expect(guestResult).toEqual({status: "success", value: {playerId: "p1", registered: true}});

  const registeredSdk = sdk();
  registeredSdk.getPlayer.mockReturnValue({playerId: "p1", registered: true});
  const registeredResult = await new JestSdkPlatform(registeredSdk).login({source: "post_instructions"});
  expect(registeredSdk.login).not.toHaveBeenCalled();
  expect(registeredResult).toEqual({status: "success", value: {playerId: "p1", registered: true}});
});
it("rejects unknown player snapshot versions", async () => {
  const mock = sdk();
  mock.getPlayer.mockReturnValue({playerId: "p1", registered: true});
  mock.data.getAll.mockReturnValue({
    riddleQuestPlayerState: {schemaVersion: 2, updatedAt: 11},
  });
  expect(await new JestSdkPlatform(mock).readPlayerData()).toBeNull();
});
it("flushes player snapshot writes to Jest", async () => {
  const mock = sdk();
  mock.getPlayer.mockReturnValue({playerId: "p1", registered: true});
  const playerData = {schemaVersion: 1 as const, updatedAt: 11, profile: completeProfile};
  await new JestSdkPlatform(mock).writePlayerData(playerData);
  expect(mock.data.set).toHaveBeenCalledWith("riddleQuestPlayerState", playerData);
  expect(mock.data.flush).toHaveBeenCalledTimes(1);
});
it("preserves player snapshots for guests using their stable Jest player store", async () => {
  const mock = sdk();
  const platform = new JestSdkPlatform(mock);
  const playerData = {schemaVersion: 1 as const, updatedAt: 11};
  mock.data.getAll.mockReturnValue({riddleQuestPlayerState: playerData});

  expect(await platform.readPlayerData()).toEqual(playerData);
  await platform.writePlayerData(playerData);

  expect(mock.data.set).toHaveBeenCalledWith("riddleQuestPlayerState", playerData);
  expect(mock.data.flush).toHaveBeenCalledTimes(1);
});
it("does not schedule or remove notifications for guests", async () => {
  const platform = new JestSdkPlatform(sdk());
  await expect(platform.scheduleNotification({
    identifier: "daily",
    scheduledInDays: 1,
    body: "Play",
    ctaText: "Open",
  })).resolves.toEqual({status: "unavailable", message: "Registration is required"});
  await expect(platform.removeNotification("daily"))
    .resolves.toEqual({status: "unavailable", message: "Registration is required"});
});
it("treats invalid notification arguments as terminal", async () => {
  const mock = sdk();
  mock.getPlayer.mockReturnValue({playerId: "p1", registered: true});
  mock.notifications.scheduleNotification.mockRejectedValue(new Error("INVALID_ARGUMENTS"));
  await expect(new JestSdkPlatform(mock).scheduleNotification({
    identifier: "daily",
    scheduledInDays: 1,
    body: "Play",
    ctaText: "Open",
  })).resolves.toEqual({status: "terminal-failure", message: "INVALID_ARGUMENTS"});
});
it("distinguishes purchase cancellation", async () => { const mock = sdk(); mock.payments.beginPurchase.mockResolvedValue({result: "cancel"}); expect(await new JestSdkPlatform(mock).beginPurchase("coins")).toEqual({status: "cancelled"}); });
it("treats invalid products and tokens as terminal", async () => {
  const mock = sdk();
  mock.payments.beginPurchase.mockResolvedValue({result: "error", error: "invalid_product"});
  mock.payments.completePurchase.mockResolvedValue({result: "error", error: "invalid_token"});
  expect(await new JestSdkPlatform(mock).beginPurchase("bad")).toEqual({status: "terminal-failure", message: "invalid_product"});
  expect(await new JestSdkPlatform(mock).completePurchase("bad")).toEqual({status: "terminal-failure", message: "invalid_token"});
});
it("normalizes subscription catalogs and successful checkout", async () => {
  const mock = sdk();
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
  const mock = sdk();
  mock.payments.beginSubscription
    .mockResolvedValueOnce({result: "cancel"})
    .mockResolvedValueOnce({result: "error", error: "invalid_subscription"})
    .mockResolvedValueOnce({result: "error", error: "guest_not_allowed"})
    .mockResolvedValueOnce({result: "error", error: "already_subscribed"});
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
  const mock = sdk();
  mock.getPlayer.mockReturnValue({playerId: "p1", registered: true});
  mock.referrals.shareReferralLink.mockResolvedValue({canceled: true});
  expect(await new JestSdkPlatform(mock).getProfile()).toBeNull();
  expect(await new JestSdkPlatform(mock).scheduleNotification({identifier: "daily", scheduledInDays: 1, body: "Play", ctaText: "Open"})).toEqual({status: "success", value: undefined});
  expect(await new JestSdkPlatform(mock).shareReferral({
    reference: "campaign",
    shareTitle: "Challenge",
    shareText: "Can you beat me?",
    shareImage: "data:image/png;base64,YQ==",
    entryPayload: {gameMode: "classic"},
  })).toEqual({status: "cancelled"});
  expect(mock.referrals.shareReferralLink).toHaveBeenCalledWith({
    reference: "campaign",
    shareTitle: "Challenge",
    shareText: "Can you beat me?",
    shareImage: "data:image/png;base64,YQ==",
    entryPayload: {gameMode: "classic"},
  });
});
it("maps thrown timeouts to retryable failures", async () => {
  const mock = sdk();
  mock.payments.beginPurchase.mockRejectedValue(new Error("timeout"));
  expect(await new JestSdkPlatform(mock).beginPurchase("coins")).toEqual({status: "retryable-failure", message: "timeout"});
});

it("forwards acquisition events to Jest analytics", () => {
  const mock = sdk();
  new JestSdkPlatform(mock).captureEvent("registration_prompt_shown", {utmCampaign: "launch"});
  expect(mock.captureEvent).toHaveBeenCalledWith("registration_prompt_shown", {utmCampaign: "launch"});
});

it("uses the global SDK by default and initializes it safely", async () => {
  const original = (globalThis as typeof globalThis & {JestSDK?: unknown}).JestSDK;
  const mock = sdk();
  (globalThis as typeof globalThis & {JestSDK?: unknown}).JestSDK = mock;

  const platform = new JestSdkPlatform();
  await expect(platform.init()).resolves.toEqual({status: "success", value: undefined});
  expect(mock.init).toHaveBeenCalledWith({autoLoginReminders: false});
  expect(platform.getPlayer()).toEqual({playerId: "p1", registered: false});
  platform.getPlayerSigned();
  expect(mock.getPlayerSigned).toHaveBeenCalled();

  (globalThis as typeof globalThis & {JestSDK?: unknown}).JestSDK = original;
});

it("maps initialization and login failures", async () => {
  const mock = sdk();
  mock.init.mockRejectedValue("offline");
  mock.login.mockRejectedValue(new Error("BAD_REQUEST"));
  const platform = new JestSdkPlatform(mock);

  await expect(platform.init()).resolves.toEqual({status: "retryable-failure", message: "offline"});
  await expect(platform.login()).resolves.toEqual({status: "terminal-failure", message: "BAD_REQUEST"});
  expect(mock.login).toHaveBeenCalledWith(undefined);
});

it("runs both registration overlay actions and contains overlay errors", () => {
  const mock = sdk();
  const loginButtonAction = jest.fn();
  const closeButtonAction = jest.fn();
  mock.showRegistrationOverlay.mockReturnValue({loginButtonAction, closeButtonAction});
  const platform = new JestSdkPlatform(mock);
  const result = platform.showRegistrationOverlay({theme: "dark", onClose: jest.fn()});
  expect(result.status).toBe("success");
  if (result.status === "success") {
    result.value.loginButtonAction();
    result.value.closeButtonAction();
  }
  expect(loginButtonAction).toHaveBeenCalled();
  expect(closeButtonAction).toHaveBeenCalled();

  mock.showRegistrationOverlay.mockImplementation(() => { throw new Error("overlay unavailable"); });
  expect(platform.showRegistrationOverlay({theme: "dark", onClose: jest.fn()})).toEqual({
    status: "retryable-failure",
    message: "overlay unavailable",
  });
});

it("round-trips every supported preference", async () => {
  const mock = sdk();
  const preferences = {
    locale: "fr",
    muted: true,
    reducedMotion: false,
    highContrast: true,
    onboardingComplete: true,
    registrationPromptDismissedAt: 123,
    firstMilestoneMarked: false,
  };
  mock.data.getAll.mockReturnValue(preferences);
  const platform = new JestSdkPlatform(mock);
  expect(platform.readPreferences()).toEqual(preferences);
  await platform.writePreferences(preferences);
  expect(mock.data.set).toHaveBeenCalledWith(preferences);
  expect(mock.data.flush).toHaveBeenCalled();
});

it.each([
  [],
  {...savedGame, schemaVersion: 2},
  {...savedGame, savedAt: "10"},
  {...savedGame, riddleId: 1},
  {...savedGame, gameMode: "race"},
  {...savedGame, currentLetters: "A"},
  {...savedGame, currentLetters: [1]},
  {...savedGame, activeSlotIndex: "1"},
  {...savedGame, hintRevealedIndices: "0"},
  {...savedGame, hintRevealedIndices: ["0"]},
  {...savedGame, guesses: null},
  {...savedGame, engineSnapshot: []},
  {...savedGame, letterStates: null},
])("discards malformed active-game snapshots", async (activeGame) => {
  const mock = sdk();
  mock.data.getAll.mockReturnValue({riddleQuestPlayerState: {schemaVersion: 1, updatedAt: 11, activeGame}});
  expect(await new JestSdkPlatform(mock).readPlayerData()).toEqual({schemaVersion: 1, updatedAt: 11});
});

it("supports explicitly cleared active games and missing SDK data", async () => {
  const mock = sdk();
  mock.data.getAll.mockReturnValue({riddleQuestPlayerState: {schemaVersion: 1, updatedAt: 11, activeGame: null}});
  expect(await new JestSdkPlatform(mock).readPlayerData()).toEqual({schemaVersion: 1, updatedAt: 11, activeGame: null});
  expect(new JestSdkPlatform({}).readPreferences()).toEqual({
    locale: undefined,
    muted: undefined,
    reducedMotion: undefined,
    highContrast: undefined,
    onboardingComplete: undefined,
    registrationPromptDismissedAt: undefined,
    firstMilestoneMarked: undefined,
  });
  expect(new JestSdkPlatform({}).getEntryIntent()).toEqual({});
});

it("constructs safely when the global SDK is absent", () => {
  const target = globalThis as typeof globalThis & {JestSDK?: unknown};
  const original = target.JestSDK;
  delete target.JestSDK;
  expect(new JestSdkPlatform()).toBeInstanceOf(JestSdkPlatform);
  target.JestSDK = original;
});

it("reads entry intent, configures screenshots, and forwards lifecycle state", () => {
  const mock = sdk();
  const platform = new JestSdkPlatform(mock);
  expect(platform.getEntryIntent()).toMatchObject({gameMode: "classic"});
  const provider = jest.fn();
  platform.setScreenshotProvider(provider);
  platform.setLoadingProgress(72);
  platform.markGameLoaded();
  expect(mock.social.setScreenshotProvider).toHaveBeenCalledWith(provider);
  expect(mock.setLoadingProgress).toHaveBeenCalledWith(72);
  expect(mock.markGameLoaded).toHaveBeenCalled();
});

it("handles registered notification removal and notification failures", async () => {
  const mock = sdk();
  mock.getPlayer.mockReturnValue({playerId: "p1", registered: true});
  const platform = new JestSdkPlatform(mock);
  await expect(platform.removeNotification("daily")).resolves.toEqual({status: "success", value: undefined});
  expect(mock.notifications.unscheduleNotification).toHaveBeenCalledWith({identifier: "daily"});
  mock.notifications.unscheduleNotification.mockRejectedValue(new Error("timeout"));
  await expect(platform.removeNotification("daily")).resolves.toEqual({status: "retryable-failure", message: "timeout"});
  mock.notifications.scheduleNotification.mockRejectedValue(new Error("timeout"));
  await expect(platform.scheduleNotification({identifier: "daily", scheduledInDays: 1, body: "Play", ctaText: "Open"}))
    .resolves.toEqual({status: "retryable-failure", message: "timeout"});
});

it("handles referrals, product catalogs, and incomplete purchases", async () => {
  const mock = sdk();
  const platform = new JestSdkPlatform(mock);
  mock.referrals.shareReferralLink.mockResolvedValue({canceled: false});
  mock.referrals.listReferrals.mockResolvedValue({referralsSigned: "signed"});
  mock.payments.getProducts.mockResolvedValue({products: []});
  mock.payments.getIncompletePurchases.mockResolvedValue({purchases: []});
  await expect(platform.shareReferral({reference: "campaign"} as never)).resolves.toEqual({status: "success", value: undefined});
  await expect(platform.listReferralsSigned()).resolves.toEqual({status: "success", value: "signed"});
  await expect(platform.getProducts()).resolves.toEqual({status: "success", value: {products: []}});
  await expect(platform.getIncompletePurchases()).resolves.toEqual({status: "success", value: {purchases: []}});

  mock.referrals.shareReferralLink.mockRejectedValue(new Error("offline"));
  mock.referrals.listReferrals.mockRejectedValue(new Error("offline"));
  mock.payments.getProducts.mockRejectedValue(new Error("offline"));
  mock.payments.getIncompletePurchases.mockRejectedValue(new Error("offline"));
  await expect(platform.shareReferral({reference: "campaign"} as never)).resolves.toMatchObject({status: "retryable-failure"});
  await expect(platform.listReferralsSigned()).resolves.toMatchObject({status: "retryable-failure"});
  await expect(platform.getProducts()).resolves.toMatchObject({status: "retryable-failure"});
  await expect(platform.getIncompletePurchases()).resolves.toMatchObject({status: "retryable-failure"});
});

it("maps every purchase completion result", async () => {
  const mock = sdk();
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
  const mock = sdk();
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
  await expect(platform.beginSubscription("premium")).resolves.toEqual({status: "retryable-failure", message: "gateway"});
  await expect(platform.beginSubscription("premium")).resolves.toEqual({status: "retryable-failure", message: "offline"});
});

it("times out a subscription checkout that never settles", async () => {
  const mock = sdk();
  mock.payments.beginSubscription.mockImplementation(() => new Promise(() => undefined));
  await expect(new JestSdkPlatform(mock, 1).beginSubscription("premium")).resolves.toEqual({
    status: "retryable-failure",
    message: "Jest subscription checkout timed out",
  });
});

it("marks the first milestone and contains milestone failures", async () => {
  const mock = sdk();
  const platform = new JestSdkPlatform(mock);
  await expect(platform.markFirstMilestone()).resolves.toEqual({status: "success", value: undefined});
  mock.markFirstMilestone.mockRejectedValue(new Error("offline"));
  await expect(platform.markFirstMilestone()).resolves.toEqual({status: "retryable-failure", message: "offline"});
});
