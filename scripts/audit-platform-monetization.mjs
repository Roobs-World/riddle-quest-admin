#!/usr/bin/env node
import {readFile} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("..", import.meta.url));
const read = (relative) => readFile(path.join(root, relative), "utf8");

export async function auditPlatformMonetization() {
  const [policySource, dashboardSource, jestPurchases, facebookEntry, facebookBootstrap, redditConfigSource,
    redditProductsSource, redditClient, yahooCommerce, youtubeAudit] = await Promise.all([
    read("config/platform-monetization.json"), read("docs/reports/platform-release-readiness/src/data.json"),
    read("packages/portal/src/jest/purchases.ts"), read("packages/portal/src/facebook/FacebookPlatformEntry.tsx"),
    read("packages/portal/src/facebook/FacebookPlatformBootstrap.ts"), read("packages/reddit-app/devvit.json"),
    read("packages/reddit-app/products.json"), read("packages/portal/src/reddit/RedditPlatformBootstrap.ts"),
    read("packages/portal/src/yahoo/yahooStripeCommerce.ts"), read("packages/portal/scripts/audit-youtube-artifact.mjs"),
  ]);
  const policy = JSON.parse(policySource);
  const dashboard = JSON.parse(dashboardSource);
  const failures = [];
  const rows = policy.platforms;
  const names = rows.map(({platform}) => platform);
  const expected = new Set([
    ...dashboard.queries.provider_release_evidence.rows.map(({platform}) => platform),
    ...dashboard.queries.html5_distribution_candidates.rows.map(({platform}) => platform),
  ]);
  if (policy.schemaVersion !== 1 || new Set(names).size !== names.length) failures.push("Monetization policy must contain unique v1 platform rows.");
  for (const platform of expected) if (!names.includes(platform)) failures.push(`${platform} is missing a monetization policy.`);
  for (const {platform, iap, ads, gate} of rows) {
    if (![platform, iap, ads, gate].every((value) => typeof value === "string" && value.trim())) failures.push(`${platform || "Unknown platform"} has an incomplete monetization policy.`);
  }
  if (JSON.stringify(dashboard.queries.monetization_readiness?.rows) !== JSON.stringify(rows)) failures.push("Dashboard monetization rows do not match the canonical policy.");
  if (!/getIncompletePurchases/u.test(jestPurchases) || !/completePurchase/u.test(jestPurchases) || !/backend\.grantPurchase/u.test(jestPurchases)) failures.push("Jest purchase grant/recovery ordering is missing.");
  if (!/createFacebookAdsCapability/u.test(facebookEntry) || !/VITE_FACEBOOK_INTERSTITIAL_PLACEMENT_ID/u.test(facebookEntry) || !/VITE_FACEBOOK_REWARDED_PLACEMENT_ID/u.test(facebookEntry)) failures.push("Facebook ad capability or placement boundary is missing.");
  if (!/commerce:\s*false/u.test(facebookBootstrap)) failures.push("Unverified Facebook IAP must remain unreachable.");
  const redditConfig = JSON.parse(redditConfigSource);
  const redditProducts = JSON.parse(redditProductsSource);
  if (redditConfig.permissions?.payments !== true || !redditConfig.payments?.endpoints?.fulfillOrder || !redditConfig.payments?.endpoints?.refundOrder) failures.push("Reddit payment permissions and handlers must be configured.");
  if (!Array.isArray(redditProducts.products) || redditProducts.products.length < 1 || !/purchase\(productId/u.test(redditClient)) failures.push("Reddit Gold products or client purchase flow is missing.");
  if (!/createYahooStripeCheckout/u.test(yahooCommerce) || !/checkout\.stripe\.com/u.test(yahooCommerce)) failures.push("Yahoo Stripe checkout boundary is missing.");
  if (!/purchase integration/u.test(youtubeAudit)) failures.push("YouTube artifact audit must continue rejecting purchase integration.");
  if (failures.length) throw new Error(`Platform monetization audit failed:\n- ${failures.join("\n- ")}`);
  return rows;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  auditPlatformMonetization()
    .then((rows) => console.log(`Platform monetization audit passed for ${rows.length} targets.`))
    .catch((error) => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
}
