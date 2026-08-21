import {readFile, readdir, stat} from "node:fs/promises";
import path from "node:path";

const root = path.resolve(process.cwd(), process.argv[2] || "dist-reddit");
const maximumInitialResourceBytes = 5 * 1024 * 1024;
const files = [];
async function walk(directory) {
  for (const entry of await readdir(directory, {withFileTypes: true})) {
    const absolute = path.join(directory, entry.name);
    if (entry.isSymbolicLink() || (!entry.isDirectory() && !entry.isFile())) {
      throw new Error(`Reddit artifact contains a non-regular entry: ${absolute}`);
    }
    if (entry.isDirectory()) await walk(absolute); else files.push(absolute);
  }
}
await walk(root);
const inspectable = files.filter((file) => /\.(?:html|js|css|json|map)$/i.test(file));
const content = (await Promise.all(inspectable.map((file) => readFile(file, "utf8")))).join("\n");
const commerceChunks = inspectable.filter((file) => /(?:shop-|GameModalView-)[^/]*\.js$/u.test(file));
const commerceContent = (await Promise.all(commerceChunks.map((file) => readFile(file, "utf8")))).join("\n");
const forbidden = [
  [
    "YouTube Playables integration",
    /www\.youtube\.com\/game_api\/v1|\bytgame\b|youtube-sdk-unavailable|youtube-content-envelope-invalid|youtube-content-manifest\.json/i,
  ],
  ["Jest SDK", /cdn\.jest\.com|\bJestSDK\b/],
  ["Facebook SDK", /fbinstant|connect\.facebook\.net|fbapp-config/i],
  ["Firebase browser SDK", /firebase(?:app|auth|firestore|database|storage)|googleapis\.com|firebaseio\.com/i],
  ["external analytics", /googletagmanager\.com|google-analytics\.com|sentry\.io/i],
  ["advertising", /admob|adsbygoogle|googlesyndication|doubleclick\.net|rewarded.?ad|interstitial/i],
  ["private key", /-----BEGIN PRIVATE KEY-----|["']type["']\s*:\s*["']service_account/i],
  ["server secret", /\b(?:JEST_SHARED_SECRET|FACEBOOK_APP_SECRET|FACEBOOK_UID_SECRET|REDDIT_CLIENT_SECRET|REDDIT_UID_SECRET|GOOGLE_APPLICATION_CREDENTIALS)\b/],
];
for (const [label, pattern] of forbidden) if (pattern.test(content)) throw new Error(`${label} found in Reddit artifact`);
for (const [label, pattern] of [
  ["subscription UI", /shop-subscription|SUBSCRIBE_BUTTON|SUBSCRIBED_BUTTON|SUBSCRIPTION_ACTIVE|START_TRIAL_BUTTON/u],
  ["premium shop copy", /Premium (?:active|subscription)|premiumabonnement|premium-podpiska/iu],
  ["Remove Ads product", /remove[ _-]?(?:interstitial[ _-]?)?ads|ad[ _-]?free/iu],
]) if (pattern.test(commerceContent)) throw new Error(`${label} found in Reddit commerce chunks`);
if (files.some((file) => file.endsWith(".map"))) throw new Error("Source maps must not ship in the Reddit artifact");
const html = await readFile(path.join(root, "index.html"), "utf8");
if (/\bsrc=["']https?:|\bhref=["']https?:/i.test(html)) throw new Error("Reddit entry document contains an external resource");
if (!/^<!doctype html>/i.test(html) || !/<html\s[^>]*\blang=/i.test(html) || !/<meta\s[^>]*\bcharset=/i.test(html)) {
  throw new Error("Reddit entry document is missing required HTML metadata");
}
const initialResources = new Set();
for (const match of html.matchAll(/(?:src|href)=["']([^"']+)["']/g)) {
  const reference = match[1];
  if (/^(?:data:|#)/i.test(reference)) continue;
  if (/^https?:|^\/\//i.test(reference)) throw new Error(`Reddit entry document contains an external resource: ${reference}`);
  if (reference.startsWith("/")) throw new Error(`Reddit entry resources must use relative paths: ${reference}`);
  const asset = path.resolve(root, reference.split(/[?#]/, 1)[0]);
  if (!asset.startsWith(`${root}${path.sep}`) || !files.includes(asset)) throw new Error(`Missing or unsafe Reddit entry asset: ${reference}`);
  initialResources.add(asset);
}
const sizes = await Promise.all(files.map(async (file) => ({file, bytes: (await stat(file)).size})));
const oversized = sizes.find(({bytes}) => bytes > 100 * 1024 * 1024);
if (oversized) throw new Error(`Reddit artifact file exceeds 100 MB: ${oversized.file}`);
const total = sizes.reduce((sum, item) => sum + item.bytes, 0);
const initialResourceBytes = sizes.filter(({file}) => initialResources.has(file)).reduce((sum, item) => sum + item.bytes, 0);
if (initialResourceBytes > maximumInitialResourceBytes) {
  throw new Error(`Initial Reddit resources are ${(initialResourceBytes / 1024 / 1024).toFixed(2)} MB; budget is 5 MB`);
}
console.log(`Reddit artifact audit passed: ${files.length} regular files, ${(total / 1024 / 1024).toFixed(2)} MB, ${(initialResourceBytes / 1024 / 1024).toFixed(2)} MB initial resources, isolated and same-origin only`);
