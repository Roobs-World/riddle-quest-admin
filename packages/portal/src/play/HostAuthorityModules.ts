import type {PlatformCapabilities} from "../platform/types";
import type {HostServices} from "./types";

/** Capability-shaped authority modules exposed to hosted play. */
export type HostAuthorityModules = Readonly<{
  /** Stores identity. */
  identity: Pick<HostServices, "auth" | "loadProfile">;
  /** Stores gameplay. */
  gameplay: Pick<
    HostServices,
    "loadRiddle" | "preloadInitialRiddles" | "loadProfile" | "completeGame" | "submitGuess" | "skipRiddle"
  >;
  /** Read-only public ranking authority available independently of account management. */
  leaderboard: Pick<HostServices, "loadLeaderboard">;
  /** Stores economy. */
  economy?: Pick<HostServices, "requestHint" | "spendCoins">;
  /** Stores commerce. */
  commerce?: Pick<HostServices, "requestPurchase" | "products">;
  /** Stores account. */
  account?: Partial<Pick<HostServices, "updateUsername" | "updateAvatar" | "deleteAccount">>;
  /** Stores race. */
  race?: Pick<
    HostServices,
    | "listRaceCategories"
    | "startRace"
    | "readyRace"
    | "submitRaceGuess"
    | "requestRaceHint"
    | "skipRaceRiddle"
    | "resumeRace"
    | "abandonRace"
    | "publishRace"
    | "reserveRaceInvite"
    | "getRaceChallenge"
    | "getRaceOutcome"
    | "listRaceInbox"
    | "blockRival"
    | "reportRival"
    | "getRaceAccess"
    | "recordRaceAnalytics"
  >;
}>;

/** Concentrates authority availability so Capability Gaps are absent modules. */
export function createHostAuthorityModules(
  services: HostServices,
  capabilities: PlatformCapabilities | undefined,
  commerceAvailable = capabilities?.commerce !== undefined,
  economyAvailable = true,
  raceAvailable = Boolean(capabilities?.matchmaking || capabilities?.tournaments || capabilities?.contextBoard),
): HostAuthorityModules {
  /** Provides authenticated behavior. */
  const authenticated = capabilities?.accountUpgrade?.state === "complete";
  /** Target-owned account permissions independent of guest registration. */
  const permissions = capabilities?.accountManagement;
  /** Only expose operations approved for this target or registered Jest session. */
  const account = authenticated
    ? services
    : permissions
      ? {
          ...(permissions.username ? {updateUsername: services.updateUsername} : {}),
          ...(permissions.avatar ? {updateAvatar: services.updateAvatar} : {}),
          ...(permissions.deletion ? {deleteAccount: services.deleteAccount} : {}),
        }
      : undefined;
  return {
    identity: services,
    gameplay: services,
    leaderboard: services,
    ...(economyAvailable ? {economy: services} : {}),
    ...(commerceAvailable ? {commerce: services} : {}),
    ...(account ? {account} : {}),
    ...(raceAvailable ? {race: services} : {}),
  };
}
