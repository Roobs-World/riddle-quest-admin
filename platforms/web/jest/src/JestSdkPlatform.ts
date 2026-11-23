import {parseEntryIntent} from "./entryIntent";
import type {JestPlatformPort, JestPlayerData, JestPreferences, PlatformResult, ScreenshotProvider} from "./types";
import {captureBrowserException} from "../../../../src/observability/browserErrorReporter";
import {isValidNotificationAsset} from "./notifications/inlineAsset";
import {invokeSdkOperation, type JestSdkBoundary} from "./sdkBoundary";

/** Describes sdk. */
type Sdk = JestSdkBoundary;
/** Defines the player data key value. */
const PLAYER_DATA_KEY = "riddleQuestPlayerState";
/** Exact client-writable SDK keys removed after authoritative account deletion. */
const PLAYER_STATE_KEYS = [
  "locale",
  "muted",
  "reducedMotion",
  "highContrast",
  "presenceEnabled",
  "onboardingComplete",
  "registrationPromptDismissedAt",
  "firstMilestoneMarked",
  "jestGuestCompletedRiddles",
  PLAYER_DATA_KEY,
] as const;
/** Bounds subscription cancellation confirmation, which cannot create a new charge. */
const SUBSCRIPTION_CHECKOUT_TIMEOUT_MS = 30_000;
/** Bounds provider reads and acknowledgments required for startup purchase recovery. */
const PURCHASE_RECOVERY_TIMEOUT_MS = 15_000;
/** Leaves enough time for a slow CDN while resolving before the outer startup watchdog. */
const JEST_SDK_LOAD_TIMEOUT_MS = 10_000;
/** Provides success behavior. */
const success = <T>(value: T): PlatformResult<T> => ({status: "success", value});
/** Provides failure behavior. */
const failure = (error: unknown, context: Record<string, string> = {}): PlatformResult<never> => {
  captureBrowserException(error, {component: "jest_sdk", ...context});
  /** Provides message behavior. */
  const message = error instanceof Error ? error.message : String(error);
  return /INVALID_ARGUMENTS|BAD_REQUEST|invalid sku/i.test(message)
    ? {status: "terminal-failure", message}
    : {status: "retryable-failure", message};
};

/** Waits for the independently loaded Jest SDK without delaying the React startup shell. */
const waitForGlobalJestSdk = (timeoutMs: number): Promise<Sdk> => {
  /** The provider's declaration describes its browser singleton. */
  const getGlobalSdk = () => typeof JestSDK === "undefined" ? undefined : JestSDK;
  /** Singleton already present before polling begins. */
  const sdk = getGlobalSdk();
  if (typeof sdk?.init === "function") return Promise.resolve(sdk);

  return new Promise((resolve, reject) => {
    /** Starts ed at. */
    const startedAt = Date.now();
    /** Provides check behavior. */
    const check = () => {
      /** Singleton observed on this poll, which may have loaded since startup. */
      const loadedSdk = getGlobalSdk();
      if (typeof loadedSdk?.init === "function") {
        resolve(loadedSdk);
        return;
      }
      if (Date.now() - startedAt >= timeoutMs) {
        reject(new Error("Jest SDK failed to load."));
        return;
      }
      setTimeout(check, 25);
    };
    check();
  });
};

