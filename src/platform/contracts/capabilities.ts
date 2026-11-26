import type {BridgeProfile} from "../bridge/messages";
export type {PlatformResult} from "../../races/controllers/matchmaking";
import type {PlatformResult, MatchmakingCapability} from "../../races/controllers/matchmaking";
export type {MatchmakingResult, MatchmakingCapability} from "../../races/controllers/matchmaking";

/** Jest SDK preferences restored before gameplay mounts. */
export type PlatformPreferences = {
  /** Provider-stored language tag, validated against supported locales before use. */
  locale?: string;
  /** Player-selected game mute state when the platform does not own master audio. */
  muted?: boolean;
  /** Player-selected reduced-motion accessibility preference. */
  reducedMotion?: boolean;
  /** Master preference for game reminders and challenge notifications; absent means on. */
  notificationsEnabled?: boolean;
  /** Indicates that the shared first-run onboarding flow has completed. */
  onboardingComplete?: boolean;
  /** Unix epoch milliseconds of the latest dismissed registration prompt. */
  registrationPromptDismissedAt?: number;
  /** Records historical milestone completion; Jest deduplicates SDK reporting per session. */
  firstMilestoneMarked?: boolean;
  /** Number of authoritative riddles solved while playing as a Jest guest. */
  jestGuestCompletedRiddles?: number;
  /** Explicit player consent for account-wide presence publication. */
  presenceEnabled?: boolean;
};

export type {SavedGame} from "../../gameplay/session/checkpoints/savedGame";
import type {SavedGame} from "../../gameplay/session/checkpoints/savedGame";

/** Versioned client-owned player projection persisted by a platform adapter. */
export type PlayerData = {
  /** Storage schema discriminator for safe future migration. */
  schemaVersion: 1;
  /** Unix epoch milliseconds of the latest assembled projection. */
  updatedAt: number;
  /** Cached profile used for startup rendering while authoritative data loads. */
  profile?: BridgeProfile;
  /** Resumable game, explicit absence, or an omitted field from older storage. */
  activeGame?: SavedGame | null;
};

/** Client-writable portion merged into a new versioned {@link PlayerData} snapshot. */
export type PlayerDataUpdate = Pick<PlayerData, "profile" | "activeGame">;

/** Optional guest-to-registered-account flow supplied by the active platform. */
export type AccountUpgradeCapability = {
  /** Whether registration can begin or has already completed. */
  state: "available" | "complete";
  /** @returns The normalized registration outcome without exposing provider errors. */
  begin(): Promise<PlatformResult<void>>;
};


/** Integrations supplied by the authenticated Jest session. */
export type PlatformCapabilities = {
  /** Guest registration state used to gate account operations. */
  accountUpgrade?: AccountUpgradeCapability;
  /** Server-authoritative opponent search and live play. */
  matchmaking?: MatchmakingCapability;
};
