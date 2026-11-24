import {trackEvent} from "../../observability/analytics/events";
import {PushConsentContext, usePushConsentState} from "../../notifications/components/PushConsentContext";
import {createContext, useContext, useLayoutEffect, useMemo, type ReactNode} from "react";

/** Result data that a platform may turn into an attributed referral share. */
export type ReferralResultShareInput = {
  /** Single-player mode represented by the result. */
  gameMode?: "classic" | "challenge";
  /** Trusted riddle identifier associated with the result, when available. */
  riddleId?: string;
  /** Number of guesses used to solve the riddle. */
  attempts?: number;
  /** Bounded emoji representation of the completed guess board. */
  emojiGrid?: string;
};

/** Published multiplayer challenge data required by a platform share flow. */
export type ReferralRaceShareInput = {
  /** Trusted challenge identifier issued by the game server. */
  challengeId: string;
  /** Safe challenge summary returned with the publication receipt. */
  preview: {
    /** Stores adjusted time to beat ms. */
    adjustedTimeToBeatMs: number;
    /** Stores category id. */
    categoryId?: string;
  };
};

/** Provider referral-dialog outcome, separating expected dismissal from failure. */
export type ReferralShareOutcome = "success" | "cancelled" | "error";

/** Optional outbound referral-sharing behavior supplied by one release target. */
export type ReferralSharingCapability = {
  /** Coin reward displayed beside supported referral actions. */
  rewardCoins: number;
  /** Optional target copy for an invitation without an immediate reward claim. */
  inviteLabel?: string;
  /** Optional target copy for its native challenge dialog. */
  raceShareLabel?: string;
  /** Optional target instructions shown before publication. */
  raceReadyText?: string;
  /** Shares a completed single-player result. */
  shareResult: (input: ReferralResultShareInput) => void;
  /** Shares an open invitation from the player profile. */
  shareInvite: () => void;
  /** Opens this target's native dialog for a server-reserved live PvP lobby. */
  shareLiveRace?: (input: {
    /** Opaque server-owned invitation. */
    challengeId: string;
  }) => Promise<ReferralShareOutcome>;
  /** The provider can open its invite dialog after an explicitly requested private lobby is reserved. */
  autoOpenLiveRaceInvite?: boolean;
  /** Explicit self-managed browser-push consent, supplied only by supported target adapters. */
  setLiveRacePush?: (enabled: boolean) => Promise<boolean>;
  /** Shares a published multiplayer challenge and distinguishes dismissal from failure. */
  shareRace: (input: ReferralRaceShareInput) => Promise<ReferralShareOutcome>;
};

/** Null means the active release target does not support outbound referral sharing. */
const ReferralSharingContext = createContext<ReferralSharingCapability | null>(null);

/** Makes a target-owned referral-sharing capability available to shared game leaves. */
export function ReferralSharingProvider({
  capability,
  children,
}: {
  /** Stores capability. */
  capability?: ReferralSharingCapability | null;
  /** Stores children. */
  children: ReactNode;
}) {
  /** Pending provider dialogs cannot emit into a replacement account's visit. */
  const telemetry = useMemo(() => {
    const lifetime = {active: false};
    if (!capability) return {lifetime, capability: null};
    const shareLiveRace = capability.shareLiveRace?.bind(capability);
    const tracked: ReferralSharingCapability = {
      ...capability,
      shareInvite: () => {
        if (lifetime.active) trackEvent("share_requested", {surface: "profile"});
        capability.shareInvite();
      },
      shareResult: input => {
        if (lifetime.active) trackEvent("share_requested", {surface: "victory", game_mode: input.gameMode});
        capability.shareResult(input);
      },
      shareRace: async input => {
        if (lifetime.active) trackEvent("share_requested", {surface: "race"});
        const status = await capability.shareRace(input);
        if (lifetime.active) trackEvent("share_result", {surface: "race", status});
        return status;
      },
      ...(shareLiveRace ? {shareLiveRace: async (input: Parameters<NonNullable<ReferralSharingCapability["shareLiveRace"]>>[0]) => {
        if (lifetime.active) trackEvent("share_requested", {surface: "live_race"});
        const status = await shareLiveRace(input);
        if (lifetime.active) trackEvent("share_result", {surface: "live_race", status});
        return status;
      }} : {}),
    };
    return {lifetime, capability: tracked};
  }, [capability]);
  useLayoutEffect(() => {
    telemetry.lifetime.active = true;
    return () => {telemetry.lifetime.active = false;};
  }, [telemetry]);
  /** One acknowledged consent state serves all controls under this target. */
  const consent = usePushConsentState(capability);
  return <ReferralSharingContext.Provider value={telemetry.capability}>
    <PushConsentContext.Provider value={consent}>{children}</PushConsentContext.Provider>
  </ReferralSharingContext.Provider>;
}

/** Returns the active target's referral-sharing capability, or null when unsupported. */
export function useReferralSharing(): ReferralSharingCapability | null {
  return useContext(ReferralSharingContext);
}
