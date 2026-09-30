import {HttpsError} from "firebase-functions/v2/https";
import {RaceLocaleSchema, type RaceLocale} from "@qwordly/core/race";

/** Internal exclusive-seat authorization and independent publication facts. */
export type RaceInvitationRecord = {
  /** Opaque challenge identity. */ challengeId: string;
  /** Account owning creator cancellation and publication. */ creatorId: string;
  /** Exclusive seat, retained across retries and recovery. */ recipientId?: string;
  /** Shared content language. */ locale: RaceLocale;
  /** Legacy field retained for older readers. */ status: "inviting" | "claimed" | "published";
  /** Independent seat-claim fact. */ claimState: "unclaimed" | "claimed";
  /** Independent creator-publication fact. */ publicationState: "pending" | "published";
  /** Creation timestamp. */ createdAtMs: number;
  /** Authorization expiry, independent of eventual TTL cleanup. */ expiresAtMs: number;
  /** First publication timestamp, also used to recover overwritten legacy status. */ publishedAtMs?: number;
  /** Creator cancellation timestamp; no seat release or scored-history erasure. */ cancelledAtMs?: number;
};
/** Normalizes legacy claim/publication orderings without treating status as the authority. */
export function parseRaceInvitation(value: FirebaseFirestore.DocumentData | undefined, published = false, expectedId?: string): RaceInvitationRecord {
  /** Identities are bounded single path segments, including supported legacy accounts. */
  const validId = (id: unknown) => typeof id === "string" && id.length > 0 && id.length <= 160 && !id.includes("/");
  /** Canonical clocks reject fractional, negative, infinite and unsafe integer values. */
  const validMs = (clock: unknown) => typeof clock === "number" && Number.isSafeInteger(clock) && clock >= 0;
  if (!value || !validId(value.challengeId) || !validId(value.creatorId) ||
    expectedId !== undefined && value.challengeId !== expectedId ||
    (value.recipientId !== undefined && !validId(value.recipientId)) ||
    !["inviting", "claimed", "published"].includes(value.status) || value.status === "claimed" && value.recipientId === undefined || !RaceLocaleSchema.safeParse(value.locale).success ||
    !validMs(value.createdAtMs) || !validMs(value.expiresAtMs) || value.expiresAtMs <= value.createdAtMs ||
    value.publishedAtMs !== undefined && !validMs(value.publishedAtMs) || value.cancelledAtMs !== undefined && !validMs(value.cancelledAtMs) ||
    value.claimedAtMs !== undefined && !validMs(value.claimedAtMs) ||
    value.claimState !== undefined && value.claimState !== (value.recipientId ? "claimed" : "unclaimed") ||
    value.publicationState !== undefined && !["pending", "published"].includes(value.publicationState)) {
    throw new HttpsError("internal", "Stored race invitation is invalid.");
  }
  return {...value, claimState: value.recipientId ? "claimed" : "unclaimed",
    publicationState: published || value.publishedAtMs !== undefined || value.publicationState === "published" || value.status === "published" ? "published" : "pending"} as RaceInvitationRecord;
}
/** Shared publication/acceptance cancellation and expiry policy. */
export function assertRaceInvitationOpen(invitation: RaceInvitationRecord, nowMs: number): void {
  if (invitation.cancelledAtMs !== undefined) throw new HttpsError("failed-precondition", "Race invitation is cancelled.");
  if (invitation.expiresAtMs <= nowMs) throw new HttpsError("failed-precondition", "Race invitation has expired.");
}