/** Rejects an SDK operation that does not settle before its UI timeout. */
const withTimeout = async <T>(operation: Promise<T>, timeoutMs: number, message: string): Promise<T> => {
  /** Provides timeout id behavior. */
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

/** Retries one exact provider-negative payment read within the existing recovery budget. */
const readPaymentData = async <T>({read, providerRejection, timeoutMessage}: {
  /** Reads provider state without opening checkout or acknowledging a receipt. */
  read: () => Promise<T>;
  /** Exact plain Error message emitted by the current SDK for a negative parent reply. */
  providerRejection: string;
  /** Identifies the read whose shared deadline expired. */
  timeoutMessage: string;
}): Promise<T> => {
  /** Prevents late provider settlement from starting another read. */
  let active = true;
  /** Both attempts consume one recovery budget. */
  const deadline = Date.now() + PURCHASE_RECOVERY_TIMEOUT_MS;
  /** Returns the first successful read or retries its exact provider-negative reply once. */
  const attempt = async () => {
    try {
      return await read();
    } catch (error) {
      if (!active || Date.now() >= deadline || !(error instanceof Error) || error.name !== "Error" ||
        error.message !== providerRejection) throw error;
      return read();
    }
  };
  try {
    return await withTimeout(attempt(), PURCHASE_RECOVERY_TIMEOUT_MS, timeoutMessage);
  } finally {
    active = false;
  }
};

/**
 * Production adapter that confines the dynamically loaded Jest SDK behind
 * {@link JestPlatformPort}.
 *
 * @remarks
 * Result-returning operations convert provider exceptions into stable failure
 * categories. Signed identity, referral, purchase, and subscription payloads are
 * passed through untouched for server-side verification; this adapter never
 * grants currency or entitlements.
 */
export class JestSdkPlatform implements JestPlatformPort {
  /** Stores sdk. */
  private sdk: Sdk;
  /** Indicates that initialization must resolve the asynchronously loaded global SDK. */
  private readonly usesGlobalSdk: boolean;
  /** Stores the subscription cancellation confirmation timeout. */
  private readonly subscriptionCheckoutTimeoutMs: number;
  /** Stores the SDK load timeout. */
  private readonly sdkLoadTimeoutMs: number;

  /**
   * Creates a Jest SDK adapter with bounded provider waits.
   *
   * @param sdk - Injected SDK for tests, or `undefined` to wait for `globalThis.JestSDK`.
   * @param subscriptionCheckoutTimeoutMs - Cancellation confirmation deadline; defaults to 30 seconds.
   * @param sdkLoadTimeoutMs - Global SDK discovery deadline; defaults to 10 seconds.
   */
  constructor(
    sdk?: Sdk,
    subscriptionCheckoutTimeoutMs = SUBSCRIPTION_CHECKOUT_TIMEOUT_MS,
    sdkLoadTimeoutMs = JEST_SDK_LOAD_TIMEOUT_MS,
  ) {
    this.usesGlobalSdk = sdk === undefined;
    this.sdk = sdk ?? {};
    this.subscriptionCheckoutTimeoutMs = subscriptionCheckoutTimeoutMs;
    this.sdkLoadTimeoutMs = sdkLoadTimeoutMs;
  }

  /** Rejects absent injected modules before an operation is attempted. */
  private getSdkModule<Key extends "data" | "notifications" | "social" | "referrals" | "payments">(
    key: Key,
  ): NonNullable<Sdk[Key]> {
    /** Requested provider module, narrowed before any method is called. */
    const module = this.sdk[key];
    if (!module) throw new Error(`Jest SDK ${key} module is unavailable.`);
    return module;
  }

  /**
   * Waits for the independently loaded SDK and disables duplicate platform registration reminders.
   *
   * @returns `success` once SDK calls are safe, or a normalized provider/load failure.
   */
  async init() {
    try {
      if (this.usesGlobalSdk) this.sdk = await waitForGlobalJestSdk(this.sdkLoadTimeoutMs);
      await invokeSdkOperation(this.sdk, this.sdk.init, {autoLoginReminders: false});
      return success(undefined);
    } catch (error) {
      return failure(error);
    }
  }
  /** @returns The current target-scoped player projection directly from Jest. */
  getPlayer() {
    return invokeSdkOperation(this.sdk, this.sdk.getPlayer);
  }
  /** @returns The player projection and opaque signed identity envelope for backend exchange. */
  getPlayerSigned() {
    return invokeSdkOperation(this.sdk, this.sdk.getPlayerSigned);
  }
  /**
   * Opens Jest login only when the current player is not already registered.
   *
   * @param entryPayload - Optional sanitized attribution forwarded to the provider.
   * @returns The current or newly registered player, cancellation, or normalized failure.
   */
  async login(entryPayload?: Record<string, string>) {
    try {
      /** Provides player behavior. */
      const player = this.getPlayer();
      if (player.registered) return success(player);
      await invokeSdkOperation(this.sdk, this.sdk.login, entryPayload ? {entryPayload} : undefined);
      return success(this.getPlayer());
    } catch (e) {
      return failure(e);
    }
  }
  /**
   * Wraps Jest's provider-owned registration overlay in a narrow imperative handle.
   *
   * @param options - Theme, entry attribution, and completion callback.
   * @returns Overlay controls or a normalized synchronous provider failure.
   */
  showRegistrationOverlay(options: Parameters<JestPlatformPort["showRegistrationOverlay"]>[0]) {
    try {
      /** Provides handle behavior. */
      const handle = invokeSdkOperation(this.sdk, this.sdk.showRegistrationOverlay, options);
      return success({
        loginButtonAction: () => handle.loginButtonAction(),
        closeButtonAction: () => handle.closeButtonAction(),
      });
    } catch (e) {
      return failure(e);
    }
  }
  /**
   * Reads only known, correctly typed preference keys from client-writable SDK data.
   *
   * @returns A partial preference projection; malformed and unknown fields are omitted.
   */
  readPreferences(): JestPreferences {
    /** Provides data behavior. */
    const data = this.sdk.data?.getAll?.() ?? {};
    return {
      locale: typeof data.locale === "string" ? data.locale : undefined,
      muted: typeof data.muted === "boolean" ? data.muted : undefined,
      reducedMotion: typeof data.reducedMotion === "boolean" ? data.reducedMotion : undefined,
      highContrast: typeof data.highContrast === "boolean" ? data.highContrast : undefined,
      presenceEnabled: typeof data.presenceEnabled === "boolean" ? data.presenceEnabled : undefined,
      onboardingComplete: typeof data.onboardingComplete === "boolean" ? data.onboardingComplete : undefined,
      registrationPromptDismissedAt:
        typeof data.registrationPromptDismissedAt === "number" ? data.registrationPromptDismissedAt : undefined,
      firstMilestoneMarked: typeof data.firstMilestoneMarked === "boolean" ? data.firstMilestoneMarked : undefined,
      jestGuestCompletedRiddles: typeof data.jestGuestCompletedRiddles === "number" && Number.isSafeInteger(data.jestGuestCompletedRiddles) && data.jestGuestCompletedRiddles >= 0
        ? data.jestGuestCompletedRiddles : undefined,
    };
  }
  /**
   * Writes the supplied app-owned preferences and waits for the SDK flush.
   *
   * @param value - Validated partial preference projection.
   */
  async writePreferences(value: JestPreferences) {
    /** Provider storage module used to persist preference changes. */
    const data = this.getSdkModule("data");
    data.set({...value});
    await data.flush();
  }
  /**
   * Parses the app-owned versioned snapshot from untrusted SDK storage.
   *
   * @returns The bounded snapshot, or `null` when absent or malformed.
   */
  async readPlayerData(): Promise<JestPlayerData | null> {
    /** Provides value behavior. */
    const value: unknown = this.sdk.data?.getAll?.()?.[PLAYER_DATA_KEY];
    if (value === null || value === undefined) return null;
    return (await import("../../../../src/accounts/browser/playerState/playerDataValidation")).parsePlayerData(value);
  }
  /**
   * Replaces the app-owned player snapshot and waits for the SDK flush.
   *
   * @param value - Complete versioned client snapshot; it carries no economy authority.
   */
  async writePlayerData(value: JestPlayerData) {
    /** Provider storage module used to replace the client progress snapshot. */
    const data = this.getSdkModule("data");
    data.set(PLAYER_DATA_KEY, value);
    await data.flush();
  }
  /**
   * Deletes every known app-owned SDK key and flushes after authoritative account deletion.
   *
   * @remarks
   * The exact allowlist avoids erasing provider-owned data or keys belonging to another app.
   */
  async clearPlayerState() {
    /** Provider storage module used to erase the app-owned keys. */
    const data = this.getSdkModule("data");
    PLAYER_STATE_KEYS.forEach((key) => data.delete(key));
    await data.flush();
  }
  /** @returns Sanitized provider entry data merged with approved launch-query attribution. */
  getEntryIntent() {
    return parseEntryIntent(this.sdk.getEntryPayload?.() ?? {}, globalThis.location?.search ?? "");
  }
  /** @returns A 128-pixel provider display profile, or `null` when unavailable. */
  async getProfile() {
    return this.getSdkModule("social").getProfile({avatarSize: 128}) ?? null;
  }
  /**
   * Schedules provider notification content for a registered player.
   *
   * @param input - Localized content and exactly one relative or absolute delivery time.
   * @returns `unavailable` for guests, otherwise a normalized provider result.
   */
  async scheduleNotification(input: Parameters<JestPlatformPort["scheduleNotification"]>[0]) {
    if (!this.getPlayer().registered) return {status: "unavailable", message: "Registration is required"} as const;
    try {
      if (input.asset !== undefined && (input.assetReference !== undefined || !isValidNotificationAsset(input.asset))) {
        throw new Error("INVALID_ARGUMENTS: notification asset must be a PNG, JPEG, or WebP data URL up to 2MB encoded or an HTTPS URL up to 2048 characters, and cannot accompany assetReference");
      }
      await this.getSdkModule("notifications").scheduleNotification(input);
      return success(undefined);
    } catch (e) {
      return failure(e);
    }
  }
  /**
   * Unschedules one provider notification for a registered player.
   *
   * @param identifier - Stable identifier used when the notification was created.
   * @returns `unavailable` for guests, otherwise a normalized provider result.
   */
  async removeNotification(identifier: string) {
    if (!this.getPlayer().registered) return {status: "unavailable", message: "Registration is required"} as const;
    try {
      await this.getSdkModule("notifications").unscheduleNotification({identifier});
      return success(undefined);
    } catch (e) {
      return failure(e);
    }
  }
  /**
   * Opens the Jest referral-share surface with target-owned attribution.
   *
   * @returns `cancelled` when the player dismisses the share UI, not a failure.
   */
  async shareReferral(input: Parameters<JestPlatformPort["shareReferral"]>[0]) {
    try {
      /** Provides result behavior. */
      const result = await this.getSdkModule("referrals").shareReferralLink(input);
      return result?.canceled ? ({status: "cancelled"} as const) : success(undefined);
    } catch (e) {
      return failure(e);
    }
  }
  /** @returns Jest's opaque signed referral list for authoritative backend verification. */
  async listReferralsSigned() {
    try {
      /** Provides result behavior. */
      const result = await this.getSdkModule("referrals").listReferrals();
      return success(result.referralsSigned);
    } catch (e) {
      return failure(e);
    }
  }
  /** Registers or removes the lazy screenshot callback consumed by Jest sharing. */
  setScreenshotProvider(provider: ScreenshotProvider | null) {
    this.getSdkModule("social").setScreenshotProvider(provider);
  }
  /** @returns Provider-priced consumables for display; no client-side grant is implied. */
  async getProducts() {
    try {
      /** Provider catalog whose nullable descriptions are normalized for game display. */
      const products = await readPaymentData({
        read: () => this.getSdkModule("payments").getProducts(),
        providerRejection: "Failed to fetch products",
        timeoutMessage: "Jest product catalog read timed out",
      });
      return success(products.map((product) => ({...product, description: product.description ?? undefined})));
    } catch (e) {
      return failure(e);
    }
  }
  /**
   * Opens a consumable checkout and preserves its signed envelope for backend granting.
   *
   * @param productSku - Exact SKU returned by {@link getProducts}.
   * @returns `cancelled` for dismissal, terminal failure for an invalid SKU, or signed purchase data.
   */
  async beginPurchase(productSku: string) {
    try {
      /** Provides result behavior. */
      const result = await this.getSdkModule("payments").beginPurchase({productSku});
      if (result?.result === "cancel") return {status: "cancelled"} as const;
      if (result?.result === "error") {
        captureBrowserException(new Error(String(result.error)), {component: "jest_sdk", operation: "begin_purchase"});
        return result.error === "invalid_product"
          ? ({status: "terminal-failure", message: result.error} as const)
          : ({status: "retryable-failure", message: String(result.error)} as const);
      }
      return success({purchase: result.purchase, purchaseSigned: result.purchaseSigned});
    } catch (e) {
      return failure(e);
    }
  }
  /**
   * Retrieves purchases that still require authoritative grant or provider completion.
   *
   * @returns Provider purchase data and its opaque aggregate signature.
   */
  async getIncompletePurchases() {
    try {
      return success(await readPaymentData({
        read: () => this.getSdkModule("payments").getIncompletePurchases(),
        providerRejection: "Failed to fetch incomplete purchases",
        timeoutMessage: "Jest incomplete purchase read timed out",
      }));
    } catch (e) {
      return failure(e);
    }
  }
  /**
   * Marks a purchase complete only after its server-authoritative grant has succeeded.
   *
   * @param purchaseToken - Exact token associated with the granted purchase.
   * @returns Terminal failure for an invalid token; transient SDK errors remain retryable.
   */
  async completePurchase(purchaseToken: string) {
    try {
      /** Provides result behavior. */
      const result = await withTimeout(
        this.getSdkModule("payments").completePurchase({purchaseToken}),
        PURCHASE_RECOVERY_TIMEOUT_MS,
        "Jest purchase completion timed out",
      );
      if (result?.result === "error") {
        captureBrowserException(new Error(String(result.error)), {
          component: "jest_sdk",
          operation: "complete_purchase",
        });
        return result.error === "invalid_token"
          ? ({status: "terminal-failure", message: result.error} as const)
          : ({status: "retryable-failure", message: String(result.error)} as const);
      }
      return success(undefined);
    } catch (e) {
      return failure(e);
    }
  }
  /**
   * Reads subscription state without trusting it as an entitlement grant.
   *
   * @returns Normalized subscriptions and an opaque signature for backend synchronization.
   */
  async getSubscriptions() {
    try {
      /** Provides result behavior. */
      const result = await readPaymentData({
        read: () => this.getSdkModule("payments").getSubscriptions(),
        providerRejection: "Failed to fetch subscriptions",
        timeoutMessage: "Jest subscription catalog read timed out",
      });
      return success({
        subscriptions: result.subscriptions,
        subscriptionsSigned: result.signed,
      });
    } catch (e) {
      return failure(e);
    }
  }
  /**
   * Opens a subscription checkout and waits until the provider settles it.
   *
   * @param subscriptionSku - Exact provider subscription SKU.
   * @returns Signed subscription data, cancellation, unavailability, or normalized failure.
   *
   * @remarks
   * The checkout lock must outlive provider billing, so no local deadline releases it.
   * Guest and already-subscribed outcomes are `unavailable`; an invalid subscription is terminal.
   */
  async beginSubscription(subscriptionSku: string) {
    try {
      /** Provides result behavior. */
      const result = await this.getSdkModule("payments").beginSubscription({subscriptionSku});
      if (result?.result === "cancel") return {status: "cancelled"} as const;
      if (result?.result === "error") {
        captureBrowserException(new Error(String(result.error)), {
          component: "jest_sdk",
          operation: "begin_subscription",
        });
        return result.error === "invalid_subscription"
          ? ({status: "terminal-failure", message: result.error} as const)
          : result.error === "guest_not_allowed" || result.error === "already_subscribed"
            ? ({status: "unavailable", message: result.error} as const)
            : ({status: "retryable-failure", message: String(result.error)} as const);
      }
      return success({
        subscription: result.subscription,
        subscriptionSigned: result.subscriptionSigned,
      });
    } catch (e) {
      return failure(e);
    }
  }
  /** Opens the provider confirmation; success schedules expiry without revoking access. */
  async cancelSubscription(subscriptionSku: string): Promise<PlatformResult<void>> {
    try {
      /** Bounds the cancellation confirmation wait. */
      const result = await withTimeout(
        this.getSdkModule("payments").cancelSubscription({subscriptionSku}),
        this.subscriptionCheckoutTimeoutMs,
        "Jest subscription cancellation timed out",
      );
      if (result?.result === "success") return success(undefined);
      if (result?.result === "cancel") return {status: "cancelled"};
      /** Normalizes missing or provider-specific failure codes. */
      const message = String(result?.error ?? "invalid_response");
      /** Reports only documented codes, never opaque provider payloads. */
      const reason = ["not_found", "not_active", "guest_not_allowed", "internal_error", "invalid_response"].includes(message)
        ? message : "unknown_provider_error";
      if (message !== "not_active") captureBrowserException(new Error("Jest subscription cancellation failed"), {
        component: "jest_sdk", operation: "cancel_subscription", reason,
      });
      if (message === "not_found") return {status: "terminal-failure", message};
      if (message === "not_active" || message === "guest_not_allowed") return {status: "unavailable", message};
      return {status: "retryable-failure", message};
    } catch (error) {
      return failure(error, {
        operation: "cancel_subscription",
        reason: error instanceof Error && error.message === "Jest subscription cancellation timed out"
          ? "timeout" : "exception",
      });
    }
  }
  /**
   * Sends one low-cardinality event when the optional SDK analytics hook exists.
   *
   * @param name - Stable event name.
   * @param properties - Primitive, non-sensitive event dimensions.
   */
  captureEvent(name: string, properties?: import("../../../../src/observability/analytics/events").SanitizedAnalyticsParams) {
    this.sdk.captureEvent?.(name, properties);
  }
  /** @returns The normalized result of the provider's idempotent first-milestone signal. */
  async markFirstMilestone() {
    try {
      await invokeSdkOperation(this.sdk, this.sdk.markFirstMilestone);
      return success(undefined);
    } catch (e) {
      return failure(e);
    }
  }
  /** Reports startup progress to Jest on the inclusive 0-100 scale. */
  setLoadingProgress(progress: number) {
    invokeSdkOperation(this.sdk, this.sdk.setLoadingProgress, progress);
  }
  /** Dismisses the provider loading surface after the game becomes interactive. */
  markGameLoaded() {
    invokeSdkOperation(this.sdk, this.sdk.markGameLoaded);
  }
}
