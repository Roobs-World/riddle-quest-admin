import type {PlatformCapabilities} from "../../platform/contracts/capabilities";
import type {HostServices} from "../../platform/contracts/hostServices";

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
    | "getRaceEntry"
    | "cancelRaceInvite"
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
  /** Target-owned account permissions. */
  const permissions = capabilities?.accountManagement;
  /** Only expose operations explicitly approved for this target. */
  const account = permissions
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
