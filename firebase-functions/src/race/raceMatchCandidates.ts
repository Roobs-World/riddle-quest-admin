import {admin} from "../shared/firebaseAdmin";
import {raceProviderScope, type RaceProviderScope} from "./raceEligibility";
import type {RaceChallengeRecord} from "./raceSetupService";

/** Answer-free, compact projection used to retrieve the correct matchmaking pool. */
export type RaceMatchCandidate = {
  /** Authoritative challenge to revalidate before offering or accepting. */ challengeId: string;
  /** Game-owned recording identity; never a provider profile payload. */ creatorId: string;
  /** Trusted provider pool selected from the creator's account namespace. */ provider: RaceProviderScope;
  /** Exact language of the recording. */ locale: RaceChallengeRecord["locale"];
  /** Content preference supported without a separate queue. */ categoryId: RaceChallengeRecord["categoryId"];
  /** Immutable competition rules. */ rulesVersion: RaceChallengeRecord["rules"]["version"];
  /** Exact archived deck revision. */ contentVersion: string;
  /** Fixed adjusted performance of this recording. */ adjustedFinishMs: number;
  /** Eligibility projection; acceptance always consults canonical state. */ status: "active";
  /** Indexed expiration; TTL removal is not the eligibility authority. */ expiresAtMs: number;
  /** Creation timestamp used for bounded retrieval and diagnostics. */ createdAtMs: number;
  /** Storage retention of this compact projection. */ expiresAt: FirebaseFirestore.Timestamp;
};

/** Projects public recordings only; private invitation seats never enter random matching. */
export function projectRaceMatchCandidate(challenge: RaceChallengeRecord): RaceMatchCandidate | null {
  const provider = raceProviderScope(challenge.creatorId);
  if (!provider || challenge.status !== "active" || challenge.scope === "invitation" || challenge.challengeId.startsWith("jest-invite-")) return null;
  return {
    challengeId: challenge.challengeId, creatorId: challenge.creatorId, provider, locale: challenge.locale,
    categoryId: challenge.categoryId, rulesVersion: challenge.rules.version, contentVersion: challenge.contentVersion,
    adjustedFinishMs: challenge.creatorAdjustedFinishMs, status: "active", expiresAtMs: challenge.expiresAtMs,
    createdAtMs: challenge.createdAtMs, expiresAt: admin.firestore.Timestamp.fromMillis(challenge.expiresAtMs),
  };
}
