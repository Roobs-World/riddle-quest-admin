import {readFile, readdir, stat} from "node:fs/promises";
import path from "node:path";

const root = path.resolve(process.cwd(), process.argv[2] || "dist-jest");
const maximumArtifactBytes = 5 * 1024 * 1024;
const maximumInitialResourceBytes = 1.5 * 1024 * 1024;
const allowedExternalEntryResources = new Set(["https://cdn.jest.com/sdk/latest/jestsdk.js"]);
const files = [];
async function walk(directory) {
  for (const entry of await readdir(directory, {withFileTypes: true})) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) await walk(absolute); else files.push(absolute);
  }
}
await walk(root);
const sizes = await Promise.all(files.map(async (file) => (await stat(file)).size));
const artifactBytes = sizes.reduce((total, size) => total + size, 0);
if (artifactBytes > maximumArtifactBytes) {
  throw new Error(`Jest artifact is ${(artifactBytes / 1024 / 1024).toFixed(2)} MB; limit is 5 MB`);
}

const runtimeFiles = files.filter((file) => !file.includes(`${path.sep}progress${path.sep}`));
const inspectable = runtimeFiles.filter((file) => /\.(?:html|js|css|json|map)$/i.test(file));
const content = (await Promise.all(inspectable.map((file) => readFile(file, "utf8")))).join("\n");
const forbidden = [
  ["Expo module", /(?:from|require\()\s*["'](?:expo|expo-[^"']+)/],
  ["React Native module", /(?:from|require\()\s*["']react-native(?:[\/"'])/],
  ["Metro runtime", /metro-runtime|__METRO_GLOBAL_PREFIX__/],
  ["External authentication provider", /\b(?:Clerk|Auth0|accounts\.google\.com|appleid\.apple\.com)\b/i],
  ["Advertising integration", /\b(?:AdMob|rewarded[ -]?ad|interstitial[ -]?ad)\b/i],
  ["Vibration API", /\bnavigator\.vibrate\b/],
  ["App-install prompt", /\bbeforeinstallprompt\b/i],
  ["External social link", /https?:\/\/(?:www\.)?(?:facebook|instagram|tiktok)\.com\b/i],
  ["Native app-install copy", /\b(?:install|download)\s+(?:the|our|this)\s+(?:mobile\s+)?app\b/i],
  ["Firebase private key", /-----BEGIN PRIVATE KEY-----/],
  ["Jest shared secret", /JEST_SHARED_SECRET\s*[:=]\s*["'][^"']+/],
];
for (const [label, pattern] of forbidden) if (pattern.test(content)) throw new Error(`${label} found in Jest artifact`);
if (files.some((file) => file.endsWith(".map"))) throw new Error("Source maps must not ship in the Jest artifact");

const html = await readFile(path.join(root, "index.html"), "utf8");
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

const initialResourceBytes = (
  await Promise.all([...initialResources].map(async (file) => (await stat(file)).size))
).reduce((total, size) => total + size, 0);
if (initialResourceBytes > maximumInitialResourceBytes) {
  throw new Error(
    `Initial Jest resources are ${(initialResourceBytes / 1024 / 1024).toFixed(2)} MB; ` +
    `budget is ${(maximumInitialResourceBytes / 1024 / 1024).toFixed(2)} MB`,
  );
}

console.log(
  `Jest artifact audit passed: ${files.length} files, ${(artifactBytes / 1024 / 1024).toFixed(2)} MB, ` +
  `${(initialResourceBytes / 1024 / 1024).toFixed(2)} MB initial resources, relative entry paths, ` +
  "no native modules, external auth/ads, install copy, secrets, source maps, or missing entry assets",
);
