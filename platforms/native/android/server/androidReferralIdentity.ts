import {isAndroidAccountProvider} from "./androidUser";
import {createHash} from "node:crypto";
import {HttpsError} from "firebase-functions/v2/https";
import {z} from "zod";
import type {Firestore} from "firebase-admin/firestore";
import {assertAccountActive, getAccountDeletionRef} from "../../../../firebase-functions/src/shared/accountDeletion";

/** Signed Firebase claims must identify exactly one durable Google subject. */
const GoogleClaims = z.looseObject({
  firebase: z.looseObject({
    sign_in_provider: z.literal("google.com"),
    identities: z.looseObject({
      "google.com": z.tuple([
        z
          .string()
          .min(6)
          .max(255)
          .regex(/^[A-Za-z0-9_-]+$/),
      ]),
    }),
  }),
});
/** Account and durable identity are never taken from client request data. */
export type AndroidGoogleIdentity = Readonly<{
  /** Authenticated game account that owns this operation. */
  uid: string;
  /** Domain-separated durable Google subject hash used for acquisition replay prevention. */
  subjectHash: string;
}>;
/** Domain separation prevents a token digest from becoming an account or cap key. */
export const androidReferralHash = (domain: string, value: string): string =>
  createHash("sha256").update(`riddle-quest\0android-referral\0${domain}\0${value}`).digest("hex");
/** Extracts the Google identity exclusively from Firebase-verified authentication claims. */
export function androidGoogleIdentity(uid: string, token: unknown): AndroidGoogleIdentity {
  /** Firebase-verified Google subject parsed before it can identify a referral participant. */
  const claims = GoogleClaims.safeParse(token);
  if (!claims.success || !/^[A-Za-z0-9]{28}$/.test(uid))
    throw new HttpsError("permission-denied", "Google sign-in required.");
  return {uid, subjectHash: androidReferralHash("google-subject", claims.data.firebase.identities["google.com"][0])};
}
/** Canonical counters required to admit a brand-new referred player. */
const Count = z.number().int().nonnegative().safe();
/** Android account authority needed by referral grants. */
export const AndroidReferralProfileSchema = z.looseObject({
  androidProvider: z.enum(["anonymous", "google.com"]),
  coins: Count,
  hasPurchasedApp: z.boolean(),
  hasActiveSubscription: z.boolean().optional(),
  androidReferralPlayed: z.boolean().optional(),
  androidGoogleSubjectHash: z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .optional(),
  stats: z.looseObject({
    gamesPlayed: Count,
    wins: Count,
    multiplayerGamesPlayed: Count.optional(),
    multiplayerWins: Count.optional(),
    multiplayerChallengesCreated: Count.optional(),
    totalHintsUsed: Count.optional(),
    classicSkipped: Count.optional(),
    totalWordsGuessed: Count.optional(),
  }),
});
/** Validated server-owned Google subject generation; deleting an account never deletes this replay boundary. */
export const AndroidReferralIdentitySchema = z.object({
  uid: z.string().nullable(),
  established: z.boolean(),
  bound: z.boolean(),
  firstSeenAtMs: Count,
});
/** True only after canonical activity has established this game account. */
export function androidReferralEstablished(profile: z.infer<typeof AndroidReferralProfileSchema>): boolean {
  return (
    profile.androidReferralPlayed === true ||
    profile.hasPurchasedApp ||
    profile.hasActiveSubscription === true ||
    [
      profile.stats.gamesPlayed,
      profile.stats.wins,
      profile.stats.multiplayerGamesPlayed,
      profile.stats.multiplayerWins,
      profile.stats.multiplayerChallengesCreated,
      profile.stats.totalHintsUsed,
      profile.stats.classicSkipped,
      profile.stats.totalWordsGuessed,
    ].some((value) => (value ?? 0) > 0)
  );
}
/** Persists a verified Google binding while preserving replay markers across deleted account generations. */
export async function registerAndroidReferralIdentity(
  db: Firestore,
  identity: AndroidGoogleIdentity,
  nowMs = Date.now(),
): Promise<void> {
  /** Canonical account reference used for the balance and identity transaction. */
  const userRef = db.doc(`users/${identity.uid}`),
    identityRef = db.doc(`androidReferralIdentities/${identity.subjectHash}`);
  await db.runTransaction(async (tx) => {
    /** Current Android profile, durable Google-subject generation and deletion guard. */
    const [user, durable, deleted] = await Promise.all([
      tx.get(userRef),
      tx.get(identityRef),
      tx.get(getAccountDeletionRef(db, identity.uid)),
    ]);
    assertAccountActive(deleted);
    /** Validated canonical Android account state used for referral eligibility. */
    const profile = AndroidReferralProfileSchema.safeParse(user.data());
    if (!user.exists || !profile.success) throw new HttpsError("permission-denied", "Android account required.");
    if (profile.data.androidGoogleSubjectHash && profile.data.androidGoogleSubjectHash !== identity.subjectHash)
      throw new HttpsError("failed-precondition", "This account already has a Google identity.");
    /** Earlier canonical record whose replay markers survive refresh or generation changes. */
    const previous = durable.exists ? AndroidReferralIdentitySchema.parse(durable.data()) : null;
    if (previous?.uid && previous.uid !== identity.uid) {
      /** Permanent deletion guard required before transferring a Google subject to a new game account. */
      const oldDeletion = await tx.get(getAccountDeletionRef(db, previous.uid));
      if (!oldDeletion.exists)
        throw new HttpsError("failed-precondition", "Google identity belongs to another game account.");
    }
    tx.set(identityRef, {
      uid: identity.uid,
      established: previous?.established === true || androidReferralEstablished(profile.data),
      bound: previous?.bound === true,
      firstSeenAtMs: previous?.firstSeenAtMs ?? nowMs,
    });
    tx.update(userRef, {androidGoogleSubjectHash: identity.subjectHash});
  });
}

/** Canonical Android activity is established in the same transaction as the first accepted action. */
export function androidReferralPlayPatch(profile: {
  /** Server-provisioned Android sign-in provider marker. */
  androidProvider?: unknown;
  /** Canonical first-action marker preventing referral acquisition after online play. */
  androidReferralPlayed?: unknown;
}): {
  /** Canonical first-action marker preventing referral acquisition after online play. */
  androidReferralPlayed?: true;
} {
  return isAndroidAccountProvider(profile.androidProvider) && profile.androidReferralPlayed !== true
    ? {androidReferralPlayed: true}
    : {};
}
