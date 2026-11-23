import type {
  JestEntryIntent,
  JestPlatformPort,
  JestPlayerData,
  JestPreferences,
  PlatformResult,
  ScreenshotProvider,
} from "./types";
import {parseEntryIntent} from "./entryIntent";
import {readBrowserStorage, removeBrowserStorage, writeBrowserStorage} from "../../../../packages/web-game/src/platform/browserStorage";

/** Provides ok behavior. */
const ok = <T>(value: T): PlatformResult<T> => ({status: "success", value});
/** Defines the mock player data key value. */
const MOCK_PLAYER_DATA_KEY = "riddleQuest:mockJestPlayerData";
/** Defines the premium subscription sku value. */
const PREMIUM_SUBSCRIPTION_SKU = "com.roobsworld.riddlequest.premium.monthly";
/** Provides mock jest platform behavior. */
export class MockJestPlatform implements JestPlatformPort {
  /** Stores player. */
  player: {
    /** Stores player id. */
    playerId: string; /** Stores registered. */
    /** Stores registered. */
    registered: boolean;
  };
  /** Stores preferences. */
  preferences: JestPreferences = {};
  /** Stores progress. */
  progress: number[] = [];
  /** Stores loaded. */
  loaded = false;
  /** Stores first milestone marked. */
  firstMilestoneMarked = false;
  /** Stores captured events. */
  capturedEvents: Array<{
    /** Stores name. */
    name: string; /** Stores properties. */
    /** Stores properties. */
    properties?: import("../../../../packages/web-game/src/analytics/events").SanitizedAnalyticsParams;
  }> = [];
  /** Stores subscription active. */
  subscriptionActive = false;
  /** Creates a mock jest platform instance. */
  constructor(registered = false) {
    this.player = {playerId: "jest-mock-player", registered};
  }
  /** Provides init behavior. */
  init = async () => ok(undefined);
  /** Gets player. */
  getPlayer = () => this.player;
  /** Gets player signed. */
  getPlayerSigned = async () => ({player: this.player, playerSigned: "mock.signed.player"});
  /** Provides login behavior. */
  login = async () => {
    this.player.registered = true;
    return ok(this.player);
  };
  /** Provides show registration overlay behavior. */
  showRegistrationOverlay = (options: Parameters<JestPlatformPort["showRegistrationOverlay"]>[0]) => {
    /** Provides closed behavior. */
    let closed = false;
    /** Provides close behavior. */
    const close = () => {
      if (closed) return;
      closed = true;
      options.onClose();
    };
    return ok({
      loginButtonAction: () => {
        this.player.registered = true;
        close();
      },
      closeButtonAction: close,
    });
  };
  /** Reads preferences. */
  readPreferences = () => ({...this.preferences});
  /** Provides write preferences behavior. */
  writePreferences = async (value: JestPreferences) => {
    this.preferences = {...this.preferences, ...value};
  };
  /** Reads player data. */
  readPlayerData = (): JestPlayerData | null => {
    try {
      /** Provides raw behavior. */
      const raw = readBrowserStorage("local", MOCK_PLAYER_DATA_KEY);
      return raw ? (JSON.parse(raw) as JestPlayerData) : null;
    } catch {
      return null;
    }
  };
  /** Provides write player data behavior. */
  writePlayerData = async (value: JestPlayerData) => {
    writeBrowserStorage("local", MOCK_PLAYER_DATA_KEY, JSON.stringify(value));
  };
  /** Clears mock client state after authoritative account deletion. */
  clearPlayerState = async () => {
    this.preferences = {};
    removeBrowserStorage("local", MOCK_PLAYER_DATA_KEY);
  };
  /** Gets entry intent. */
  getEntryIntent = (): JestEntryIntent => {
    if (typeof location === "undefined") return {};
    /** Provides params behavior. */
    const params = new URLSearchParams(location.search);
    /** Provides game mode behavior. */
    const gameMode = params.get("gameMode");
    /** Provides challenge id behavior. */
    const challengeId = params.get("challengeId");
    return {
      ...parseEntryIntent({}, location.search),
      ...(params.get("harness") === "race" && challengeId
        ? {challengeId, inviteKind: "race" as const, campaign: "race_to_10_v1"}
        : {}),
      ...(gameMode === "classic" || gameMode === "challenge" ? {gameMode} : {}),
    };
  };
  /** Gets profile. */
  getProfile = async () => null;
  /** Provides schedule notification behavior. */
  scheduleNotification = async () =>
    this.player.registered ? ok(undefined) : ({status: "unavailable", message: "Registration is required"} as const);
  /** Removes notification. */
  removeNotification = async () =>
    this.player.registered ? ok(undefined) : ({status: "unavailable", message: "Registration is required"} as const);
  /** Provides share referral behavior. */
  shareReferral = async (_input: Parameters<JestPlatformPort["shareReferral"]>[0]) => ok(undefined);
  /** Lists referrals signed. */
  listReferralsSigned = async () => ok("mock.referrals.signed");
  /** Sets screenshot provider. */
  setScreenshotProvider = (_provider: ScreenshotProvider | null) => {};
  /** Gets products. */
  getProducts = async () =>
    ok([
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
  /** Provides begin purchase behavior. */
  beginPurchase = async (sku: string) =>
    ok({purchase: {purchaseToken: `mock-${sku}`, productSku: sku}, purchaseSigned: "mock.purchase.signed"});
  /** Gets incomplete purchases. */
  getIncompletePurchases = async () => ok({purchases: [], purchasesSigned: "mock.purchases.signed", hasMore: false});
  /** Completes purchase. */
  completePurchase = async () => ok(undefined);
  /** Gets subscriptions. */
  getSubscriptions = async () =>
    ok({
      subscriptions: this.player.registered
        ? [
            {
              sku: PREMIUM_SUBSCRIPTION_SKU,
              displayName: "Riddle Quest Premium",
              displayDescription: "Premium membership for dedicated riddle solvers.",
              price: 4.99,
              currency: "USD",
              billingPeriod: "monthly" as const,
              status: this.subscriptionActive ? ("active" as const) : ("inactive" as const),
              trialEligible: !this.subscriptionActive,
            },
          ]
        : [],
      subscriptionsSigned: this.subscriptionActive
        ? "mock.subscriptions.active.signed"
        : "mock.subscriptions.inactive.signed",
    });
  /** Provides begin subscription behavior. */
  beginSubscription = async (subscriptionSku: string) => {
    if (!this.player.registered) {
      return {status: "unavailable", message: "guest_not_allowed"} as const;
    }
    this.subscriptionActive = true;
    return ok({
      subscription: {
        sku: subscriptionSku,
        displayName: "Riddle Quest Premium",
        displayDescription: "Premium membership for dedicated riddle solvers.",
        price: 4.99,
        currency: "USD",
        billingPeriod: "monthly" as const,
        status: "active" as const,
        trialEligible: false,
      },
      subscriptionSigned: "mock.subscription.signed",
    });
  };
  /** Cancels renewal while retaining the current billing-period entitlement. */
  cancelSubscription = async (_subscriptionSku: string): Promise<PlatformResult<void>> => {
    if (!this.player.registered) return {status: "unavailable", message: "guest_not_allowed"};
    if (!this.subscriptionActive) return {status: "unavailable", message: "not_active"};
    return ok(undefined);
  };
  /** Captures event. */
  captureEvent = (name: string, properties?: import("../../../../packages/web-game/src/analytics/events").SanitizedAnalyticsParams) => {
    this.capturedEvents.push({name, properties});
  };
  /** Provides mark first milestone behavior. */
  markFirstMilestone = async () => {
    this.firstMilestoneMarked = true;
    return ok(undefined);
  };
  /** Sets loading progress. */
  setLoadingProgress = (value: number) => {
    this.progress.push(value);
  };
  /** Provides mark game loaded behavior. */
  markGameLoaded = () => {
    this.loaded = true;
  };
}
