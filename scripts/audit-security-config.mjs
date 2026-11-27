import {existsSync, readdirSync, readFileSync, statSync} from "node:fs";
import {fileURLToPath, pathToFileURL} from "node:url";
import {platformServerRoots, webApplications} from "./platform-layout.mjs";

const repositoryRoot = fileURLToPath(new URL("../", import.meta.url));
const portalTargetHtmlPaths = [
  `${repositoryRoot}/platforms/web/facebook/index.html`,
  `${repositoryRoot}/platforms/web/reddit/index.html`,
  `${repositoryRoot}/platforms/web/reddit/reddit-inline.html`,
  `${repositoryRoot}/platforms/web/youtube/index.html`,
  `${repositoryRoot}/platforms/web/netflix/index.html`,
  `${repositoryRoot}/platforms/web/yahoo/index.html`,
  `${repositoryRoot}/platforms/web/gamesnacks/index.html`,
];
const portalTargetSourceEntryPaths = [
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
    if (/\.(?:ts|tsx|js|html)$/u.test(name) && !/\.(?:test|spec)\./u.test(name)) productionFiles.push(path);
  }
};

collectProductionFiles(`${repositoryRoot}/src`);
collectProductionFiles(`${repositoryRoot}/firebase-functions/src`);
for (const target of webApplications) {
  collectProductionFiles(`${repositoryRoot}/platforms/web/${target}/src`);
}
for (const server of platformServerRoots) collectProductionFiles(`${repositoryRoot}/${server}`);
collectProductionFiles(`${repositoryRoot}/platforms/native/android/src`);
for (const directory of ["src", "server", "api", "public", "supabase/functions"]) {
  collectProductionFiles(`${repositoryRoot}/notification-manager/${directory}`);
}
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
  if (path === "platforms/native/android/src/hosted/firebaseClient.ts") {
    // Parsed emulator hosts are local-only; release builds reject emulator configuration.
    source = source.replace('connectAuthEmulator(auth, `http://${config.emulators.host}:${config.emulators.authPort}`, {disableWarnings: true});', "");
  }
  if (path === "platforms/native/android/src/avatar/avatarUrl.ts") {
    // Only local Storage emulator URLs are rewritten for the Android emulator's host bridge.
    source = source.replace('`http://${emulatorHost}`', "");
  }
  return /(?:http|ws):\/\/(?!localhost(?::|\/)|127\.0\.0\.1(?::|\/)|\[::1\](?::|\/))/iu.test(source);
}

const plaintextNetworkReferences = productionFiles.flatMap((path) => {
  const source = readFileSync(path, "utf8");
  return hasPlaintextNetworkReference(path.slice(repositoryRoot.length + 1), source)
    ? [path.slice(repositoryRoot.length + 1)]
    : [];
});

const portalEnvironmentDirectory = `${repositoryRoot}/platforms/web/facebook`;
const facebookEnvironment = readFileSync(`${portalEnvironmentDirectory}/.env.facebook`, "utf8");
const legacyPortalDirectory = `${repositoryRoot}/packages/web-game`;
const legacyPortalEnvironmentFiles = existsSync(legacyPortalDirectory)
  ? readdirSync(legacyPortalDirectory).filter((name) => name === ".env" || name.startsWith(".env."))
  : [];
const facebookBackendUrl = /^VITE_FACEBOOK_FUNCTIONS_BASE_URL=(.+)$/mu.exec(facebookEnvironment)?.[1]?.trim();
const sentryDsn = /^VITE_SENTRY_DSN=(.+)$/mu.exec(facebookEnvironment)?.[1]?.trim();
const googleAnalyticsMeasurementId = /^VITE_GOOGLE_ANALYTICS_MEASUREMENT_ID=(.+)$/mu
  .exec(facebookEnvironment)?.[1]?.trim();
