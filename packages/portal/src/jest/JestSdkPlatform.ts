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
import {
  MAX_RIDDLE_ANSWER_CHARACTERS,
  type Feedback,
  type GameEngineSnapshot,
  type ScoredGuess,
} from "@qwordly/core/game";

/** Describes sdk. */
type Sdk = Record<string, any>;
/** Defines the player data key value. */
const PLAYER_DATA_KEY = "riddleQuestPlayerState";
/** Maximum guesses restored from low-integrity Jest player data. */
const MAX_SAVED_GUESSES = 6;
/** Exact client-writable SDK keys removed after authoritative account deletion. */
const PLAYER_STATE_KEYS = [
  "locale",
  "muted",
  "reducedMotion",
  "highContrast",
  "onboardingComplete",
  "registrationPromptDismissedAt",
  "firstMilestoneMarked",
  PLAYER_DATA_KEY,
] as const;
/** Defines the longest a platform subscription checkout may block the game UI. */
const SUBSCRIPTION_CHECKOUT_TIMEOUT_MS = 30_000;
/** Leaves enough time for a slow CDN while resolving before the outer startup watchdog. */
const JEST_SDK_LOAD_TIMEOUT_MS = 10_000;
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

/** Waits for the independently loaded Jest SDK without delaying the React startup shell. */
const waitForGlobalJestSdk = (timeoutMs: number): Promise<Sdk> => {
  const target = globalThis as typeof globalThis & {JestSDK?: Sdk};
  if (typeof target.JestSDK?.init === "function") return Promise.resolve(target.JestSDK);

  return new Promise((resolve, reject) => {
    const startedAt = Date.now();
    const check = () => {
      if (typeof target.JestSDK?.init === "function") {
        resolve(target.JestSDK);
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

/** Indicates whether is record. */
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Returns whether a value is a bounded non-empty string. */
const isBoundedString = (value: unknown, maxLength: number): value is string =>
  typeof value === "string" && value.length > 0 && value.length <= maxLength;

/** Returns whether a value is one supported per-letter feedback state. */
const isFeedback = (value: unknown): value is Feedback =>
  value === "green" || value === "yellow" || value === "red";

/** Parses bounded scored guesses for one known answer width. */
const parseScoredGuesses = (value: unknown, answerLength: number): ScoredGuess[] | null => {
  if (!Array.isArray(value) || value.length > MAX_SAVED_GUESSES) return null;
  const guesses: ScoredGuess[] = [];
  for (const candidate of value) {
    if (!isRecord(candidate) || !Array.isArray(candidate.guess) || !Array.isArray(candidate.feedback)) return null;
    if (candidate.guess.length !== answerLength || candidate.feedback.length !== answerLength) return null;
    if (!candidate.guess.every((letter) => typeof letter === "string" && letter.length <= 16)) return null;
    if (!candidate.feedback.every(isFeedback)) return null;
    guesses.push({guess: [...candidate.guess], feedback: [...candidate.feedback]});
  }
  return guesses;
};

/** Parses a bounded deterministic engine snapshot consistent with the restored guesses. */
const parseEngineSnapshot = (
  value: unknown,
  answerLength: number,
  restoredGuesses: ScoredGuess[],
): GameEngineSnapshot | null => {
  if (!isRecord(value)) return null;
  const guesses = parseScoredGuesses(value.guesses, answerLength);
  if (
    !guesses ||
    JSON.stringify(guesses) !== JSON.stringify(restoredGuesses) ||
    !Number.isInteger(value.attemptsUsed) ||
    (value.attemptsUsed as number) < 0 ||
    (value.attemptsUsed as number) > MAX_SAVED_GUESSES ||
    (value.attemptsUsed as number) < guesses.length ||
    typeof value.hasUsedContinue !== "boolean" ||
    typeof value.gameOver !== "boolean"
  ) return null;
  return {
    guesses,
    attemptsUsed: value.attemptsUsed as number,
    hasUsedContinue: value.hasUsedContinue,
    gameOver: value.gameOver,
  };
};

/** Parses a bounded keyboard-state map while discarding unknown object fields. */
const parseLetterStates = (value: unknown): Record<string, Feedback> | null => {
  if (!isRecord(value)) return null;
  const entries = Object.entries(value);
  if (entries.length > 64) return null;
  if (!entries.every(([letter, feedback]) => isBoundedString(letter, 16) && isFeedback(feedback))) return null;
  return Object.fromEntries(entries) as Record<string, Feedback>;
};

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
    !Number.isSafeInteger(value.savedAt) ||
    (value.savedAt as number) < 0 ||
    !isBoundedString(value.riddleId, 128) ||
    !isBoundedString(value.sessionToken, 128) ||
    value.sessionToken.length < 20 ||
    (value.gameMode !== "classic" && value.gameMode !== "challenge") ||
    !Array.isArray(value.currentLetters) ||
    value.currentLetters.length < 1 ||
    value.currentLetters.length > MAX_RIDDLE_ANSWER_CHARACTERS ||
    !value.currentLetters.every((letter) => typeof letter === "string" && letter.length <= 16) ||
    !Number.isInteger(value.activeSlotIndex) ||
    (value.activeSlotIndex as number) < 0 ||
    (value.activeSlotIndex as number) >= value.currentLetters.length ||
    !Array.isArray(value.hintRevealedIndices) ||
    value.hintRevealedIndices.length > value.currentLetters.length ||
    !value.hintRevealedIndices.every(
      (index) => Number.isInteger(index) && index >= 0 && index < (value.currentLetters as unknown[]).length,
    ) ||
    new Set(value.hintRevealedIndices).size !== value.hintRevealedIndices.length
  ) {
    return null;
  }
  const guesses = parseScoredGuesses(value.guesses, value.currentLetters.length);
  const engineSnapshot = guesses
    ? parseEngineSnapshot(value.engineSnapshot, value.currentLetters.length, guesses)
    : null;
  const letterStates = parseLetterStates(value.letterStates);
  if (!guesses || !engineSnapshot || !letterStates) return null;
  const inferredAwaitingContinue = !engineSnapshot.gameOver &&
    !engineSnapshot.hasUsedContinue &&
    engineSnapshot.attemptsUsed === 5;
  if (
    value.awaitingContinue !== undefined &&
    (typeof value.awaitingContinue !== "boolean" || value.awaitingContinue !== inferredAwaitingContinue)
  ) return null;
  let pendingOutcome: JestSavedGame["pendingOutcome"];
  if (value.pendingOutcome !== undefined) {
    const outcome = value.pendingOutcome;
    if (
      !isRecord(outcome) ||
      !isBoundedString(outcome.id, 256) ||
      (outcome.kind !== "win" && outcome.kind !== "loss") ||
      outcome.riddleId !== value.riddleId ||
      outcome.gameMode !== value.gameMode ||
      outcome.sessionToken !== value.sessionToken ||
      !Number.isInteger(outcome.attempts) ||
      (outcome.attempts as number) < 1 ||
      (outcome.attempts as number) > MAX_SAVED_GUESSES ||
      typeof outcome.isCorrect !== "boolean" ||
      (outcome.kind === "win") !== outcome.isCorrect
    ) return null;
    pendingOutcome = {
      id: outcome.id,
      kind: outcome.kind,
      riddleId: outcome.riddleId,
      gameMode: outcome.gameMode as "classic" | "challenge",
      sessionToken: outcome.sessionToken,
      attempts: outcome.attempts as number,
      isCorrect: outcome.isCorrect,
    };
  }
  return {
    schemaVersion: 1,
    savedAt: value.savedAt as number,
    riddleId: value.riddleId,
    sessionToken: value.sessionToken,
    gameMode: value.gameMode,
    currentLetters: [...value.currentLetters],
    activeSlotIndex: value.activeSlotIndex as number,
    hintRevealedIndices: [...value.hintRevealedIndices] as number[],
    guesses,
    engineSnapshot,
    awaitingContinue: inferredAwaitingContinue,
    letterStates,
    ...(pendingOutcome ? {pendingOutcome} : {}),
  };
};

/** Provides jest sdk platform behavior. */
export class JestSdkPlatform implements JestPlatformPort {
  /** Stores sdk. */
  private sdk: Sdk;
  /** Indicates that initialization must resolve the asynchronously loaded global SDK. */
  private readonly usesGlobalSdk: boolean;
  /** Stores the subscription checkout timeout. */
  private readonly subscriptionCheckoutTimeoutMs: number;
  /** Stores the SDK load timeout. */
  private readonly sdkLoadTimeoutMs: number;

  /** Creates a jest sdk platform instance. */
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

  /** Provides init behavior. */
  async init() {
    try {
      if (this.usesGlobalSdk) this.sdk = await waitForGlobalJestSdk(this.sdkLoadTimeoutMs);
      await this.sdk.init({autoLoginReminders: false});
      return success(undefined);
    } catch (error) {
      return failure(error);
    }
  }
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
    if (
      !isRecord(value) ||
      value.schemaVersion !== 1 ||
      !Number.isSafeInteger(value.updatedAt) ||
      (value.updatedAt as number) < 0
    ) return null;
    const activeGame = value.activeGame === null ? null : parseSavedGame(value.activeGame);
    const {BridgeProfileSchema} = await import("@qwordly/core/bridge");
    const profile = BridgeProfileSchema.safeParse(value.profile);
    return {
      schemaVersion: 1,
      updatedAt: value.updatedAt as number,
      ...(profile.success ? {profile: profile.data} : {}),
      ...(value.activeGame === null || activeGame ? {activeGame} : {}),
    };
  }
  /** Provides write player data behavior. */
  async writePlayerData(value: JestPlayerData) {
    this.sdk.data.set(PLAYER_DATA_KEY, value);
    await this.sdk.data.flush();
  }
  /** Clears client-writable state after the authoritative backend deletes the account. */
  async clearPlayerState() {
    PLAYER_STATE_KEYS.forEach((key) => this.sdk.data.delete(key));
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
