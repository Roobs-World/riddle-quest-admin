import {readdirSync, readFileSync, statSync} from "node:fs";
import {fileURLToPath} from "node:url";

const ACTIVATION_PATTERN = /\b(?:FacebookCommerceCapability|FacebookPurchaseRecovery|verifyFacebookSignedPurchase)\b/u;
const FACEBOOK_COMMERCE_RUNTIME = new Set([
  "platforms/web/facebook/src/FacebookCommerceSession.ts",
  "platforms/web/facebook/src/facebookCallableResponses.ts",
]);

const collect = (directory, output = []) => {
  for (const name of readdirSync(directory)) {
    const path = `${directory}/${name}`;
    const stat = statSync(path);
    if (stat.isDirectory()) {
      if (name !== "node_modules" && !name.startsWith("dist") && name !== "__tests__") collect(path, output);
    } else if (stat.isFile() && /\.(?:ts|tsx|js|jsx)$/u.test(name)) output.push(path);
  }
  return output;
};

/** Confines checkout to the authenticated Facebook session and its server authority. */
export function auditFacebookCommerceActivation({runtimeSources, bootstrapSource, serverSources = []}) {
  const activated = runtimeSources.filter(({source}) => ACTIVATION_PATTERN.test(source));
  const failures = runtimeSources
    .filter(({name, source}) => ACTIVATION_PATTERN.test(source) && !FACEBOOK_COMMERCE_RUNTIME.has(name.replace(/^\/+/, "")))
    .map(({name}) => `Facebook commerce imported outside its authenticated target adapter: ${name}`);
  if (!/\bcommerce:\s*false\s*,/u.test(bootstrapSource)) {
    failures.push("Facebook bootstrap must keep commerce capability availability false.");
  }
  if (/\bcapabilities\s*:\s*\{[^}]*\bcommerce\s*:/su.test(bootstrapSource) ||
    /\bnew\s+FacebookCommerceCapability\b/u.test(bootstrapSource)) {
    failures.push("Facebook bootstrap must not expose commerce before authentication.");
  }
  if (activated.length > 0) {
    const authority = serverSources.join("\n");
    for (const boundary of [
      "verifyFacebookSignedPurchase",
      "grantVerifiedFacebookPurchase",
      "FACEBOOK_PAYMENTS_WEBHOOK_ENABLED",
      "timingSafeEqual",
      "facebookPaymentTokens",
    ]) {
      if (!authority.includes(boundary)) failures.push(`Facebook commerce authority is missing ${boundary}.`);
    }
  }
  return failures;
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const root = fileURLToPath(new URL("../../../../", import.meta.url));
  const bootstrapPath = `${root}/platforms/web/facebook/src/FacebookPlatformBootstrap.ts`;
  const excluded = new Set([
    bootstrapPath,
    `${root}/platforms/web/facebook/src/FacebookCommerceCapability.ts`,
    `${root}/platforms/web/facebook/src/FacebookPurchaseRecovery.ts`,
  ]);
  const paths = collect(`${root}/src`).filter((path) => !excluded.has(path));
  const failures = auditFacebookCommerceActivation({
    runtimeSources: paths.map((path) => ({name: path.slice(root.length), source: readFileSync(path, "utf8")})),
    bootstrapSource: readFileSync(bootstrapPath, "utf8"),
    serverSources: ["facebookPaymentContracts.ts", "facebookPayments.ts", "facebookCommerceLedger.ts"].map((name) =>
      readFileSync(`${root}/platforms/web/facebook/server/${name}`, "utf8")),
  });
  if (failures.length > 0) throw new Error(`Facebook commerce-activation audit failed:\n- ${failures.join("\n- ")}`);
  console.log("Facebook commerce-activation audit passed: target-local adapter, authenticated startup, receipt and webhook authority.");
}
