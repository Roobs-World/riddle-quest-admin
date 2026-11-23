import {HttpsError, type CallableRequest} from "firebase-functions/v2/https";
import {z} from "zod";
import {admin} from "../shared/firebaseAdmin";
import {gameplayInteractiveCallableOptions} from "../shared/gameplayCallableOptions";
import {onCallWithSentry} from "../shared/sentryHandlers";
import {validateCallableRequest} from "../validation/callableValidation";
import {isAndroidAccountProvider} from "./androidUser";
import {androidGoogleIdentity, registerAndroidReferralIdentity} from "./androidReferralIdentity";
import {
  AndroidReferralTokenSchema,
  androidReferralStatus,
  issueAndroidReferral,
  bindAndroidReferral,
} from "./androidReferrals";

/** Optional owner binding keeps older callers compatible while native views pin their account lifetime. */
const ExpectedOwner = z.string().min(1).max(128).optional();
/** A stale view cannot spend a replacement account's one-time acquisition choice. */
function assertOwner(request: CallableRequest<unknown>, expectedOwnerId?: string): void {
  if (expectedOwnerId !== undefined && request.auth?.uid !== expectedOwnerId)
    throw new HttpsError("permission-denied", "Android account changed.");
}
/** Resolves only the verified Google identity attached to this Android account. */
async function owner(request: CallableRequest<unknown>) {
  if (!request.auth) throw new HttpsError("unauthenticated", "Authentication required.");
  /** Verified Google subject and game account binding, never request-body identity. */
  const identity = androidGoogleIdentity(request.auth.uid, request.auth.token);
  await registerAndroidReferralIdentity(admin.firestore(), identity);
  return identity;
}
/** Anonymous play remains available while referral rewards require a durable Google identity. */
export const getAndroidReferralStatus = onCallWithSentry(
  "getAndroidReferralStatus",
  gameplayInteractiveCallableOptions,
  async (request) => {
    /** Server validates the initiating native account before any identity registration. */
    const input = validateCallableRequest(
      z.object({expectedOwnerId: ExpectedOwner}).strict(),
      request.data,
      "getAndroidReferralStatus",
    );
    assertOwner(request, input.expectedOwnerId);
    if (!request.auth || !isAndroidAccountProvider(request.auth.token.firebase?.sign_in_provider))
      throw new HttpsError("permission-denied", "Android account required.");
    if (request.auth.token.firebase?.sign_in_provider !== "google.com") return {kind: "google-required" as const};
    return androidReferralStatus(admin.firestore(), await owner(request));
  },
);
/** Issues an expiring opaque invitation; the share-sheet outcome grants nothing. */
export const createAndroidReferral = onCallWithSentry(
  "createAndroidReferral",
  gameplayInteractiveCallableOptions,
  async (request) => {
    /** Only this exact initiating account may issue its provider token. */
    const input = validateCallableRequest(
      z.object({expectedOwnerId: ExpectedOwner}).strict(),
      request.data,
      "createAndroidReferral",
    );
    assertOwner(request, input.expectedOwnerId);
    return issueAndroidReferral(admin.firestore(), await owner(request));
  },
);
/** Binds an eligible new Google account before any authoritative play or purchase. */
export const bindAndroidReferralEntry = onCallWithSentry(
  "bindAndroidReferralEntry",
  gameplayInteractiveCallableOptions,
  async (request) => {
    /** Strictly validated callable payload with no client-owned reward or inviter identity. */
    const input = validateCallableRequest(
      z.object({token: AndroidReferralTokenSchema, expectedOwnerId: ExpectedOwner}).strict(),
      request.data,
      "bindAndroidReferralEntry",
    );
    assertOwner(request, input.expectedOwnerId);
    return bindAndroidReferral(admin.firestore(), await owner(request), input.token);
  },
);
