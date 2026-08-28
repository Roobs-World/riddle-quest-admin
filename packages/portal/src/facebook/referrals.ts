import type {FacebookInstantSdk} from "./fbinstant";

/** Defines the token pattern value. */
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

/** Extracts only the opaque game token; all other untrusted entry data is ignored. */
export function facebookReferralTokenFromEntryData(value: unknown): string | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
  /** Provides token behavior. */
  const token = (value as Record<string, unknown>).referralToken;
  return typeof token === "string" && TOKEN_PATTERN.test(token) ? token : undefined;
}

/** Binds an entry referral after Firebase auth and custom App Check are established. */
export async function bindFacebookEntryReferral(sdk: FacebookInstantSdk): Promise<boolean> {
  /** Provides token behavior. */
  const token = facebookReferralTokenFromEntryData(sdk.getEntryPointData?.());
  if (!token) return false;
  /** Provides [{get functions, https callable}, {firebase app}] behavior. */
  const [{getFunctions, httpsCallable}, {firebaseApp}] = await Promise.all([
    import("firebase/functions"),
    import("../firebase"),
  ]);
  /** Provides bind behavior. */
  const bind = httpsCallable<
    {
      /** Stores token. */
      token: string;
    },
    {
      /** Stores already bound. */
      alreadyBound: boolean;
    }
  >(getFunctions(firebaseApp, "us-central1"), "bindFacebookReferral");
  await bind({token});
  return true;
}
