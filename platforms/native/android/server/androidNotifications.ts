import {createHash} from "node:crypto";
import {Timestamp, type Firestore} from "firebase-admin/firestore";
import {getMessaging} from "firebase-admin/messaging";
import {HttpsError} from "firebase-functions/v2/https";
import {z} from "zod";
import {admin} from "../../../../firebase-functions/src/shared/firebaseAdmin";
import {gameplayInteractiveCallableOptions} from "../../../../firebase-functions/src/shared/gameplayCallableOptions";
import {onCallWithSentry} from "../../../../firebase-functions/src/shared/sentryHandlers";
import {validateCallableRequest} from "../../../../firebase-functions/src/validation/callableValidation";
import {assertJestAccountActive, getJestAccountDeletionRef, runWithJestAccountOperationLease} from "../../../../firebase-functions/src/shared/accountDeletion";
import {isAndroidAccountProvider} from "./androidUser";

/** Native FCM consent is separate from every web provider's subscription. */
const Subscription = z
  .object({
    token: z
      .string()
      .min(20)
      .max(4096)
      .regex(/^[A-Za-z0-9_:.-]+$/),
    invitations: z.boolean(),
    daily: z.boolean(),
    locale: z.string().min(2).max(10),
  })
  .strict();
/** FCM registrations are opaque; only their hash is used as a document id. */
export const androidPushTokenHash = (token: string): string => createHash("sha256").update(token).digest("hex");
/** Authenticates the native installation and records explicit notification consent. */
export const setAndroidPushSubscription = onCallWithSentry(
  "setAndroidPushSubscription",
  gameplayInteractiveCallableOptions,
  async (request) => {
    /** Strictly validated callable payload with no client-owned reward or inviter identity. */
    const input = validateCallableRequest(Subscription, request.data, "setAndroidPushSubscription");
    /** Authenticated game account that owns this operation. */
    const uid = request.auth?.uid;
    if (!uid || !isAndroidAccountProvider(request.auth?.token.firebase?.sign_in_provider))
      throw new HttpsError("permission-denied", "Android account required.");
    return runWithJestAccountOperationLease(uid, 30, async () => {
      /** Real Firestore database in the dedicated local demo project. */
      const db = admin.firestore(),
        ref = db.doc(`androidPushTokens/${androidPushTokenHash(input.token)}`),
        nowMs = Date.now();
      await db.runTransaction(async (tx) => {
        /** Canonical account, deletion guard, consent row and bounded device registrations read before writes. */
        const [user, deleted, current, owned] = await Promise.all([
          tx.get(db.doc(`users/${uid}`)),
          tx.get(getJestAccountDeletionRef(db, uid)),
          tx.get(ref),
          tx.get(db.collection("androidPushTokens").where("uid", "==", uid).limit(6)),
        ]);
        assertJestAccountActive(deleted);
        if (!user.exists || !isAndroidAccountProvider(user.data()?.androidProvider))
          throw new HttpsError("not-found", "Android account unavailable.");
        if (!input.invitations && !input.daily) {
          if (current.data()?.uid === uid) tx.delete(ref);
          return;
        }
        if (current.data()?.uid !== uid && owned.size >= 5)
          throw new HttpsError("resource-exhausted", "Too many notification devices.");
        // Latest authenticated owner replaces a shared device's previous account binding.
        tx.set(ref, {
          ...input,
          uid,
          updatedAtMs: nowMs,
          expiresAt: Timestamp.fromMillis(nowMs + 30 * 86_400_000),
        });
      });
      return {invitations: input.invitations, daily: input.daily};
    });
  },
);

/** Sends only to a fresh token whose current owner and consent still match. */
export async function sendAndroidPush(
  db: Firestore,
  tokenId: string,
  uid: string,
  data: Record<string, string>,
  consent: "invitations" | "daily",
  ttlMs: number,
): Promise<boolean> {
  if (ttlMs <= 0) return false;
  /** Private Firestore reference used by this authority or replay scenario. */
  const ref = db.doc(`androidPushTokens/${tokenId}`);
  /** Current token ownership, live account and permanent deletion boundary. */
  const [registration, account, deleted] = await Promise.all([
    ref.get(),
    db.doc(`users/${uid}`).get(),
    getJestAccountDeletionRef(db, uid).get(),
  ]);
  /** Current server-owned provider registration or immutable referral ownership. */
  const binding = registration.data();
  if (
    !binding ||
    binding.uid !== uid ||
    binding[consent] !== true ||
    binding.updatedAtMs < Date.now() - 30 * 86_400_000 ||
    typeof binding.token !== "string" ||
    !account.exists ||
    deleted.exists ||
    !isAndroidAccountProvider(account.data()?.androidProvider)
  )
    return false;
  try {
    await getMessaging().send({
      token: binding.token,
      data: {...data, accountId: uid},
      android: {
        priority: consent === "invitations" ? "high" : "normal",
        ttl: Math.max(0, ttlMs),
        collapseKey: data.kind,
      },
    });
    return true;
  } catch (error) {
    /** Bounded provider error identifier used to retire invalid tokens. */
    const code = error instanceof Error && "code" in error ? error.code : undefined;
    if (code === "messaging/registration-token-not-registered" || code === "messaging/invalid-registration-token") {
      await db.runTransaction(async (tx) => {
        /** Current row rechecked before conditional token removal. */
        const latest = await tx.get(ref);
        if (latest.data()?.uid === uid && latest.data()?.token === binding.token) tx.delete(ref);
      });
    }
    throw error;
  }
}

/** Delivers invitation work through at most five current native installations. */
export async function sendAndroidLiveChallengePush(
  db: Firestore,
  input: {
    /** Authenticated game account that owns this operation. */
    uid: string;
    /** Opaque canonical private-lobby handle. */
    challengeId: string;
    /** Manager-authored notification headline supplied by a trusted dispatcher. */
    title: string;
    /** Manager-authored notification text supplied by a trusted dispatcher. */
    body: string;
    /** Server-owned expiration of the opaque entry or notification. */
    expiresAtMs: number;
  },
): Promise<"submitted" | "skipped" | "unconfirmed"> {
  /** At most five current native installations owned by this account. */
  const registrations = await db.collection("androidPushTokens").where("uid", "==", input.uid).limit(5).get();
  if (registrations.empty) return "skipped";
  /** Provider outcomes kept separate from actual delivery to the player. */
  const outcomes = await Promise.allSettled(
    registrations.docs.map((row) =>
      sendAndroidPush(
        db,
        row.id,
        input.uid,
        {
          kind: "liveChallenge",
          challengeId: input.challengeId,
          title: input.title,
          body: input.body,
          expiresAtMs: String(input.expiresAtMs),
        },
        "invitations",
        input.expiresAtMs - Date.now(),
      ),
    ),
  );
  return outcomes.some((result) => result.status === "fulfilled" && result.value)
    ? "submitted"
    : outcomes.some((result) => result.status === "rejected")
      ? "unconfirmed"
      : "skipped";
}
