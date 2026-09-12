import type {PlatformCapabilities} from "../platform/types";
import type {HostServices} from "./types";

/** Capability-shaped authority modules exposed to hosted play. */
export type HostAuthorityModules = Readonly<{
  /** Stores identity. */
  identity: Pick<HostServices, "auth" | "loadProfile">;
  /** Stores gameplay. */
  gameplay: Pick<
    HostServices,
    "loadRiddle" | "loadProfile" | "completeGame" | "submitGuess" | "skipRiddle"
  >;
  /** Read-only public ranking authority available independently of account management. */
  leaderboard: Pick<HostServices, "loadLeaderboard">;
  /** Stores economy. */
  economy?: Pick<HostServices, "requestHint" | "spendCoins">;
  /** Stores commerce. */
  commerce?: Pick<HostServices, "requestPurchase" | "products">;
  /** Stores account. */
  account?: Pick<HostServices, "updateUsername" | "updateAvatar" | "deleteAccount">;
  /** Stores race. */
  race?: Pick<
    HostServices,
    | "listRaceCategories"
    | "startRace"
    | "submitRaceGuess"
    | "requestRaceHint"
    | "skipRaceRiddle"
    | "resumeRace"
    | "abandonRace"
    | "publishRace"
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
  return {
    identity: services,
    gameplay: services,
    leaderboard: services,
    ...(economyAvailable ? {economy: services} : {}),
    ...(commerceAvailable ? {commerce: services} : {}),
    ...(authenticated ? {account: services} : {}),
    ...(raceAvailable ? {race: services} : {}),
  };
}
