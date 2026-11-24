import {readFile} from "node:fs/promises";
import path from "node:path";
import {inspectWebTargetArtifact} from "./web-target-artifact-inventory.mjs";
import {hasAuditedHostedNotifications} from "./audit-hosted-notifications.mjs";

const target = process.argv[2];
if (!new Set(["netflix", "yahoo"]).has(target)) throw new Error("Expected netflix or yahoo target");
const rootDirectory = process.argv[3] || process.env[`${target.toUpperCase()}_BUILD_OUT_DIR`]?.trim() || `platforms/web/${target}/build/dist`;
const inventory = await inspectWebTargetArtifact({rootDirectory, target});
const {files, root, textFiles, totalBytes} = inventory;
const hostedNotifications = await hasAuditedHostedNotifications({target, root, files});
if (totalBytes >= 30 * 1024 * 1024) throw new Error(`${target} candidate artifact must be below 30 MiB`);
const indexPath = path.join(root, "index.html");
if (!files.includes(indexPath)) throw new Error(`${target} candidate is missing index.html`);
const html = await readFile(indexPath, "utf8");
if (!/^<!doctype html>/iu.test(html) || !/<meta\s[^>]*charset=/iu.test(html)) {
  throw new Error(`${target} candidate entry is missing HTML5 metadata`);
}
for (const match of html.matchAll(/(?:src|href)=["']([^"']+)["']/giu)) {
  const reference = match[1];
  if (/^(?:https?:)?\/\//iu.test(reference) || reference.startsWith("/")) {
    throw new Error(`${target} candidate contains a non-portable entry resource: ${reference}`);
  }
}
const content = textFiles.map(({source}) => source).join("\n");
const forbidden = [
  ["Jest", /cdn\.jest\.com|\bJestSDK\b/iu],
  ["Facebook", /connect\.facebook\.net|\bFBInstant\b|fbapp-config/iu],
  ["Reddit", /\bdevvit(?:-internal)?\b|RedditPlatform/iu],
  ["YouTube", /youtube\.com\/game_api|\bytgame\b/iu],
  ...(["netflix", "yahoo"].includes(target) ? [["Firebase", /firebaseio\.com|googleapis\.com|cloudfunctions\.net|\bfirebase(?:app|auth|database|firestore|functions|storage)\b/iu]] : []),
  ...(["netflix", "yahoo"].includes(target) ? [["analytics", /\bSentry\b|sentry\.io|google-analytics|googletagmanager|\bgtag\s*\(/iu]] : []),
  ...(["netflix", "yahoo"].includes(target) ? [["network API", hostedNotifications
    ? /\bXMLHttpRequest\b|\bWebSocket\b|\bEventSource\b|\bsendBeacon\s*\(/u
    : /\bfetch\s*\(|\bXMLHttpRequest\b|\bWebSocket\b|\bEventSource\b|\bsendBeacon\s*\(/u]] : []),
  ...(["netflix", "yahoo"].includes(target)
    ? [["commerce or advertising", /\b(?:purchaseAsync|checkout|IAP|showInterstitialAd|showRewardedAd|AdMob)\b/iu]]
    : [["advertising", /\b(?:showInterstitialAd|showRewardedAd|AdMob)\b/iu]]),
];
for (const [label, pattern] of forbidden) {
  if (pattern.test(content)) throw new Error(`${label} integration found in ${target} candidate artifact`);
}
if (["netflix", "yahoo"].includes(target)) {
  const manifestPath = path.join(root, "youtube-content-manifest.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  if (manifest.target !== `${target}-candidate` || manifest.fixture !== false || manifest.releaseReady !== true) {
    throw new Error(`${target} candidate content manifest is malformed`);
  }
  if (!Array.isArray(manifest.locales) || manifest.locales.length !== 16 || manifest.classicRiddleCount !== 180) {
    throw new Error(`${target} candidate must contain the complete audited release content`);
  }
}
console.log(`${target} artifact audit passed: ${files.length} files, ${(totalBytes / 1024 / 1024).toFixed(2)} MiB`);
