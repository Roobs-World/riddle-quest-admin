import {readFile} from "node:fs/promises";
import path from "node:path";
import {inspectWebTargetArtifact} from "./web-target-artifact-inventory.mjs";

const inventory = await inspectWebTargetArtifact({
  rootDirectory: process.argv[2] || process.env.JEST_BUILD_OUT_DIR?.trim() || "../../builds/jest",
  target: "jest",
});
const {files, root, sizedFiles, totalBytes: artifactBytes} = inventory;
const maximumArtifactBytes = 5 * 1024 * 1024;
const maximumReleaseBudgetBytes = 4.75 * 1024 * 1024;
const maximumInitialResourceBytes = 0.55 * 1024 * 1024;
const jestSdkEntryResource = "https://cdn.jest.com/sdk/latest/jestsdk.js";
const allowedExternalEntryResources = new Set([jestSdkEntryResource]);
if (artifactBytes > maximumArtifactBytes) {
  throw new Error(`Jest artifact is ${(artifactBytes / 1024 / 1024).toFixed(2)} MB; limit is 5 MB`);
}
if (artifactBytes > maximumReleaseBudgetBytes) {
  throw new Error(
    `Jest artifact is ${(artifactBytes / 1024 / 1024).toFixed(2)} MB; ` +
      "the release budget is 4.75 MiB so the 5 MiB cap retains 0.25 MiB of headroom",
  );
}

