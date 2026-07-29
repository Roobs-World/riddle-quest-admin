import {JestSdkPlatform} from "../JestSdkPlatform";

const sdk = () => ({
  init: jest.fn().mockResolvedValue(undefined), getPlayer: jest.fn(() => ({playerId: "p1", registered: false})),
  getPlayerSigned: jest.fn(), login: jest.fn().mockResolvedValue(undefined), getEntryPayload: jest.fn(() => ({gameMode: "classic"})),
  data: {getAll: jest.fn(() => ({locale: "en", coins: 999})), set: jest.fn(), flush: jest.fn().mockResolvedValue(undefined)},
  notifications: {scheduleNotification: jest.fn(), unscheduleNotification: jest.fn()},
  social: {getProfile: jest.fn(() => null), setScreenshotProvider: jest.fn()},
  referrals: {shareReferralLink: jest.fn(), listReferrals: jest.fn()},
  payments: {getProducts: jest.fn(), beginPurchase: jest.fn(), getIncompletePurchases: jest.fn(), completePurchase: jest.fn()},
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
it("does not schedule notifications for guests", async () => expect(await new JestSdkPlatform(sdk()).scheduleNotification({identifier: "daily", scheduledInDays: 1, body: "Play", ctaText: "Open"})).toEqual({status: "unavailable", message: "Registration is required"}));
it("distinguishes purchase cancellation", async () => { const mock = sdk(); mock.payments.beginPurchase.mockResolvedValue({result: "cancel"}); expect(await new JestSdkPlatform(mock).beginPurchase("coins")).toEqual({status: "cancelled"}); });
it("treats invalid products and tokens as terminal", async () => {
  const mock = sdk();
  mock.payments.beginPurchase.mockResolvedValue({result: "error", error: "invalid_product"});
  mock.payments.completePurchase.mockResolvedValue({result: "error", error: "invalid_token"});
  expect(await new JestSdkPlatform(mock).beginPurchase("bad")).toEqual({status: "terminal-failure", message: "invalid_product"});
  expect(await new JestSdkPlatform(mock).completePurchase("bad")).toEqual({status: "terminal-failure", message: "invalid_token"});
});
it("handles registered notifications, nullable profiles and referral cancellation", async () => {
  const mock = sdk();
  mock.getPlayer.mockReturnValue({playerId: "p1", registered: true});
  mock.referrals.shareReferralLink.mockResolvedValue({canceled: true});
  expect(await new JestSdkPlatform(mock).getProfile()).toBeNull();
  expect(await new JestSdkPlatform(mock).scheduleNotification({identifier: "daily", scheduledInDays: 1, body: "Play", ctaText: "Open"})).toEqual({status: "success", value: undefined});
  expect(await new JestSdkPlatform(mock).shareReferral({
    reference: "campaign",
    title: "Challenge",
    text: "Can you beat me?",
    entryPayload: {gameMode: "classic"},
  })).toEqual({status: "cancelled"});
});
it("maps thrown timeouts to retryable failures", async () => {
  const mock = sdk();
  mock.payments.beginPurchase.mockRejectedValue(new Error("timeout"));
  expect(await new JestSdkPlatform(mock).beginPurchase("coins")).toEqual({status: "retryable-failure", message: "timeout"});
});
