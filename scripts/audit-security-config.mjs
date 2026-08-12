import {existsSync, readdirSync, readFileSync, statSync} from "node:fs";
import {fileURLToPath} from "node:url";

const repositoryRoot = fileURLToPath(new URL("../", import.meta.url));

const productionFiles = [];
const collectProductionFiles = (directory) => {
  for (const name of readdirSync(directory)) {
    const path = `${directory}/${name}`;
    if (name === "__tests__" || name === "testing" || name === "node_modules") continue;
    if (statSync(path).isDirectory()) {
      collectProductionFiles(path);
      continue;
    }
    if (/\.(?:ts|tsx|html)$/u.test(name) && !/\.(?:test|spec)\./u.test(name)) productionFiles.push(path);
  }
};

collectProductionFiles(`${repositoryRoot}/packages/portal/src`);
collectProductionFiles(`${repositoryRoot}/firebase-functions/src`);
productionFiles.push(`${repositoryRoot}/packages/portal/index.html`);

const plaintextNetworkReferences = productionFiles.flatMap((path) => {
  const source = readFileSync(path, "utf8");
  return /(?:http|ws):\/\/(?!localhost(?::|\/)|127\.0\.0\.1(?::|\/)|\[::1\](?::|\/))/iu.test(source)
    ? [path.slice(repositoryRoot.length + 1)]
    : [];
});

const portalEnvironmentDirectory = `${repositoryRoot}/config/vite/portal`;
const jestEnvironment = readFileSync(`${portalEnvironmentDirectory}/.env.jest`, "utf8");
const legacyPortalEnvironmentFiles = readdirSync(`${repositoryRoot}/packages/portal`)
  .filter((name) => name === ".env" || name.startsWith(".env."));
const jestBackendUrl = /^VITE_JEST_FUNCTIONS_BASE_URL=(.+)$/mu.exec(jestEnvironment)?.[1]?.trim();
const appCheckSiteKey = /^VITE_FIREBASE_APP_CHECK_SITE_KEY=(.+)$/mu.exec(jestEnvironment)?.[1]?.trim();
const sentryDsn = /^VITE_SENTRY_DSN=(.+)$/mu.exec(jestEnvironment)?.[1]?.trim();
const googleAnalyticsMeasurementId = /^VITE_GOOGLE_ANALYTICS_MEASUREMENT_ID=(.+)$/mu
  .exec(jestEnvironment)?.[1]?.trim();
const encryptedJestBackend = (() => {
  if (!jestBackendUrl) return false;
  try {
    return new URL(jestBackendUrl).protocol === "https:";
  } catch {
    return false;
  }
})();
const encryptedSentryDsn = (() => {
  if (!sentryDsn) return false;
  try {
    const url = new URL(sentryDsn);
    return url.protocol === "https:" && /(?:^|\.)sentry\.io$/u.test(url.hostname);
  } catch {
    return false;
  }
})();

const viteConfiguration = readFileSync(`${repositoryRoot}/packages/portal/vite.config.ts`, "utf8");
const portalEntry = readFileSync(`${repositoryRoot}/packages/portal/src/main.tsx`, "utf8");
const analyticsAdapterPath = `${repositoryRoot}/packages/portal/src/analytics/firebaseAnalytics.ts`;
const browserSentry = readFileSync(`${repositoryRoot}/packages/portal/src/observability/sentry.ts`, "utf8");
const functionSentry = readFileSync(`${repositoryRoot}/firebase-functions/src/shared/sentry.ts`, "utf8");
const jestReleaseScript = readFileSync(
  `${repositoryRoot}/packages/portal/scripts/release-jest-timestamped.mjs`,
  "utf8",
);

const firebaseConfig = JSON.parse(readFileSync(new URL("../firebase.json", import.meta.url), "utf8"));
const globalHeaders = firebaseConfig.hosting?.headers?.find((entry) => entry.source === "**")?.headers ?? [];
const headerValues = new Map(globalHeaders.map(({key, value}) => [key.toLowerCase(), value]));
const hsts = headerValues.get("strict-transport-security") ?? "";
const contentSecurityPolicy = headerValues.get("content-security-policy") ?? "";