const runtimeFiles = files.filter((file) => !file.includes(`${path.sep}progress${path.sep}`));
const inspectable = runtimeFiles.filter((file) => /\.(?:html|js|css|json|map)$/i.test(file));
const content = (await Promise.all(inspectable.map((file) => readFile(file, "utf8")))).join("\n");
const configuredConsoleManifestPath = process.env.JEST_CONSOLE_MANIFEST_PATH;
if (configuredConsoleManifestPath !== undefined && !path.isAbsolute(configuredConsoleManifestPath)) {
  throw new Error("JEST_CONSOLE_MANIFEST_PATH must be absolute when provided");
}
const consoleManifest = JSON.parse(await readFile(
  configuredConsoleManifestPath ?? new URL("../../../docs/jest-developer-console.json", import.meta.url),
  "utf8",
));
const forbidden = [
  [
    "YouTube Playables integration",
    /www\.youtube\.com\/game_api\/v1|\bytgame\b|youtube-sdk-unavailable|youtube-content-envelope-invalid|youtube-content-manifest\.json/i,
  ],
  ["Reddit Devvit integration", /\bdevvit(?:-internal)?\b|redditGatewaySecret|requestExpandedMode|RedditPlatform/i],
  ["Facebook Instant Games integration", /connect\.facebook\.net|\bFBInstant\b|fbapp-config\.json/i],
  ["Facebook App Check adapter", /Facebook App Check|facebook-app-check-(?:expiry-invalid|token-provider)/i],
  [
    "Facebook callable endpoint",
    /\b(?:getFacebookClientConfiguration|listFacebookTournament|recordFacebookTournament|listFacebookContextBoard|recordFacebookContextRun|exchangeFacebookIdentity|issueFacebookIdentityNonce|bindFacebookReferral|createFacebookReferral|joinFacebookContext|leaveFacebookContext)\b/,
  ],
  ["Expo module", /(?:from|require\()\s*["'](?:expo|expo-[^"']+)/],
  ["React Native module", /(?:from|require\()\s*["']react-native(?:[\/"'])/],
  ["Metro runtime", /metro-runtime|__METRO_GLOBAL_PREFIX__/],
  ["External authentication provider", /\b(?:Clerk|Auth0|accounts\.google\.com|appleid\.apple\.com)\b/i],
  [
    "Advertising integration",
    /\b(?:AdMob|adsbygoogle|rewarded[ -]?ad|interstitial[ -]?ad)\b|(?:googlesyndication|doubleclick)\.net/i,
  ],
  ["Vibration API", /\bnavigator\.vibrate\b/],
  ["Haptics UI", /\bhaptic(?:s| feedback)\b/i],
  [
    "Nonessential Google Analytics collection",
    /\bG-[A-Z0-9]{6,}\b|(?:google-analytics|googletagmanager)\.com/i,
  ],
  ["App-install prompt", /\bbeforeinstallprompt\b/i],
  ["External social link", /https?:\/\/(?:www\.)?(?:facebook|instagram|tiktok)\.com\b/i],
  [
    "Unsupported Facebook UI",
    /\b(?:share to facebook|facebook (?:avatar|photo)|link your facebook account|use facebook photo)\b/i,
  ],
  ["Crash-test UI", /\b(?:test crash|crashlytics)\b/i],
  [
    "External account-link UI",
    /\b(?:link accounts|choose a provider to link|link to this guest session|provider account is already in use)\b/i,
  ],
  ["External in-game hyperlink", /\bhref\s*:\s*["'](?:https?:|mailto:)/i],
  ["Native app-install copy", /\b(?:install|download)\s+(?:the|our|this)\s+(?:mobile\s+)?app\b/i],
];
for (const [label, pattern] of forbidden) if (pattern.test(content)) throw new Error(`${label} found in Jest artifact`);
if (!content.includes("grindheadgames@gmail.com")) {
  throw new Error("Jest artifact is missing the verified Grindhead Games support contact");
}
const privacyPolicyUrl = consoleManifest.ownerApprovedValues?.privacyPolicyUrl;
if (privacyPolicyUrl !== null && content.includes(privacyPolicyUrl)) {
  throw new Error("The Console privacy-policy URL must not be embedded in the Jest game artifact");
}
if (files.some((file) => file.endsWith(".map"))) throw new Error("Source maps must not ship in the Jest artifact");

const html = await readFile(path.join(root, "index.html"), "utf8");
const licenseNoticePath = path.join(root, "third-party-licenses.txt");
if (!files.includes(licenseNoticePath)) throw new Error("Jest artifact is missing third-party software notices");
const licenseNotice = await readFile(licenseNoticePath, "utf8");
for (const dependency of ["@sentry/browser@", "firebase@", "react@", "react-dom@", "three@"]) {
  if (!licenseNotice.includes(dependency)) {
    throw new Error(`Third-party software notices are missing ${dependency}`);
  }
}
if (!/^<!doctype html>/i.test(html)) throw new Error("Entry document must declare the HTML5 doctype");
if (!/<html\s[^>]*\blang=["'][^"']+["']/i.test(html)) {
  throw new Error("Entry document must declare its natural language");
}
if (!/<meta\s[^>]*\bcharset=["']?utf-8["']?/i.test(html)) {
  throw new Error("Entry document must declare UTF-8 encoding");
}
if (/<(?:area|base|br|col|embed|hr|img|input|link|meta|source|track|wbr)\b[^>]*\/>/i.test(html)) {
  throw new Error("HTML5 void elements must not use XHTML-style trailing slashes");
}
const jestSdkScript = [...html.matchAll(/<script\b[^>]*>/gi)].find((match) =>
  new RegExp(`\\bsrc=["']${jestSdkEntryResource.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["']`, "i").test(match[0]),
);
if (!jestSdkScript || !/(?:^|\s)async(?:\s*=\s*(?:["']async["']|["']["']|async))?(?=\s|>)/i.test(jestSdkScript[0])) {
  throw new Error("The approved Jest SDK entry script must use async so it cannot block application startup");
}
const appModuleScriptIndex = html.search(/<script\b(?=[^>]*\btype=["']module["'])[^>]*>/i);
if (appModuleScriptIndex < 0 || jestSdkScript.index >= appModuleScriptIndex) {
  throw new Error("The asynchronous Jest SDK entry script must precede the application module");
}
const initialResources = new Set();
for (const match of html.matchAll(/(?:src|href)=["']([^"']+)["']/g)) {
  const reference = match[1];
  if (/^https?:\/\//i.test(reference)) {
    if (!allowedExternalEntryResources.has(reference)) {
      throw new Error(`Unexpected external entry resource: ${reference}`);
    }
    continue;
  }
  if (reference.startsWith("/") || reference.startsWith("//")) {
    throw new Error(`Entry resources must use relative paths: ${reference}`);
  }
  if (/^(?:data:|#)/i.test(reference)) continue;
  const relativePath = reference.split(/[?#]/, 1)[0];
  const asset = path.resolve(root, relativePath);
  if (!asset.startsWith(`${root}${path.sep}`) || !files.includes(asset)) {
    throw new Error(`Missing or unsafe referenced asset: ${reference}`);
  }
  initialResources.add(asset);
}

const bytesByFile = new Map(sizedFiles.map(({file, bytes}) => [file, bytes]));
const initialResourceBytes = [...initialResources]
  .reduce((total, file) => total + bytesByFile.get(file), 0);
if (initialResourceBytes > maximumInitialResourceBytes) {
  throw new Error(
    `Initial Jest resources are ${(initialResourceBytes / 1024 / 1024).toFixed(2)} MB; ` +
    `budget is ${(maximumInitialResourceBytes / 1024 / 1024).toFixed(2)} MB`,
  );
}

console.log(
  `Jest artifact audit passed: ${files.length} files, ${(artifactBytes / 1024 / 1024).toFixed(2)} MB, ` +
  `${(initialResourceBytes / 1024 / 1024).toFixed(2)} MB initial resources, relative entry paths, ` +
  "no native modules, external auth/ads, Google Analytics, install copy, secrets, source maps, or missing entry assets",
);
