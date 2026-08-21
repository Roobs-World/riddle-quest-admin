import type {FacebookInstantSdk} from "./fbinstant";

/** Defines the token pattern value. */
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

/** Extracts only the opaque game token; all other untrusted entry data is ignored. */
export function facebookReferralTokenFromEntryData(value: unknown): string | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
  const token = (value as Record<string, unknown>).referralToken;
  return typeof token === "string" && TOKEN_PATTERN.test(token) ? token : undefined;
}

/** Binds an entry referral after Firebase auth and custom App Check are established. */
export async function bindFacebookEntryReferral(sdk: FacebookInstantSdk): Promise<boolean> {
  const token = facebookReferralTokenFromEntryData(sdk.getEntryPointData?.());
  if (!token) return false;
  const [{getFunctions, httpsCallable}, {firebaseApp}] = await Promise.all([
    import("firebase/functions"),
    import("../firebase"),
  ]);
  const bind = httpsCallable<{token: string}, {alreadyBound: boolean}>(
    getFunctions(firebaseApp, "us-central1"),
    "bindFacebookReferral",
  );
  await bind({token});
  return true;
}
