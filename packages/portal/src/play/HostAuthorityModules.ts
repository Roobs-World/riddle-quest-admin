import type {PlatformCapabilities} from "../platform/types";
import type {HostServices} from "./types";

/** Capability-shaped authority modules exposed to hosted play. */
export type HostAuthorityModules = Readonly<{
  identity: Pick<HostServices, "auth" | "loadProfile">;
  gameplay: Pick<
    HostServices,
    "loadRiddle" | "loadProfile" | "completeGame" | "submitGuess" | "skipRiddle"
  >;
  economy?: Pick<HostServices, "requestHint" | "spendCoins">;
  commerce?: Pick<HostServices, "requestPurchase" | "products">;
  account?: Pick<HostServices, "updateUsername" | "updateAvatar" | "deleteAccount" | "loadLeaderboard">;
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
): HostAuthorityModules {
  const authenticated = capabilities?.accountUpgrade?.state === "complete";
  return {
    identity: services,
    gameplay: services,
    ...(economyAvailable ? {economy: services} : {}),
    ...(commerceAvailable ? {commerce: services} : {}),
    ...(authenticated ? {account: services} : {}),
    ...(capabilities?.matchmaking || capabilities?.tournaments || capabilities?.contextBoard
      ? {race: services}
      : {}),
  };
}
