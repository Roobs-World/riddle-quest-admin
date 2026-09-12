import type {PlatformCapabilities, PlayerData, PlayerDataUpdate} from "../platform/types";
import type {ActivePresenceState} from "../presence/PlatformPresenceSession";
import {coordinateHostServices, type AccountDeletionServiceGate} from "./accountDeletionServiceGate";
import {createHostAuthorityModules, type HostAuthorityModules} from "./HostAuthorityModules";
import type {ReferralSharingCapability} from "./sharing/ReferralSharingCapability";
import type {HostServices, ProductSummary, PurchaseResult, WebGameMode} from "./types";

/** Target-owned facts required to assemble one hosted-play session. */
export type HostedPlaySession = Readonly<{
  services: HostServices;
  authority: HostAuthorityModules;
  hostConfigurationWarning: string | null;
  initialGameMode: WebGameMode;
  platformCapabilities?: PlatformCapabilities;
  platformPlayerId?: string;
  externalInteractionBlocked: boolean;
  initialPlayerData?: PlayerData | null;
  onPlayerDataChange?: (update: PlayerDataUpdate) => void;
  registrationName?: string;
  registrationInviterName?: string;
  initialRaceChallengeId?: string;
  initialRaceInbox: boolean;
  presenceEnabled?: boolean;
  onTogglePresence?: () => void;
  raceLocalePolicy: "english-only" | "all";
  onPresenceStateChange?: (state: ActivePresenceState) => void;
  referralSharing?: ReferralSharingCapability | null;
}>;

/** Target facts accepted before hosted-play session coherence is resolved. */
export type HostedPlaySessionInput = Omit<HostedPlaySession, "services" | "authority"> & {
  hostServices: HostServices;
  platformProducts?: ProductSummary[];
  platformPurchase?: (productId: string) => Promise<PurchaseResult>;
  accountDeletionServiceGate?: AccountDeletionServiceGate;
  economyAvailable?: boolean;
};

type SessionAuthorityAssembly = Readonly<{
  products: ProductSummary[] | undefined;
  purchase: HostedPlaySessionInput["platformPurchase"];
  gate: AccountDeletionServiceGate | undefined;
  capabilities: PlatformCapabilities | undefined;
  economyAvailable: boolean | undefined;
  services: HostServices;
  authority: HostAuthorityModules;
}>;

const assemblyCache = new WeakMap<HostServices, SessionAuthorityAssembly[]>();

const assembleAuthority = (input: HostedPlaySessionInput): SessionAuthorityAssembly => {
  const cached = assemblyCache
    .get(input.hostServices)
    ?.find(
      (entry) =>
        entry.products === input.platformProducts &&
        entry.purchase === input.platformPurchase &&
        entry.gate === input.accountDeletionServiceGate &&
        entry.capabilities === input.platformCapabilities &&
        entry.economyAvailable === input.economyAvailable,
    );
  if (cached) return cached;
  const configured: HostServices = {
    ...input.hostServices,
    products: input.platformProducts ?? input.hostServices.products,
    requestPurchase: input.platformPurchase ?? input.hostServices.requestPurchase,
  };
  const services = input.accountDeletionServiceGate
    ? coordinateHostServices(configured, input.accountDeletionServiceGate)
    : configured;
  const assembly = {
    products: input.platformProducts,
    purchase: input.platformPurchase,
    gate: input.accountDeletionServiceGate,
    capabilities: input.platformCapabilities,
    economyAvailable: input.economyAvailable,
    services,
    authority: createHostAuthorityModules(
      services,
      input.platformCapabilities,
      input.platformPurchase !== undefined,
      input.economyAvailable ?? true,
    ),
  };
  const entries = assemblyCache.get(input.hostServices) ?? [];
  entries.push(assembly);
  assemblyCache.set(input.hostServices, entries);
  return assembly;
};

/** Applies coherent hosted-play defaults once for every Web Target. */
export function createHostedPlaySession(
  input: Pick<HostedPlaySessionInput, "hostServices"> & Partial<Omit<HostedPlaySessionInput, "hostServices">>,
): HostedPlaySession {
  const {services, authority} = assembleAuthority(input as HostedPlaySessionInput);
  return {
    ...input,
    services,
    authority,
    hostConfigurationWarning: input.hostConfigurationWarning ?? null,
    initialGameMode: input.initialGameMode ?? "classic",
    externalInteractionBlocked: input.externalInteractionBlocked ?? false,
    initialRaceInbox: input.initialRaceInbox ?? false,
    raceLocalePolicy: input.raceLocalePolicy ?? "english-only",
  };
}
