#!/usr/bin/env node
import {readFile} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import path from "node:path";
import {listPlatformReleasePlans} from "./release/platform-releases.mjs";
import {expectedName} from "./release/release-target-names.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const read = (relative) => readFile(path.join(root, relative), "utf8");

export async function auditPlatformMonetization() {
  const [policySource, jestPurchases, jestCheckout, jestRecovery] = await Promise.all([
    read("config/platform-monetization.json"),
    read("platforms/web/jest/src/purchases.ts"),
    read("platforms/web/jest/src/purchaseCheckout.ts"),
    read("platforms/web/jest/src/purchaseReconciliation.ts"),
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
  const grantsBeforeCompletion = (source) => {
    const grant = /await\s+backend\.grantPurchase\s*\(/u.exec(source);
    const completion = /await\s+platform\.completePurchase\s*\(/u.exec(source);
    return grant !== null && completion !== null && grant.index < completion.index;
  };
  if (!/getIncompletePurchases/u.test(jestPurchases) ||
      !/import\("\.\/purchaseCheckout"\)/u.test(jestPurchases) || !/return checkoutConsumable\(/u.test(jestPurchases) ||
      !/import\("\.\/purchaseReconciliation"\)/u.test(jestPurchases) || !/return reconcileJestPurchases\(/u.test(jestPurchases) ||
      !/getIncompletePurchases/u.test(jestRecovery) || !grantsBeforeCompletion(jestCheckout) || !grantsBeforeCompletion(jestRecovery))
    failures.push("Jest purchase grant/recovery ordering is missing.");
  if (failures.length) throw new Error(`Platform monetization audit failed:\n- ${failures.join("\n- ")}`);
  return rows;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  auditPlatformMonetization()
    .then((rows) => console.log(`Platform monetization audit passed for ${rows.length} targets.`))
    .catch((error) => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
}
