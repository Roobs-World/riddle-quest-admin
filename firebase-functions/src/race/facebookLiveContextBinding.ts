import {z} from "zod";
import {HttpsError} from "firebase-functions/v2/https";
import type {RaceLocale} from "@qwordly/core/race";
import {facebookContextKey} from "./facebookContextCompetition";
import {parseFacebookContextCompetition} from "./facebookContextService";
import {isFacebookFirebaseUid} from "../facebook/facebookSecurity";

/** Only server-derived board and membership epochs are retained with the live seat. */
export const FacebookLiveContextBindingSchema = z.object({contextKey: z.string().regex(/^[a-f0-9]{64}$/),
  createdAtMs: z.number().int().nonnegative(), joinedAtMs: z.number().int().nonnegative()}).strict();
/** Immutable original context selection contains no SDK ID or other participant identity. */
export type FacebookLiveContextBinding = z.infer<typeof FacebookLiveContextBindingSchema>;

/** Validates an optional SDK selector before any provider can enter or recover a seat. */
export function facebookLiveContextSelection(userId: string, contextId?: string): string | undefined {
  if (contextId === undefined) return undefined;
  if (!isFacebookFirebaseUid(userId)) throw new HttpsError("permission-denied", "Facebook context selection unavailable.");
  return facebookContextKey(contextId);
}

/** Captures current active membership in the same transaction that creates a new live ticket. */
export async function prepareFacebookLiveContext(transaction: FirebaseFirestore.Transaction, db: FirebaseFirestore.Firestore,
  userId: string, locale: RaceLocale, contextKey: string | undefined, nowMs: number): Promise<FacebookLiveContextBinding | undefined> {
  if (contextKey === undefined) return undefined;
  /** Source clocks and identity are always server-owned, including direct service use. */
  if (!isFacebookFirebaseUid(userId) || !Number.isSafeInteger(nowMs) || nowMs < 0)
    throw new HttpsError("permission-denied", "Facebook context selection unavailable.");
  /** Original board and member epochs prevent later rollover or reactivation from accepting an old score. */
  const snapshot = await transaction.get(db.doc(`facebookContextCompetitions/${contextKey}`));
  if (!snapshot.exists) throw new HttpsError("not-found", "Facebook context selection unavailable.");
  /** Stored membership is validated independently of the browser's synchronized context result. */
  const board = parseFacebookContextCompetition(snapshot.data());
  /** Only this authenticated owner's active locale membership may bind the score destination. */
  const member = board.members.find(row => row.userId === userId && row.active);
  if (board.contextKey !== contextKey || board.locale !== locale || nowMs < board.createdAtMs || nowMs >= board.expiresAtMs ||
    !member || member.joinedAtMs > nowMs)
    throw new HttpsError("failed-precondition", "Facebook context selection unavailable.");
  return {contextKey, createdAtMs: board.createdAtMs, joinedAtMs: member.joinedAtMs};
}

/** Receipt recovery cannot move a retained score to another SDK context. */
export function assertFacebookLiveContextSelection(binding: FacebookLiveContextBinding | undefined, contextKey?: string): void {
  if (binding?.contextKey !== contextKey) throw new HttpsError("failed-precondition", "Request belongs to another live context.");
}
