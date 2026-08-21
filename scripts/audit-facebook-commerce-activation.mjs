import {readdirSync, readFileSync, statSync} from "node:fs";
import {fileURLToPath} from "node:url";

const ACTIVATION_PATTERN = /\b(?:FacebookCommerceCapability|FacebookPurchaseRecovery|verifyFacebookSignedPurchase)\b/u;

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

/** Keeps unverified commerce code unreachable until captured Meta contracts exist. */
export function auditFacebookCommerceActivation({runtimeSources, bootstrapSource}) {
  const failures = runtimeSources
    .filter(({source}) => ACTIVATION_PATTERN.test(source))
    .map(({name}) => `Staged Facebook commerce imported or activated by runtime source: ${name}`);
  if (!/\bcommerce:\s*false\s*,/u.test(bootstrapSource)) {
    failures.push("Facebook bootstrap must keep commerce capability availability false.");
  }
  if (/\bcapabilities\s*:\s*\{[^}]*\bcommerce\s*:/su.test(bootstrapSource) ||
    /\bnew\s+FacebookCommerceCapability\b/u.test(bootstrapSource)) {
    failures.push("Facebook bootstrap must not expose the staged commerce capability.");
  }
  return failures;
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const root = fileURLToPath(new URL("../", import.meta.url));
  const bootstrapPath = `${root}/packages/portal/src/facebook/FacebookPlatformBootstrap.ts`;
  const excluded = new Set([
    bootstrapPath,
    `${root}/packages/portal/src/facebook/FacebookCommerceCapability.ts`,
    `${root}/packages/portal/src/facebook/FacebookPurchaseRecovery.ts`,
  ]);
  const paths = collect(`${root}/packages/portal/src`).filter((path) => !excluded.has(path));
  const failures = auditFacebookCommerceActivation({
    runtimeSources: paths.map((path) => ({name: path.slice(root.length), source: readFileSync(path, "utf8")})),
    bootstrapSource: readFileSync(bootstrapPath, "utf8"),
  });
  if (failures.length > 0) throw new Error(`Facebook commerce-activation audit failed:\n- ${failures.join("\n- ")}`);
  console.log("Facebook commerce-activation audit passed: unverified commerce remains unreachable.");
}
