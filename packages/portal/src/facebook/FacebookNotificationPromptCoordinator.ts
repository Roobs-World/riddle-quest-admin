import type {NotificationCapability, PlatformStorage} from "../platform/types";
import {
  recordFacebookNotificationPrompt,
  shouldPromptForFacebookNotifications,
  type FacebookNotificationPromptState,
} from "./FacebookNotificationPromptPolicy";

/** Describes facebook notification prompt outcome. */
export type FacebookNotificationPromptOutcome = "not-eligible" | "accepted" | "declined";

/** Describes notification prompt lock. */
type NotificationPromptLock = <Result>(operation: () => Promise<Result>) => Promise<Result>;
/** Describes facebook notification prompt lease. */
export type FacebookNotificationPromptLease = Readonly<{
  claim(): Promise<{granted: false} | {granted: true; claimedAtMs: number}>;
  accept(): Promise<void>;
}>;
/** Defines the facebook notification prompt lock value. */
const FACEBOOK_NOTIFICATION_PROMPT_LOCK = "riddleQuest:facebookNotificationPrompt:v1";

/** Provides run with browser prompt lock behavior. */
const runWithBrowserPromptLock: NotificationPromptLock = async (operation) => {
  const locks = globalThis.navigator?.locks;
  return locks
    ? locks.request(FACEBOOK_NOTIFICATION_PROMPT_LOCK, {mode: "exclusive"}, operation)
    : operation();
};

/** Serializes and persists notification permission prompts triggered by authoritative wins. */
export class FacebookNotificationPromptCoordinator {
  /** Stores in flight. */
  private inFlight: Promise<FacebookNotificationPromptOutcome> | null = null;
  /** Stores storage. */
  private readonly storage: PlatformStorage;
  /** Stores capability. */
  private readonly capability: NotificationCapability;
  /** Stores now. */
  private readonly now: () => number;
  /** Stores run exclusive. */
  private readonly runExclusive: NotificationPromptLock;
  /** Stores lease. */
  private readonly lease: FacebookNotificationPromptLease | undefined;

  /** Creates a facebook notification prompt coordinator instance. */
  public constructor(
    storage: PlatformStorage,
    capability: NotificationCapability,
    now: () => number = Date.now,
    runExclusive: NotificationPromptLock = runWithBrowserPromptLock,
    lease?: FacebookNotificationPromptLease,
  ) {
    this.storage = storage;
    this.capability = capability;
    this.now = now;
    this.runExclusive = runExclusive;
    this.lease = lease;
  }

  /** Prompts at most once per persisted weekly window, even when completions race. */
  public afterAuthoritativeCompletion(won: boolean): Promise<FacebookNotificationPromptOutcome> {
    if (!won) return Promise.resolve("not-eligible");
    this.inFlight ??= this.runExclusive(() => this.run()).finally(() => {
      this.inFlight = null;
    });
    return this.inFlight;
  }

  /** Provides run behavior. */
  private async run(): Promise<FacebookNotificationPromptOutcome> {
    const preferences = await this.storage.readPreferences();
    const state: FacebookNotificationPromptState = {
      permission: preferences.facebookNotificationPermission ?? "unknown",
      ...(preferences.facebookNotificationLastPromptAtMs === undefined
        ? {}
        : {lastPromptAtMs: preferences.facebookNotificationLastPromptAtMs}),
    };
    const nowMs = this.now();
    if (!shouldPromptForFacebookNotifications({
      authoritativeWins: 1,
      capabilityAvailable: true,
      state,
      nowMs,
    })) return "not-eligible";

    const claim = this.lease ? await this.lease.claim() : {granted: true as const, claimedAtMs: nowMs};
    if (!claim.granted) return "not-eligible";
    // Persist the server-authorized attempt before opening platform UI so crashes cannot cause prompt loops.
    const attempted = recordFacebookNotificationPrompt(state, "declined", claim.claimedAtMs);
    await this.persist(attempted);
    const result = await this.capability.requestPermission();
    if (result.status !== "success") return "declined";
    await this.lease?.accept();
    await this.persist(recordFacebookNotificationPrompt(attempted, "accepted", claim.claimedAtMs));
    return "accepted";
  }

  /** Provides persist behavior. */
  private async persist(
    state: FacebookNotificationPromptState,
  ): Promise<void> {
    // Platform prompts may remain open while another setting is changed. Merge
    // into the latest cloud snapshot so permission persistence cannot roll it back.
    const preferences = await this.storage.readPreferences();
    await this.storage.writePreferences({
      ...preferences,
      facebookNotificationPermission: state.permission,
      facebookNotificationLastPromptAtMs: state.lastPromptAtMs,
    });
    await this.storage.flush();
  }
}
