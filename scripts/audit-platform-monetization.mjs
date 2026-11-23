#!/usr/bin/env node
import {readFile} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import path from "node:path";
import {listPlatformReleasePlans} from "./release/platform-releases.mjs";
import {expectedName} from "./release/release-target-names.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const read = (relative) => readFile(path.join(root, relative), "utf8");

export async function auditPlatformMonetization() {
  const [policySource, jestPurchases, facebookEntry, facebookBootstrap, facebookCommerce,
    redditConfigSource, redditProductsSource, redditClient, youtubeAudit, standaloneAudit, yahooEntry] = await Promise.all([
    read("config/platform-monetization.json"),
    read("platforms/web/jest/src/purchases.ts"), read("platforms/web/facebook/src/FacebookPlatformEntry.tsx"),
    read("platforms/web/facebook/src/FacebookPlatformBootstrap.ts"),
    read("platforms/web/facebook/src/FacebookCommerceCapability.ts"), read("platforms/web/reddit/devvit.json"),
    read("platforms/web/reddit/products.json"), read("platforms/web/reddit/src/RedditPlatformBootstrap.ts"),
    read("platforms/web/youtube/scripts/audit-youtube-artifact.mjs"),
    read("packages/web-game/scripts/audit-standalone-artifact.mjs"), read("platforms/web/yahoo/index.html"),
  ]);
  const policy = JSON.parse(policySource);
  const failures = [];
  const rows = policy.platforms;
  const names = rows.map(({platform}) => platform);
  /** Every executable release target needs a canonical monetization policy. */
  const expected = new Set(listPlatformReleasePlans().map(expectedName));
  if (policy.schemaVersion !== 1 || new Set(names).size !== names.length) failures.push("Monetization policy must contain unique v1 platform rows.");
  for (const platform of expected) if (!names.includes(platform)) failures.push(`${platform} is missing a monetization policy.`);
  for (const {platform, iap, ads, gate} of rows) {
    if (![platform, iap, ads, gate].every((value) => typeof value === "string" && value.trim())) failures.push(`${platform || "Unknown platform"} has an incomplete monetization policy.`);
  }
  if (!/getIncompletePurchases/u.test(jestPurchases) || !/completePurchase/u.test(jestPurchases) || !/backend\.grantPurchase/u.test(jestPurchases)) failures.push("Jest purchase grant/recovery ordering is missing.");
  if (!/createFacebookAdsCapability/u.test(facebookEntry) || !/VITE_FACEBOOK_INTERSTITIAL_PLACEMENT_ID/u.test(facebookEntry) || !/VITE_FACEBOOK_REWARDED_PLACEMENT_ID/u.test(facebookEntry)) failures.push("Facebook ad capability or placement boundary is missing.");
  if (!/commerce:\s*false/u.test(facebookBootstrap)) failures.push("Facebook commerce must remain unavailable before authentication.");
  if (!/new FacebookCommerceSession/u.test(facebookEntry) || !/clientConfiguration\.commerceEnabled/u.test(facebookEntry)) failures.push("Facebook payments must use the authenticated server-gated adapter.");
  if (!/price:\s*product\.price/u.test(facebookCommerce)) failures.push("Facebook commerce must preserve Meta's formatted catalog price.");
  const redditConfig = JSON.parse(redditConfigSource);
  const redditProducts = JSON.parse(redditProductsSource);
  if (redditConfig.permissions?.payments !== true || !redditConfig.payments?.endpoints?.fulfillOrder || !redditConfig.payments?.endpoints?.refundOrder) failures.push("Reddit payment permissions and handlers must be configured.");
  if (!Array.isArray(redditProducts.products) || redditProducts.products.length < 1 || !/purchase\(productId/u.test(redditClient)) failures.push("Reddit Gold products or client purchase flow is missing.");
  if (!/purchase integration/u.test(youtubeAudit)) failures.push("YouTube artifact audit must continue rejecting purchase integration.");
  if (!/src\/standalone\/main\.tsx/u.test(yahooEntry)) failures.push("Yahoo candidate must use the provider-neutral standalone entry.");
  if (!/commerce or advertising/u.test(standaloneAudit) || !/checkout/u.test(standaloneAudit)) failures.push("Yahoo and Netflix candidate audits must reject checkout integration.");
  if (failures.length) throw new Error(`Platform monetization audit failed:\n- ${failures.join("\n- ")}`);
  return rows;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  auditPlatformMonetization()
    .then((rows) => console.log(`Platform monetization audit passed for ${rows.length} targets.`))
    .catch((error) => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
}
