import {existsSync, readdirSync, readFileSync, statSync} from "node:fs";
import {fileURLToPath, pathToFileURL} from "node:url";

const repositoryRoot = fileURLToPath(new URL("../", import.meta.url));
const portalTargetHtmlPaths = [
  `${repositoryRoot}/platforms/web/jest/index.html`,
  `${repositoryRoot}/platforms/web/facebook/index.html`,
  `${repositoryRoot}/platforms/web/reddit/index.html`,
  `${repositoryRoot}/platforms/web/reddit/reddit-inline.html`,
  `${repositoryRoot}/platforms/web/youtube/index.html`,
];
const portalTargetSourceEntryPaths = [
  `${repositoryRoot}/platforms/web/jest/src/main.tsx`,
  `${repositoryRoot}/platforms/web/facebook/src/main.tsx`,
  `${repositoryRoot}/platforms/web/reddit/src/main.tsx`,
  `${repositoryRoot}/platforms/web/youtube/src/main.tsx`,
];

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

collectProductionFiles(`${repositoryRoot}/src`);
collectProductionFiles(`${repositoryRoot}/firebase-functions/src`);
for (const target of ["jest", "facebook", "reddit", "youtube", "netflix", "yahoo", "gamesnacks"]) {
  collectProductionFiles(`${repositoryRoot}/platforms/web/${target}/src`);
  if (existsSync(`${repositoryRoot}/platforms/web/${target}/server`)) collectProductionFiles(`${repositoryRoot}/platforms/web/${target}/server`);
}
collectProductionFiles(`${repositoryRoot}/platforms/native/android/server`);
productionFiles.push(...portalTargetHtmlPaths);

/** Audits source text for network references that bypass encrypted transport. */
export function hasPlaintextNetworkReference(path, source) {
  if (path === "platforms/native/android/server/playDeveloperApi.ts") {
    // Google's runtime metadata token transport is fixed to this private endpoint.
    source = source.replace(/\bconst METADATA_TOKEN_URL\s*=\s*"http:\/\/metadata\.google\.internal\/computeMetadata\/v1\/instance\/service-accounts\/default\/token";/u, "");
  }
  if (path === "firebase-functions/src/profile/avatarUpload.ts" &&
    /\bconst emulator\s*=\s*process\.env\.FUNCTIONS_EMULATOR\s*===\s*"true"\s*\?\s*process\.env\.FIREBASE_STORAGE_EMULATOR_HOST\s*:\s*undefined;/u.test(source)) {
    // Exempt only the guarded emulator origin; the production fallback must stay encrypted.
    source = source.replace(/\bconst origin\s*=\s*emulator\s*\?\s*new URL\(`http:\/\/\$\{emulator\}`\)\.origin\s*:\s*"https:\/\/firebasestorage\.googleapis\.com";/u, "");
  }
  return /(?:http|ws):\/\/(?!localhost(?::|\/)|127\.0\.0\.1(?::|\/)|\[::1\](?::|\/))/iu.test(source);
}

const plaintextNetworkReferences = productionFiles.flatMap((path) => {
  const source = readFileSync(path, "utf8");
  return hasPlaintextNetworkReference(path.slice(repositoryRoot.length + 1), source)
    ? [path.slice(repositoryRoot.length + 1)]
    : [];
});

const portalEnvironmentDirectory = `${repositoryRoot}/platforms/web/jest`;
const jestEnvironment = readFileSync(`${portalEnvironmentDirectory}/.env.jest`, "utf8");
const legacyPortalDirectory = `${repositoryRoot}/packages/web-game`;
const legacyPortalEnvironmentFiles = existsSync(legacyPortalDirectory)
  ? readdirSync(legacyPortalDirectory).filter((name) => name === ".env" || name.startsWith(".env."))
  : [];
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

const viteConfiguration = [
  readFileSync(`${repositoryRoot}/vite.config.ts`, "utf8"),
  readFileSync(`${repositoryRoot}/scripts/web/build/webTargetViteConfig.ts`, "utf8"),
].join("\n");
const portalTargetSourceEntries = portalTargetSourceEntryPaths
  .map((path) => readFileSync(path, "utf8"))
  .join("\n");
const analyticsAdapterPath = `${repositoryRoot}/src/web/analytics/firebaseAnalytics.ts`;
const browserSentry = readFileSync(`${repositoryRoot}/src/web/observability/sentry.ts`, "utf8");
const functionSentry = readFileSync(`${repositoryRoot}/firebase-functions/src/shared/sentry.ts`, "utf8");
const jestReleaseScript = readFileSync(
  `${repositoryRoot}/platforms/web/jest/scripts/release-jest-timestamped.mjs`,
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
  [viteConfiguration.includes('new URL(`../../../platforms/web/${profile.id}/`, import.meta.url)') &&
    /envDir:\s*targetRoot/u.test(viteConfiguration),
  "Vite must load browser configuration only from the selected platform directory."],
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
  [!portalTargetSourceEntries.includes("initializeGoogleAnalytics") && !existsSync(analyticsAdapterPath),
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
  [/const jestBuildOutDir\s*=\s*environment\.JEST_BUILD_OUT_DIR\?\.trim\(\)\s*\|\|\s*canonicalBuildOutputDirectories\.jest/u
    .test(viteConfiguration) &&
    /jest:\s*jestBuildOutDir/u.test(viteConfiguration) &&
    /const selectedBuildOutDir\s*=\s*path\.resolve\(portalPackageDirectory, buildOutputDirectories\[profile\.id\]\)/u.test(viteConfiguration) &&
    viteConfiguration.includes("assets: `${selectedBuildOutDir}/**`") &&
    viteConfiguration.includes("filesToDeleteAfterUpload: `${selectedBuildOutDir}/**/*.map`") &&
    /JEST_BUILD_OUT_DIR:\s*releaseBuildDirectory/u.test(jestReleaseScript),
  "Private source maps must be deleted from the selected Jest build directory before artifact packaging."],
  [/"import\.meta\.env\.VITE_PLATFORM_TARGET":\s*JSON\.stringify\(profile\.id\)/u.test(viteConfiguration),
    "The resolved Web Target must be the sole compile-time source of runtime platform identity."],
  [/function webTargetBuildContractPlugin/u.test(viteConfiguration) &&
    /configResolved\(config\)/u.test(viteConfiguration) &&
    /resolved !== expected/u.test(viteConfiguration),
  "The final Vite output directory must match the directory selected for artifact auditing."],
  [/Private Sentry source-map upload requires:/u.test(viteConfiguration),
    "Requested Sentry source-map uploads must fail closed when configuration is missing."],
  [/VITE_SENTRY_RELEASE:\s*sentryRelease/u.test(jestReleaseScript),
    "Timestamped Jest releases must share their immutable identifier with Sentry."],
  [plaintextNetworkReferences.length === 0,
    `Production source contains plaintext network URLs: ${plaintextNetworkReferences.join(", ")}`],
];

/** Verifies the collected production sources and deployment security configuration. */
export function auditSecurityConfiguration() {
  const failures = requirements.filter(([passed]) => !passed).map(([, message]) => message);
  if (failures.length > 0) throw new Error(`Security configuration audit failed:\n- ${failures.join("\n- ")}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  auditSecurityConfiguration();
  console.log("Security configuration audit passed: production endpoints, CSP, and HSTS enforce encrypted transport.");
}
