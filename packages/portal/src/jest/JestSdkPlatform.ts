import {parseEntryIntent} from "./entryIntent";
import type {JestPlatformPort, JestPreferences, PlatformResult, ScreenshotProvider} from "./types";

type Sdk = Record<string, any>;
const success = <T>(value: T): PlatformResult<T> => ({status: "success", value});
const failure = (error: unknown): PlatformResult<never> => {
  const message = error instanceof Error ? error.message : String(error);
  return /INVALID_ARGUMENTS|BAD_REQUEST|invalid sku/i.test(message)
    ? {status: "terminal-failure", message}
    : {status: "retryable-failure", message};
};

export class JestSdkPlatform implements JestPlatformPort {
  constructor(private readonly sdk: Sdk = (globalThis as typeof globalThis & {JestSDK?: Sdk}).JestSDK ?? {}) {}

  async init() { try { await this.sdk.init({autoLoginReminders: false}); return success(undefined); } catch (e) { return failure(e); } }
  getPlayer() { return this.sdk.getPlayer(); }
  getPlayerSigned() { return this.sdk.getPlayerSigned(); }
  async login() {
    try { await this.sdk.login(); return success(this.getPlayer()); } catch (e) { return failure(e); }
  }
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
  async writePreferences(value: JestPreferences) { this.sdk.data.set(value); await this.sdk.data.flush(); }
  getEntryIntent() { return parseEntryIntent(this.sdk.getEntryPayload?.() ?? {}); }
  async getProfile() { return this.sdk.social.getProfile({avatarSize: 128}) ?? null; }
  async scheduleNotification(input: Parameters<JestPlatformPort["scheduleNotification"]>[0]) {
    if (!this.getPlayer().registered) return {status: "unavailable", message: "Registration is required"} as const;
    try { await this.sdk.notifications.scheduleNotification(input); return success(undefined); } catch (e) { return failure(e); }
  }
  async removeNotification(identifier: string) {
    try { await this.sdk.notifications.unscheduleNotification({identifier}); return success(undefined); } catch (e) { return failure(e); }
  }
  async shareReferral(input: Parameters<JestPlatformPort["shareReferral"]>[0]) {
    try {
      const result = await this.sdk.referrals.shareReferralLink(input);
      return result?.canceled ? {status: "cancelled"} as const : success(undefined);
    } catch (e) { return failure(e); }
  }
  async listReferralsSigned() {
    try { const result = await this.sdk.referrals.listReferrals(); return success(result.referralsSigned); } catch (e) { return failure(e); }
  }
  setScreenshotProvider(provider: ScreenshotProvider | null) { this.sdk.social.setScreenshotProvider(provider); }
  async getProducts() { try { return success(await this.sdk.payments.getProducts()); } catch (e) { return failure(e); } }
  async beginPurchase(productSku: string) {
    try {
      const result = await this.sdk.payments.beginPurchase({productSku});
      if (result?.result === "cancel") return {status: "cancelled"} as const;
      if (result?.result === "error") {
        return result.error === "invalid_product"
          ? {status: "terminal-failure", message: result.error} as const
          : {status: "retryable-failure", message: String(result.error)} as const;
      }
      return success({purchase: result.purchase, purchaseSigned: result.purchaseSigned});
    } catch (e) { return failure(e); }
  }
  async getIncompletePurchases() { try { return success(await this.sdk.payments.getIncompletePurchases()); } catch (e) { return failure(e); } }
  async completePurchase(purchaseToken: string) {
    try {
      const result = await this.sdk.payments.completePurchase({purchaseToken});
      if (result?.result === "error") {
        return result.error === "invalid_token"
          ? {status: "terminal-failure", message: result.error} as const
          : {status: "retryable-failure", message: String(result.error)} as const;
      }
      return success(undefined);
    } catch (e) { return failure(e); }
  }
  async markFirstMilestone() {
    try { await this.sdk.markFirstMilestone(); return success(undefined); } catch (e) { return failure(e); }
  }
  setLoadingProgress(progress: number) { this.sdk.setLoadingProgress(progress); }
  markGameLoaded() { this.sdk.markGameLoaded(); }
}
