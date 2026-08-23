import {createContext, useContext, type ReactNode} from "react";

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
    adjustedTimeToBeatMs: number;
    categoryId?: string;
  };
};

/** Optional outbound referral-sharing behavior supplied by one release target. */
export type ReferralSharingCapability = {
  /** Coin reward displayed beside supported referral actions. */
  rewardCoins: number;
  /** Shares a completed single-player result. */
  shareResult: (input: ReferralResultShareInput) => void;
  /** Shares an open invitation from the player profile. */
  shareInvite: () => void;
  /** Shares a published multiplayer challenge. */
  shareRace: (input: ReferralRaceShareInput) => void;
};

/** Null means the active release target does not support outbound referral sharing. */
const ReferralSharingContext = createContext<ReferralSharingCapability | null>(null);

/** Makes a target-owned referral-sharing capability available to shared game leaves. */
export function ReferralSharingProvider({
  capability,
  children,
}: {
  capability?: ReferralSharingCapability | null;
  children: ReactNode;
}) {
  return (
    <ReferralSharingContext.Provider value={capability ?? null}>
      {children}
    </ReferralSharingContext.Provider>
  );
}

/** Returns the active target's referral-sharing capability, or null when unsupported. */
export function useReferralSharing(): ReferralSharingCapability | null {
  return useContext(ReferralSharingContext);
}
