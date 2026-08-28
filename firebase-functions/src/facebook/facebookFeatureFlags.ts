/** Defines the facebook features value. */
export const FACEBOOK_FEATURES = [
  "identity",
  "commerce",
  "rewarded_ads",
  "interstitials",
  "referrals",
  "notifications",
  "matchmaking",
  "tournaments",
  "presence",
] as const;

/** Describes facebook feature. */
export type FacebookFeature = (typeof FACEBOOK_FEATURES)[number];

/** Parses the provider-scoped emergency-off list and rejects unknown names. */
export function parseFacebookDisabledFeatures(value: string | undefined): ReadonlySet<FacebookFeature> {
  if (!value?.trim()) return new Set();
  /** Provides known behavior. */
  const known = new Set<string>(FACEBOOK_FEATURES);
  /** Provides entries behavior. */
  const entries = value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  /** Provides unknown behavior. */
  const unknown = entries.filter((entry) => !known.has(entry));
  if (unknown.length > 0) throw new Error(`unknown-facebook-feature:${unknown.join(",")}`);
  return new Set(entries as FacebookFeature[]);
}

/** Returns false only when the named Facebook capability is explicitly disabled. */
export function isFacebookFeatureEnabled(
  feature: FacebookFeature,
  value = process.env.FACEBOOK_DISABLED_FEATURES,
): boolean {
  return !parseFacebookDisabledFeatures(value).has(feature);
}