const encryptedFacebookBackend = (() => {
  if (!facebookBackendUrl) return false;
  try {
    return new URL(facebookBackendUrl).protocol === "https:";
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
const googleAnalytics = readFileSync(`${repositoryRoot}/src/observability/analytics/googleAnalytics.ts`, "utf8");
const analyticsConsent = readFileSync(`${repositoryRoot}/src/observability/analytics/GoogleAnalyticsConsentRuntime.tsx`, "utf8");
const analyticsRuntime = readFileSync(`${repositoryRoot}/src/observability/analytics/eventsRuntime.ts`, "utf8");
const browserSentry = readFileSync(`${repositoryRoot}/src/observability/sentry.ts`, "utf8");
const functionSentry = readFileSync(`${repositoryRoot}/firebase-functions/src/shared/sentry.ts`, "utf8");
const facebookReleaseArtifact = readFileSync(`${repositoryRoot}/platforms/web/facebook/scripts/facebook-release-artifact.mjs`, "utf8");
const facebookArtifactAudit = readFileSync(`${repositoryRoot}/platforms/web/facebook/scripts/audit-facebook-artifact.mjs`, "utf8");
const facebookAppCheck = readFileSync(`${repositoryRoot}/platforms/web/facebook/src/FacebookFirebaseAppCheck.ts`, "utf8");
const facebookIdentity = readFileSync(`${repositoryRoot}/platforms/web/facebook/src/credentialExchange.ts`, "utf8");
const facebookAuthentication = readFileSync(`${repositoryRoot}/platforms/web/facebook/src/authenticate.ts`, "utf8");
const facebookIdentityEndpoint = readFileSync(`${repositoryRoot}/platforms/web/facebook/server/facebookEndpoints.ts`, "utf8");
const facebookIdentityVerifier = readFileSync(`${repositoryRoot}/platforms/web/facebook/server/facebookSecurity.ts`, "utf8");

const androidManifest = readFileSync(`${repositoryRoot}/platforms/native/android/android/app/src/main/AndroidManifest.xml`, "utf8");
const androidNetworkSecurity = readFileSync(`${repositoryRoot}/platforms/native/android/android/app/src/main/res/xml/network_security_config.xml`, "utf8");
const notificationHosting = JSON.parse(readFileSync(`${repositoryRoot}/notification-manager/vercel.json`, "utf8"));
const notificationHeaders = new Map((notificationHosting.headers?.find(entry => entry.source === "/(.*)")?.headers ?? [])
  .map(({key, value}) => [key.toLowerCase(), value]));
const notificationHsts = notificationHeaders.get("strict-transport-security") ?? "";
const notificationCsp = notificationHeaders.get("content-security-policy") ?? "";

const requirements = [
  [legacyPortalEnvironmentFiles.length === 0,
    `Legacy portal-root environment files must be removed: ${legacyPortalEnvironmentFiles.join(", ")}`],
  [viteConfiguration.includes('new URL(`../../../platforms/web/${profile.id}/`, import.meta.url)') &&
    /envDir:\s*targetRoot/u.test(viteConfiguration),
  "Vite must load browser configuration only from the selected platform directory."],
  [/android:usesCleartextTraffic="false"/u.test(androidManifest) &&
    /android:networkSecurityConfig="@xml\/network_security_config"/u.test(androidManifest) &&
    /<base-config\s+cleartextTrafficPermitted="false"/u.test(androidNetworkSecurity) &&
    !/cleartextTrafficPermitted="true"/u.test(androidNetworkSecurity),
    "Android release networking must reject cleartext traffic; emulator exceptions belong only in debug resources."],
  [Number(/max-age=(\d+)/iu.exec(notificationHsts)?.[1] ?? 0) >= 31_536_000 &&
    /\bincludesubdomains\b/iu.test(notificationHsts) &&
    /\bupgrade-insecure-requests\b/u.test(notificationCsp) && /\bblock-all-mixed-content\b/u.test(notificationCsp) &&
    !/(?:^|[;\s])(?:http|ws):\/\//iu.test(notificationCsp),
    "Notification manager hosting must enforce HTTPS through HSTS and mixed-content protection."],
  [encryptedFacebookBackend, "The production Facebook backend URL must use HTTPS."],
  [encryptedSentryDsn, "The production Sentry DSN must use an official encrypted Sentry endpoint."],
  [googleAnalyticsMeasurementId === "G-1YZP6C2H4V",
    "The Facebook production environment must select its registered Google Analytics stream."],
  [analyticsConsent.includes('=== "granted"') && analyticsConsent.includes("decision.current") &&
    analyticsConsent.includes("!configured || !enabled") && analyticsConsent.includes("stop.current()") &&
    analyticsRuntime.includes("let collectionEnabled = false") &&
    googleAnalytics.includes('analytics_storage: "denied"') && googleAnalytics.includes('ad_storage: "denied"') &&
    googleAnalytics.includes("allow_google_signals: false") && googleAnalytics.includes("allow_ad_personalization_signals: false") &&
    googleAnalytics.includes("!isCurrent()") && googleAnalytics.includes("isBrowserTelemetryRuntimeAllowed()") &&
    !portalTargetSourceEntries.includes("initializeGoogleAnalytics") &&
    portalTargetHtmlPaths.every(path => !/(?:google-analytics|googletagmanager)\.com/u.test(readFileSync(path, "utf8"))),
    "Google Analytics requires affirmative persisted consent, immediate revocation, production/session guards and disabled advertising; entry documents must never load it eagerly."],
  [/tracesSampleRate:\s*0/u.test(browserSentry) && /tracesSampleRate:\s*0/u.test(functionSentry) &&
    !/captureConsoleIntegration/u.test(browserSentry),
  "Sentry must remain essential errors-only without performance tracing or console-event capture."],
  [facebookAppCheck.includes("provider: new CustomProvider(") &&
    facebookAppCheck.includes("await getToken(appCheck, true)") &&
    facebookAppCheck.includes("setTokenAutoRefreshEnabled(appCheck, true)") &&
    facebookAuthentication.includes("await firebaseRuntime.initializeAppCheck(") &&
    facebookAuthentication.includes("credentials.uid !== initialCredentials.uid") &&
    facebookIdentityEndpoint.includes("getAppCheck().createToken(firebaseAppId"),
    "Facebook App Check must use renewable signed-identity attestation bound to the active account generation."],
  [facebookIdentity.includes("sdk.player.getSignedPlayerInfoAsync(nonce)") &&
    facebookIdentity.includes("signed.getPlayerID() !== playerId") &&
    facebookIdentityEndpoint.includes("await verifyFacebookSignedPlayer(input.signedPlayer") &&
    facebookIdentityEndpoint.includes("expectedNonce: input.nonce") &&
    facebookIdentityVerifier.includes("timingSafeEqual(actualSignature, expectedSignature)") &&
    facebookIdentityVerifier.includes("facebook-nonce-replayed"),
    "Facebook identity must verify the exact player, signed HMAC assertion and one-use request nonce before issuing credentials."],
  [/sourcemap:\s*uploadSentrySourceMaps\s*\?\s*"hidden"\s*:\s*false/u.test(viteConfiguration),
    "Production source maps must be hidden and generated only for private Sentry upload."],
  [/facebook:\s*environment\.FACEBOOK_BUILD_OUT_DIR\?\.trim\(\)\s*\|\|\s*canonicalBuildOutputDirectories\.facebook/u
    .test(viteConfiguration) &&
    /const selectedBuildOutDir\s*=\s*path\.resolve\(portalPackageDirectory, buildOutputDirectories\[profile\.id\]\)/u.test(viteConfiguration) &&
    viteConfiguration.includes("assets: `${selectedBuildOutDir}/**`") &&
    viteConfiguration.includes("filesToDeleteAfterUpload: `${selectedBuildOutDir}/**/*.map`") &&
    facebookArtifactAudit.includes('file.endsWith(".map")'),
    "Private source maps must be deleted from the selected Facebook build directory and rejected by artifact auditing."],
  [facebookArtifactAudit.includes("https://connect.facebook.net/en_US/fbinstant.8.0.js") &&
    facebookArtifactAudit.includes("allowedExternalEntryResources.has(reference)"),
    "Facebook artifacts must use the encrypted official Instant Games SDK without additional external entry scripts."],
  [/"import\.meta\.env\.VITE_PLATFORM_TARGET":\s*JSON\.stringify\(profile\.id\)/u.test(viteConfiguration),
    "The resolved Web Target must be the sole compile-time source of runtime platform identity."],
  [/function webTargetBuildContractPlugin/u.test(viteConfiguration) &&
    /configResolved\(config\)/u.test(viteConfiguration) &&
    /resolved !== expected/u.test(viteConfiguration),
  "The final Vite output directory must match the directory selected for artifact auditing."],
  [/Private Sentry source-map upload requires:/u.test(viteConfiguration),
    "Requested Sentry source-map uploads must fail closed when configuration is missing."],
  [facebookReleaseArtifact.includes("record.source?.commit !== sourceCommit") &&
    facebookReleaseArtifact.includes("record.archive.sha256 !== facebookArtifactSha256(contents)") &&
    facebookReleaseArtifact.includes('if (sourceDirty) throw new Error('),
    "Facebook uploads must bind the gated artifact hash to a clean, unchanged source revision."],
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
  console.log("Security configuration audit passed: encrypted transport, signed Facebook identity, custom App Check, consent, and artifact boundaries verified.");
}
