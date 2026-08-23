import {readFile} from "node:fs/promises";
import path from "node:path";
import {inspectWebTargetArtifact} from "./web-target-artifact-inventory.mjs";

const inventory = await inspectWebTargetArtifact({
  rootDirectory: process.argv[2] || process.env.FACEBOOK_BUILD_OUT_DIR?.trim() || "dist-facebook",
  target: "facebook",
});
const {files, root, sizedFiles, totalBytes: artifactBytes} = inventory;
const maximumArtifactBytes = 200 * 1024 * 1024;
const maximumInitialResourceBytes = 5 * 1024 * 1024;
const facebookSdkEntryResource = "https://connect.facebook.net/en_US/fbinstant.8.0.js";
const allowedExternalEntryResources = new Set([facebookSdkEntryResource]);
if (artifactBytes > maximumArtifactBytes) {
  throw new Error(`Facebook artifact is ${(artifactBytes / 1024 / 1024).toFixed(2)} MB; limit is 200 MB`);
}

const inspectable = files.filter((file) => /\.(?:html|js|css|json|map)$/i.test(file));
const content = (await Promise.all(inspectable.map((file) => readFile(file, "utf8")))).join("\n");
const forbidden = [
  [
    "YouTube Playables integration",
    /www\.youtube\.com\/game_api\/v1|\bytgame\b|youtube-sdk-unavailable|youtube-content-envelope-invalid|youtube-content-manifest\.json/i,
  ],
  ["Reddit Devvit integration", /\bdevvit(?:-internal)?\b|redditGatewaySecret|requestExpandedMode|RedditPlatform/i],
  ["Jest SDK", /cdn\.jest\.com|\bJestSDK\b/],
  ["Jest runtime configuration", /VITE_JEST_RUNTIME/],
  ["Jest App Check adapter", /not configured for the Jest build|Jest App Check can only initialize/i],
  ["Jest sharing event bridge", /riddle-quest:share-(?:referral|invite|race)/i],
  ["Expo module", /(?:from|require\()\s*["'](?:expo|expo-[^"']+)/],
  ["React Native module", /(?:from|require\()\s*["']react-native(?:[\/"'])/],
  ["External authentication provider", /\b(?:Clerk|Auth0|accounts\.google\.com|appleid\.apple\.com)\b/i],
  ["Native advertising integration", /\b(?:AdMob|adsbygoogle)\b|(?:googlesyndication|doubleclick)\.net/i],
];
for (const [label, pattern] of forbidden) {
  if (pattern.test(content)) throw new Error(`${label} found in Facebook artifact`);
}
if (files.some((file) => file.endsWith(".map"))) {
  throw new Error("Source maps must not ship in the Facebook artifact");
}

const html = await readFile(path.join(root, "index.html"), "utf8");
if (!/^<!doctype html>/i.test(html)) throw new Error("Entry document must declare the HTML5 doctype");
if (!/<html\s[^>]*\blang=["'][^"']+["']/i.test(html)) {
  throw new Error("Entry document must declare its natural language");
}
if (!/<meta\s[^>]*\bcharset=["']?utf-8["']?/i.test(html)) {
  throw new Error("Entry document must declare UTF-8 encoding");
}
const facebookSdkScript = [...html.matchAll(/<script\b[^>]*>/gi)].find((match) =>
  new RegExp(`\\bsrc=["']${facebookSdkEntryResource.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["']`, "i").test(match[0]),
);
if (!facebookSdkScript) throw new Error("Facebook artifact is missing the Instant Games SDK v8 entry script");
const appModuleScriptIndex = html.search(/<script\b(?=[^>]*\btype=["']module["'])[^>]*>/i);
if (appModuleScriptIndex < 0 || facebookSdkScript.index >= appModuleScriptIndex) {
  throw new Error("The Facebook SDK entry script must precede the application module");
}

const configPath = path.join(root, "fbapp-config.json");
if (!files.includes(configPath)) throw new Error("Facebook artifact is missing root-level fbapp-config.json");
const config = JSON.parse(await readFile(configPath, "utf8"));
if (
  config?.instant_games?.platform_version !== "8.0" ||
  config?.instant_games?.orientation !== "both" ||
  config?.instant_games?.navigation_menu_version !== "NAV_2"
) {
  throw new Error("fbapp-config.json does not declare SDK v8, both orientations, and NAV_2");
}

const licenseNoticePath = path.join(root, "third-party-licenses.txt");
if (!files.includes(licenseNoticePath)) throw new Error("Facebook artifact is missing third-party software notices");
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
    `Initial Facebook resources are ${(initialResourceBytes / 1024 / 1024).toFixed(2)} MB; budget is 5 MB`,
  );
}

console.log(
  `Facebook artifact audit passed: ${files.length} files, ${(artifactBytes / 1024 / 1024).toFixed(2)} MB, ` +
  `${(initialResourceBytes / 1024 / 1024).toFixed(2)} MB initial resources, isolated SDK/config, and no Jest/native/secrets leakage`,
);
