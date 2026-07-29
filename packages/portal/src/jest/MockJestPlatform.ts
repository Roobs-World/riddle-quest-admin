import type {JestPlatformPort, JestPreferences, PlatformResult, ScreenshotProvider} from "./types";

const ok = <T>(value: T): PlatformResult<T> => ({status: "success", value});
export class MockJestPlatform implements JestPlatformPort {
  player = {playerId: "jest-mock-player", registered: false};
  preferences: JestPreferences = {};
  progress: number[] = [];
  loaded = false;
  firstMilestoneMarked = false;
  init = async () => ok(undefined);
  getPlayer = () => this.player;
  getPlayerSigned = async () => ({player: this.player, playerSigned: "mock.signed.player"});
  login = async () => { this.player.registered = true; return ok(this.player); };
  readPreferences = () => ({...this.preferences});
  writePreferences = async (value: JestPreferences) => { this.preferences = {...this.preferences, ...value}; };
  getEntryIntent = () => ({});
  getProfile = async () => null;
  scheduleNotification = async () => this.player.registered ? ok(undefined) : ({status: "unavailable", message: "Registration is required"} as const);
  removeNotification = async () => ok(undefined);
  shareReferral = async (_input: Parameters<JestPlatformPort["shareReferral"]>[0]) => ok(undefined);
  listReferralsSigned = async () => ok("mock.referrals.signed");
  setScreenshotProvider = (_provider: ScreenshotProvider | null) => {};
  getProducts = async () => ok([
    {
      sku: "com.roobsworld.riddlequest.coinpack1",
      name: "Starter Pack",
      description: "A small refill for a quick hint or two.",
      price: 0.99,
      currency: "USD",
    },
    {
      sku: "com.roobsworld.riddlequest.coinpack2",
      name: "Small Pack",
      description: "A balanced refill for regular play.",
      price: 1.99,
      currency: "USD",
    },
    {
      sku: "com.roobsworld.riddlequest.coinpack3",
      name: "Mid Pack",
      description: "A solid boost for a longer session.",
      price: 2.99,
      currency: "USD",
    },
    {
      sku: "com.roobsworld.riddlequest.coinpack4",
      name: "Large Pack",
      description: "A popular option for extra flexibility.",
      price: 4.99,
      currency: "USD",
    },
    {
      sku: "com.roobsworld.riddlequest.coinpack5",
      name: "Huge Pack",
      description: "Strong value for players who keep coming back.",
      price: 9.99,
      currency: "USD",
    },
    {
      sku: "com.roobsworld.riddlequest.coinpack6",
      name: "Mega Pack",
      description: "The best-value bundle for the long haul.",
      price: 19.99,
      currency: "USD",
    },
  ]);
  beginPurchase = async (sku: string) => ok({purchase: {purchaseToken: `mock-${sku}`, productSku: sku}, purchaseSigned: "mock.purchase.signed"});
  getIncompletePurchases = async () => ok({purchases: [], purchasesSigned: "mock.purchases.signed", hasMore: false});
  completePurchase = async () => ok(undefined);
  markFirstMilestone = async () => { this.firstMilestoneMarked = true; return ok(undefined); };
  setLoadingProgress = (value: number) => { this.progress.push(value); };
  markGameLoaded = () => { this.loaded = true; };
}
