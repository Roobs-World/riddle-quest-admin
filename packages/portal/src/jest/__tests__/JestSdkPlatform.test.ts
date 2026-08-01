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
});

it("stores only low-integrity preferences", () => expect(new JestSdkPlatform(sdk()).readPreferences()).toEqual({
  locale: "en",
  muted: undefined,
  reducedMotion: undefined,
  highContrast: undefined,
  onboardingComplete: undefined,
  registrationPromptDismissedAt: undefined,
  firstMilestoneMarked: undefined,
}));
it("loads a versioned player snapshot from the Jest player store", () => {
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

  expect(new JestSdkPlatform(mock).readPlayerData()).toEqual({
    schemaVersion: 1,
    updatedAt: 11,
    profile: completeProfile,
    activeGame,
  });
});
it("discards an incomplete Jest profile instead of restoring partial statistics", () => {
  const mock = sdk();
  mock.getPlayer.mockReturnValue({playerId: "p1", registered: true});
  mock.data.getAll.mockReturnValue({
    riddleQuestPlayerState: {
      schemaVersion: 1,
      updatedAt: 11,
      profile: {username: "Partial", coins: 10},
    },
  });

  expect(new JestSdkPlatform(mock).readPlayerData()).toEqual({
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
it("rejects unknown player snapshot versions", () => {
  const mock = sdk();
  mock.getPlayer.mockReturnValue({playerId: "p1", registered: true});
  mock.data.getAll.mockReturnValue({
    riddleQuestPlayerState: {schemaVersion: 2, updatedAt: 11},
  });
  expect(new JestSdkPlatform(mock).readPlayerData()).toBeNull();
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

  expect(platform.readPlayerData()).toEqual(playerData);
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
