import type {PlatformCapabilities, PlayerData, PlayerDataUpdate} from "../platform/types";
import type {ActivePresenceState} from "../presence/PlatformPresenceSession";
import {coordinateHostServices, type AccountDeletionServiceGate} from "./accountDeletionServiceGate";
import {createHostAuthorityModules, type HostAuthorityModules} from "./HostAuthorityModules";
import type {ReferralSharingCapability} from "./sharing/ReferralSharingCapability";
import type {HostServices, ProductSummary, PurchaseResult, WebGameMode} from "./types";

/** Target-owned facts required to assemble one hosted-play session. */
export type HostedPlaySession = Readonly<{
  /** Stores services. */
  services: HostServices;
  /** Stores authority. */
  authority: HostAuthorityModules;
  /** Stores host configuration warning. */
  hostConfigurationWarning: string | null;
  /** Stores initial game mode. */
  initialGameMode: WebGameMode;
  /** Stores platform capabilities. */
  platformCapabilities?: PlatformCapabilities;
  /** Stores platform player id. */
  platformPlayerId?: string;
  /** Stores external interaction blocked. */
  externalInteractionBlocked: boolean;
  /** Stores initial player data. */
  initialPlayerData?: PlayerData | null;
  /** Stores on player data change. */
  onPlayerDataChange?: (update: PlayerDataUpdate) => void;
  /** Stores registration name. */
  registrationName?: string;
  /** Stores registration inviter name. */
  registrationInviterName?: string;
  /** Stores initial race challenge id. */
  initialRaceChallengeId?: string;
  /** Stores initial race inbox. */
  initialRaceInbox: boolean;
  /** Stores presence enabled. */
  presenceEnabled?: boolean;
  /** Stores on toggle presence. */
  onTogglePresence?: () => void;
  /** Stores race locale policy. */
  raceLocalePolicy: "english-only" | "all";
  /** Stores on presence state change. */
  onPresenceStateChange?: (state: ActivePresenceState) => void;
  /** Stores referral sharing. */
  referralSharing?: ReferralSharingCapability | null;
}>;

/** Target facts accepted before hosted-play session coherence is resolved. */
export type HostedPlaySessionInput = Omit<HostedPlaySession, "services" | "authority"> & {
  /** Stores host services. */
  hostServices: HostServices;
  /** Stores platform products. */
  platformProducts?: ProductSummary[];
  /** Stores platform purchase. */
  platformPurchase?: (productId: string) => Promise<PurchaseResult>;
  /** Stores account deletion service gate. */
  accountDeletionServiceGate?: AccountDeletionServiceGate;
  /** Stores economy available. */
  economyAvailable?: boolean;
};

/** Describes session authority assembly. */
type SessionAuthorityAssembly = Readonly<{
  /** Stores products. */
  products: ProductSummary[] | undefined;
  /** Stores purchase. */
  purchase: HostedPlaySessionInput["platformPurchase"];
  /** Stores gate. */
  gate: AccountDeletionServiceGate | undefined;
  /** Stores capabilities. */
  capabilities: PlatformCapabilities | undefined;
  /** Stores economy available. */
  economyAvailable: boolean | undefined;
  /** Stores services. */
  services: HostServices;
  /** Stores authority. */
  authority: HostAuthorityModules;
}>;

/** Provides assembly cache behavior. */
const assemblyCache = new WeakMap<HostServices, SessionAuthorityAssembly[]>();

/** Provides assemble authority behavior. */
const assembleAuthority = (input: HostedPlaySessionInput): SessionAuthorityAssembly => {
  /** Provides cached behavior. */
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
  /** Provides configured behavior. */
  const configured: HostServices = {
    ...input.hostServices,
    products: input.platformProducts ?? input.hostServices.products,
    requestPurchase: input.platformPurchase ?? input.hostServices.requestPurchase,
  };
  /** Provides services behavior. */
  const services = input.accountDeletionServiceGate
    ? coordinateHostServices(configured, input.accountDeletionServiceGate)
    : configured;
  /** Provides assembly behavior. */
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
  /** Provides entries behavior. */
  const entries = assemblyCache.get(input.hostServices) ?? [];
  entries.push(assembly);
  assemblyCache.set(input.hostServices, entries);
  return assembly;
};

/** Applies coherent hosted-play defaults once for every Web Target. */
export function createHostedPlaySession(
  input: Pick<HostedPlaySessionInput, "hostServices"> & Partial<Omit<HostedPlaySessionInput, "hostServices">>,
): HostedPlaySession {
  /** Provides {services, authority} behavior. */
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
