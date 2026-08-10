import {parseEntryIntent} from "./entryIntent";
import type {
  JestPlatformPort,
  JestPlayerData,
  JestPreferences,
  JestSavedGame,
  PlatformResult,
  ScreenshotProvider,
} from "./types";
import {captureBrowserException} from "../observability/sentry";

/** Describes sdk. */
type Sdk = Record<string, any>;
/** Defines the player data key value. */
const PLAYER_DATA_KEY = "riddleQuestPlayerState";
/** Defines the longest a platform subscription checkout may block the game UI. */
const SUBSCRIPTION_CHECKOUT_TIMEOUT_MS = 30_000;
/** Provides success behavior. */
const success = <T>(value: T): PlatformResult<T> => ({status: "success", value});
/** Provides failure behavior. */
const failure = (error: unknown): PlatformResult<never> => {
  captureBrowserException(error, {component: "jest_sdk"});
  const message = error instanceof Error ? error.message : String(error);
  return /INVALID_ARGUMENTS|BAD_REQUEST|invalid sku/i.test(message)
    ? {status: "terminal-failure", message}
    : {status: "retryable-failure", message};
};

/** Indicates whether is record. */
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Rejects an SDK operation that does not settle before its UI timeout. */
const withTimeout = async <T>(operation: Promise<T>, timeoutMs: number, message: string): Promise<T> => {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_resolve, reject) => {
        timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timeoutId);
  }
};

/** Parses saved game. */
const parseSavedGame = (value: unknown): JestSavedGame | null => {
  if (!isRecord(value)) return null;
  if (
    value.schemaVersion !== 1 ||
    typeof value.savedAt !== "number" ||
    typeof value.riddleId !== "string" ||
    (value.gameMode !== "classic" && value.gameMode !== "challenge") ||
    !Array.isArray(value.currentLetters) ||
    !value.currentLetters.every((letter) => typeof letter === "string") ||
    typeof value.activeSlotIndex !== "number" ||
    !Array.isArray(value.hintRevealedIndices) ||
    !value.hintRevealedIndices.every((index) => typeof index === "number") ||
    !Array.isArray(value.guesses) ||
    !isRecord(value.engineSnapshot) ||
    !isRecord(value.letterStates)
  ) {
    return null;
  }
  return value as JestSavedGame;
};

/** Provides jest sdk platform behavior. */
export class JestSdkPlatform implements JestPlatformPort {
  /** Stores sdk. */
  private readonly sdk: Sdk;
  /** Stores the subscription checkout timeout. */
  private readonly subscriptionCheckoutTimeoutMs: number;

  /** Creates a jest sdk platform instance. */
  constructor(
    sdk: Sdk = (globalThis as typeof globalThis & {JestSDK?: Sdk}).JestSDK ?? {},
    subscriptionCheckoutTimeoutMs = SUBSCRIPTION_CHECKOUT_TIMEOUT_MS,
  ) {
    this.sdk = sdk;
    this.subscriptionCheckoutTimeoutMs = subscriptionCheckoutTimeoutMs;
  }

