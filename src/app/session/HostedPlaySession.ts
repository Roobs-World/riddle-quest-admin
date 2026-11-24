import type {RaceLocale} from "../../races/contracts/index";
import type {PlatformCapabilities, PlayerData, PlayerDataUpdate} from "../../platform/contracts/capabilities";
import type {ActivePresenceState} from "../../presence/PlatformPresenceSession";
import {coordinateHostServices, type AccountDeletionServiceGate} from "../../accounts/browser/deletion/accountDeletionServiceGate";
import {createHostAuthorityModules, type HostAuthorityModules} from "./HostAuthorityModules";
import type {ReferralSharingCapability} from "../../sharing/components/ReferralSharingCapability";
import type {NotificationSettingsCapability} from "../../notifications/contracts/notificationSettings";
import type {HostServices, ProductSummary, PurchaseResult, WebGameMode} from "../../platform/contracts/hostServices";

/** Target-owned facts required to assemble one hosted-play session. */
export type HostedPlaySession = Readonly<{
  /** Stores services. */
  services: HostServices;
  /** Stores authority. */
  authority: HostAuthorityModules;
  /** Prepared local reads remain revoked while target account operations are closed. */
  canUsePreparedQuestions?: () => boolean;
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
  /** Opens category selection for an incoming multiplayer invitation. */
  initialRaceLobby?: boolean;
  /** Incoming tournament destination; availability remains target-owned. */
  initialRaceTournamentLocale?: RaceLocale;
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
  /** Target-owned delivery operations exposed only in Settings. */
  notificationSettings?: NotificationSettingsCapability | null;
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
  /** Indicates whether the target exposes backend race authority. */
  raceAvailable?: boolean;
};

/** Describes session authority assembly. */
type SessionAuthorityAssembly = Readonly<{
  /** Stable target admission guard for previously issued local questions. */
  canUsePreparedQuestions: () => boolean;
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
  /** Stores race available. */
  raceAvailable: boolean | undefined;
  /** Stores services. */
  services: HostServices;
  /** Stores authority. */
  authority: HostAuthorityModules;
}>;

/** Retains only the current commerce/capability assembly for an active target provider. */
const assemblyCache = new WeakMap<HostServices, SessionAuthorityAssembly>();

/** Admission precedes the deletion queue and survives catalog-driven assemblies. */
const activePlatformPurchases = new WeakSet<HostServices["requestPurchase"]>();

/** Stable gameplay and admission owned by one provider and optional deletion gate. */
type GameplayAuthorityAssembly = Readonly<{
  /** Provider operations remain attached to this deletion lifetime. */
  gate: AccountDeletionServiceGate | undefined;
  /** Stable provider operations used by all non-commerce authority modules. */
  services: HostServices;
  /** Synchronous revocation is shared across ordinary commerce presentation updates. */
  canUsePreparedQuestions: () => boolean;
}>;

/** Weak deletion lifetimes do not accumulate while a provider remains active. */
const gameplayAssemblyCache = new WeakMap<HostServices, WeakMap<HostServices | AccountDeletionServiceGate, GameplayAuthorityAssembly>>();

/** Keeps content preparation attached to its actual provider rather than transient commerce callbacks. */
const assembleGameplay = (input: HostedPlaySessionInput) => {
  /** The same target gate owns reads across profile saves and catalog refreshes. */
  const gate = input.accountDeletionServiceGate;
  /** Weak gate keys release retired lifetimes while an active caller still keeps its own gate alive. */
  const entries = gameplayAssemblyCache.get(input.hostServices) ?? new WeakMap<HostServices | AccountDeletionServiceGate, GameplayAuthorityAssembly>();
  /** An ungated target uses its provider as the stable weak key. */
  const key = gate ?? input.hostServices;
  /** A changed provider or gate still starts an independent content scope. */
  const cached = entries.get(key);
  if (cached) return cached;
  /** Captures only the target and gate, never player progress or purchase closure state. */
  const assembly: GameplayAuthorityAssembly = {gate, services: gate ? coordinateHostServices(input.hostServices, gate) : input.hostServices,
    canUsePreparedQuestions: () => !gate || gate.isOpen?.() === true};
  entries.set(key, assembly); gameplayAssemblyCache.set(input.hostServices, entries);
  return assembly;
};

/** Provides assemble authority behavior. */
const assembleAuthority = (input: HostedPlaySessionInput): SessionAuthorityAssembly => {
  /** Reuse the current assembly without keeping earlier checkout closures or catalogs alive. */
  const cached = assemblyCache.get(input.hostServices);
  if (cached && cached.products === input.platformProducts && cached.purchase === input.platformPurchase &&
    cached.gate === input.accountDeletionServiceGate && cached.capabilities === input.platformCapabilities &&
    cached.economyAvailable === input.economyAvailable && cached.raceAvailable === input.raceAvailable) return cached;
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
  /** Stable purchase callback whose concurrent invocations share admission. */
  const purchaseOwner = input.platformPurchase ?? input.hostServices.requestPurchase;
  /** Admits one checkout at a time for the same platform purchase callback. */
  const requestPurchase: HostServices["requestPurchase"] = async productId => {
    if (activePlatformPurchases.has(purchaseOwner)) return {
      success: false,
      cancelled: true,
      productId,
      purchaseType: services.products.find(product => product.productId === productId)?.productType ?? "consumable",
    };
    activePlatformPurchases.add(purchaseOwner);
    try {
      return await services.requestPurchase(productId);
    } finally {
      activePlatformPurchases.delete(purchaseOwner);
    }
  };
  /** Stable gameplay does not retire a prepared question when only commerce presentation changes. */
  const gameplay = assembleGameplay(input);
  /** Current capability permissions remain target-owned while operations use their stable provider. */
  const authority = createHostAuthorityModules(gameplay.services, input.platformCapabilities,
    input.platformPurchase !== undefined, input.economyAvailable ?? true, input.raceAvailable);
  /** Provides assembly behavior. */
  const assembly = {
    canUsePreparedQuestions: gameplay.canUsePreparedQuestions,
    products: input.platformProducts,
    purchase: input.platformPurchase,
    gate: input.accountDeletionServiceGate,
    capabilities: input.platformCapabilities,
    economyAvailable: input.economyAvailable,
    raceAvailable: input.raceAvailable,
    services,
    authority: {...authority, ...(authority.commerce ? {commerce: {
      ...authority.commerce, products: services.products, requestPurchase,
    }} : {})},
  };
  // Existing callers retain their own assemblies; the cache needs only the latest one.
  assemblyCache.set(input.hostServices, assembly);
  return assembly;
};

/** Applies coherent hosted-play defaults once for every Web Target. */
export function createHostedPlaySession(
  input: Pick<HostedPlaySessionInput, "hostServices"> & Partial<Omit<HostedPlaySessionInput, "hostServices">>,
): HostedPlaySession {
  /** Provides {services, authority} behavior. */
  const {services, authority, canUsePreparedQuestions} = assembleAuthority(input as HostedPlaySessionInput);
  return {
    ...input,
    services,
    authority,
    canUsePreparedQuestions,
    hostConfigurationWarning: input.hostConfigurationWarning ?? null,
    initialGameMode: input.initialGameMode ?? "classic",
    externalInteractionBlocked: input.externalInteractionBlocked ?? false,
    initialRaceInbox: input.initialRaceInbox ?? false,
    initialRaceLobby: input.initialRaceLobby ?? false,
    raceLocalePolicy: input.raceLocalePolicy ?? "english-only",
  };
}
