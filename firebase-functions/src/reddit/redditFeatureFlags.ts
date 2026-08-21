/** Defines the reddit features value. */
export const REDDIT_FEATURES = [
  "identity", "gameplay", "commerce", "referrals", "notifications",
  "matchmaking", "tournaments", "presence",
] as const;
/** Describes reddit feature. */
export type RedditFeature = typeof REDDIT_FEATURES[number];
/** Defines the reddit approval gated features value. */
export const REDDIT_APPROVAL_GATED_FEATURES = ["commerce", "notifications"] as const;
/** Describes reddit approval gated feature. */
type RedditApprovalGatedFeature = typeof REDDIT_APPROVAL_GATED_FEATURES[number];

/** Parses the provider-scoped emergency-off list and rejects unknown names. */
export function parseRedditDisabledFeatures(value: string | undefined): ReadonlySet<RedditFeature> {
  if (!value?.trim()) return new Set();
  const known = new Set<string>(REDDIT_FEATURES);
  const entries = value.split(",").map((entry) => entry.trim()).filter(Boolean);
  const unknown = entries.filter((entry) => !known.has(entry));
  if (unknown.length) throw new Error(`unknown-reddit-feature:${unknown.join(",")}`);
  return new Set(entries as RedditFeature[]);
}

/** Indicates whether is reddit feature enabled. */
export function isRedditFeatureEnabled(feature: RedditFeature, value = process.env.REDDIT_DISABLED_FEATURES): boolean {
  return !parseRedditDisabledFeatures(value).has(feature);
}

/** Parses provider capabilities that must never activate before external approval. */
export function parseRedditApprovedFeatures(value: string | undefined): ReadonlySet<RedditApprovalGatedFeature> {
  if (!value?.trim()) return new Set();
  const known = new Set<string>(REDDIT_APPROVAL_GATED_FEATURES);
  const entries = value.split(",").map((entry) => entry.trim()).filter(Boolean);
  const unknown = entries.filter((entry) => !known.has(entry));
  if (unknown.length) throw new Error(`unknown-reddit-approved-feature:${unknown.join(",")}`);
  return new Set(entries as RedditApprovalGatedFeature[]);
}

/** Resolves reddit client features. */
export function resolveRedditClientFeatures(
  disabled = process.env.REDDIT_DISABLED_FEATURES,
  approved = process.env.REDDIT_APPROVED_FEATURES,
  environment: "sandbox" | "production" = "production",
  sandboxCommerce = process.env.REDDIT_COMMERCE_SANDBOX_ENABLED,
) {
  const approvedFeatures = parseRedditApprovedFeatures(approved);
  return Object.fromEntries(REDDIT_FEATURES.map((feature) => [feature,
    isRedditFeatureEnabled(feature, disabled) &&
    (feature === "commerce" && environment === "sandbox"
      ? sandboxCommerce === "1"
      : !(REDDIT_APPROVAL_GATED_FEATURES as readonly RedditFeature[]).includes(feature) ||
        approvedFeatures.has(feature as RedditApprovalGatedFeature)),
  ])) as Record<RedditFeature, boolean>;
}

/** Indicates whether is reddit commerce enabled. */
export const isRedditCommerceEnabled = (environment: "sandbox" | "production") =>
  resolveRedditClientFeatures(undefined, undefined, environment).commerce;