  /** Provides init behavior. */
  async init() { try { await this.sdk.init({autoLoginReminders: false}); return success(undefined); } catch (e) { return failure(e); } }
  /** Gets player. */
  getPlayer() { return this.sdk.getPlayer(); }
  /** Gets player signed. */
  getPlayerSigned() { return this.sdk.getPlayerSigned(); }
  /** Provides login behavior. */
  async login(entryPayload?: Record<string, string>) {
    try {
      const player = this.getPlayer();
      if (player.registered) return success(player);
      await this.sdk.login(entryPayload ? {entryPayload} : undefined);
      return success(this.getPlayer());
    } catch (e) { return failure(e); }
  }
  /** Provides show registration overlay behavior. */
  showRegistrationOverlay(options: Parameters<JestPlatformPort["showRegistrationOverlay"]>[0]) {
    try {
      const handle = this.sdk.showRegistrationOverlay(options);
      return success({
        loginButtonAction: () => handle.loginButtonAction(),
        closeButtonAction: () => handle.closeButtonAction(),
      });
    } catch (e) {
      return failure(e);
    }
  }
  /** Reads preferences. */
  readPreferences(): JestPreferences {
    const data = this.sdk.data?.getAll?.() ?? {};
    return {
      locale: typeof data.locale === "string" ? data.locale : undefined,
      muted: typeof data.muted === "boolean" ? data.muted : undefined,
      reducedMotion: typeof data.reducedMotion === "boolean" ? data.reducedMotion : undefined,
      highContrast: typeof data.highContrast === "boolean" ? data.highContrast : undefined,
      onboardingComplete: typeof data.onboardingComplete === "boolean" ? data.onboardingComplete : undefined,
      registrationPromptDismissedAt:
        typeof data.registrationPromptDismissedAt === "number" ? data.registrationPromptDismissedAt : undefined,
      firstMilestoneMarked: typeof data.firstMilestoneMarked === "boolean" ? data.firstMilestoneMarked : undefined,
    };
  }
  /** Provides write preferences behavior. */
  async writePreferences(value: JestPreferences) { this.sdk.data.set(value); await this.sdk.data.flush(); }
  /** Reads player data. */
  async readPlayerData(): Promise<JestPlayerData | null> {
    const value: unknown = this.sdk.data?.getAll?.()?.[PLAYER_DATA_KEY];
    if (!isRecord(value) || value.schemaVersion !== 1 || typeof value.updatedAt !== "number") return null;
    const activeGame = value.activeGame === null ? null : parseSavedGame(value.activeGame);
    const {BridgeProfileSchema} = await import("@qwordly/core/bridge");
    const profile = BridgeProfileSchema.safeParse(value.profile);
    return {
      schemaVersion: 1,
      updatedAt: value.updatedAt,
      ...(profile.success ? {profile: profile.data} : {}),
      ...(value.activeGame === null || activeGame ? {activeGame} : {}),
    };
  }
  /** Provides write player data behavior. */
  async writePlayerData(value: JestPlayerData) {
    this.sdk.data.set(PLAYER_DATA_KEY, value);
    await this.sdk.data.flush();
  }
  /** Gets entry intent. */
  getEntryIntent() {
    return parseEntryIntent(this.sdk.getEntryPayload?.() ?? {}, globalThis.location?.search ?? "");
  }
  /** Gets profile. */
  async getProfile() { return this.sdk.social.getProfile({avatarSize: 128}) ?? null; }
  /** Provides schedule notification behavior. */
  async scheduleNotification(input: Parameters<JestPlatformPort["scheduleNotification"]>[0]) {
    if (!this.getPlayer().registered) return {status: "unavailable", message: "Registration is required"} as const;
    try { await this.sdk.notifications.scheduleNotification(input); return success(undefined); } catch (e) { return failure(e); }
  }
  /** Removes notification. */
  async removeNotification(identifier: string) {
    if (!this.getPlayer().registered) return {status: "unavailable", message: "Registration is required"} as const;
    try { await this.sdk.notifications.unscheduleNotification({identifier}); return success(undefined); } catch (e) { return failure(e); }
  }
  /** Provides share referral behavior. */
  async shareReferral(input: Parameters<JestPlatformPort["shareReferral"]>[0]) {
    try {
      const result = await this.sdk.referrals.shareReferralLink(input);
      return result?.canceled ? {status: "cancelled"} as const : success(undefined);
    } catch (e) { return failure(e); }
  }
  /** Lists referrals signed. */
  async listReferralsSigned() {
    try { const result = await this.sdk.referrals.listReferrals(); return success(result.referralsSigned); } catch (e) { return failure(e); }
  }
  /** Sets screenshot provider. */
  setScreenshotProvider(provider: ScreenshotProvider | null) { this.sdk.social.setScreenshotProvider(provider); }
  /** Gets products. */
  async getProducts() { try { return success(await this.sdk.payments.getProducts()); } catch (e) { return failure(e); } }
  /** Provides begin purchase behavior. */
  async beginPurchase(productSku: string) {
    try {
      const result = await this.sdk.payments.beginPurchase({productSku});
      if (result?.result === "cancel") return {status: "cancelled"} as const;
      if (result?.result === "error") {
        captureBrowserException(new Error(String(result.error)), {component: "jest_sdk", operation: "begin_purchase"});
        return result.error === "invalid_product"
          ? {status: "terminal-failure", message: result.error} as const
          : {status: "retryable-failure", message: String(result.error)} as const;
      }
      return success({purchase: result.purchase, purchaseSigned: result.purchaseSigned});
    } catch (e) { return failure(e); }
  }
  /** Gets incomplete purchases. */
  async getIncompletePurchases() { try { return success(await this.sdk.payments.getIncompletePurchases()); } catch (e) { return failure(e); } }
  /** Completes purchase. */
  async completePurchase(purchaseToken: string) {
    try {
      const result = await this.sdk.payments.completePurchase({purchaseToken});
      if (result?.result === "error") {
        captureBrowserException(new Error(String(result.error)), {component: "jest_sdk", operation: "complete_purchase"});
        return result.error === "invalid_token"
          ? {status: "terminal-failure", message: result.error} as const
          : {status: "retryable-failure", message: String(result.error)} as const;
      }
      return success(undefined);
    } catch (e) { return failure(e); }
  }
  /** Gets subscriptions. */
  async getSubscriptions() {
    try {
      const result = await this.sdk.payments.getSubscriptions();
      return success({
        subscriptions: result.subscriptions ?? [],
        subscriptionsSigned: result.subscriptionsSigned ?? result.signed,
      });
    } catch (e) { return failure(e); }
  }
  /** Provides begin subscription behavior. */
  async beginSubscription(subscriptionSku: string) {
    try {
      const result: any = await withTimeout<any>(
        this.sdk.payments.beginSubscription({subscriptionSku}),
        this.subscriptionCheckoutTimeoutMs,
        "Jest subscription checkout timed out",
      );
      if (result?.result === "cancel") return {status: "cancelled"} as const;
      if (result?.result === "error") {
        captureBrowserException(new Error(String(result.error)), {component: "jest_sdk", operation: "begin_subscription"});
        return result.error === "invalid_subscription"
          ? {status: "terminal-failure", message: result.error} as const
          : result.error === "guest_not_allowed" || result.error === "already_subscribed"
            ? {status: "unavailable", message: result.error} as const
            : {status: "retryable-failure", message: String(result.error)} as const;
      }
      return success({
        subscription: result.subscription,
        subscriptionSigned: result.subscriptionSigned,
      });
    } catch (e) { return failure(e); }
  }
  /** Captures event. */
  captureEvent(name: string, properties?: Record<string, string | number | boolean>) {
    this.sdk.captureEvent?.(name, properties);
  }
  /** Provides mark first milestone behavior. */
  async markFirstMilestone() {
    try { await this.sdk.markFirstMilestone(); return success(undefined); } catch (e) { return failure(e); }
  }
  /** Sets loading progress. */
  setLoadingProgress(progress: number) { this.sdk.setLoadingProgress(progress); }
  /** Provides mark game loaded behavior. */
  markGameLoaded() { this.sdk.markGameLoaded(); }
}