const requirements = [
  [legacyPortalEnvironmentFiles.length === 0,
    `Legacy portal-root environment files must be removed: ${legacyPortalEnvironmentFiles.join(", ")}`],
  [/new URL\("\.\.\/\.\.\/config\/vite\/portal\/", import\.meta\.url\)/u.test(viteConfiguration) &&
    /envDir:\s*portalEnvironmentDirectory/u.test(viteConfiguration),
  "Vite must load browser configuration only from the dedicated repository-level env directory."],
  [Number(/max-age=(\d+)/i.exec(hsts)?.[1] ?? 0) >= 31_536_000,
    "HSTS must remain enabled for at least one year."],
  [/\bincludesubdomains\b/i.test(hsts), "HSTS must cover subdomains."],
  [/\bupgrade-insecure-requests\b/i.test(contentSecurityPolicy),
    "CSP must upgrade insecure requests."],
  [/\bblock-all-mixed-content\b/i.test(contentSecurityPolicy),
    "CSP must block mixed content."],
  [!/(?:^|[;\s])(?:http|ws):\/\//i.test(contentSecurityPolicy),
    "CSP must not allow plaintext HTTP or WebSocket origins."],
  [encryptedJestBackend, "The production Jest backend URL must use HTTPS."],
  [encryptedSentryDsn, "The production Sentry DSN must use an official encrypted Sentry endpoint."],
  [!googleAnalyticsMeasurementId,
    "The Jest production environment must not configure Google Analytics before a consent/opt-out design exists."],
  [!/(?:google-analytics|googletagmanager)\.com/iu.test(contentSecurityPolicy),
    "The production CSP must not authorize Google Analytics or Tag Manager endpoints."],
  [!portalEntry.includes("initializeGoogleAnalytics") && !existsSync(analyticsAdapterPath),
  "The unused Firebase Analytics adapter must remain absent until an affirmative consent design exists."],
  [/tracesSampleRate:\s*0/u.test(browserSentry) && /tracesSampleRate:\s*0/u.test(functionSentry) &&
    !/captureConsoleIntegration/u.test(browserSentry),
  "Sentry must remain essential errors-only without performance tracing or console-event capture."],
  [/https:\/\/\*\.sentry\.io/u.test(contentSecurityPolicy),
    "CSP must allow encrypted Sentry event ingestion."],
  [/^[\w-]{30,}$/u.test(appCheckSiteKey ?? ""),
    "The production Jest build must include a Firebase App Check site key."],
  [/sourcemap:\s*uploadSentrySourceMaps\s*\?\s*"hidden"\s*:\s*false/u.test(viteConfiguration),
    "Production source maps must be hidden and generated only for private Sentry upload."],
  [/const jestBuildOutDir\s*=\s*process\.env\.JEST_BUILD_OUT_DIR\?\.trim\(\)\s*\|\|\s*"dist-jest"/u
    .test(viteConfiguration) &&
    viteConfiguration.includes("assets: `${jestBuildOutDir}/**`") &&
    viteConfiguration.includes("filesToDeleteAfterUpload: `${jestBuildOutDir}/**/*.map`") &&
    /JEST_BUILD_OUT_DIR:\s*releaseBuildDirectory/u.test(jestReleaseScript),
  "Private source maps must be deleted from the selected Jest build directory before artifact packaging."],
  [/Private Sentry source-map upload requires:/u.test(viteConfiguration),
    "Requested Sentry source-map uploads must fail closed when configuration is missing."],
  [/VITE_SENTRY_RELEASE:\s*sentryRelease/u.test(jestReleaseScript),
    "Timestamped Jest releases must share their immutable identifier with Sentry."],
  [plaintextNetworkReferences.length === 0,
    `Production source contains plaintext network URLs: ${plaintextNetworkReferences.join(", ")}`],
];

const failures = requirements.filter(([passed]) => !passed).map(([, message]) => message);
if (failures.length > 0) throw new Error(`Security configuration audit failed:\n- ${failures.join("\n- ")}`);

console.log("Security configuration audit passed: production endpoints, CSP, and HSTS enforce encrypted transport.");
