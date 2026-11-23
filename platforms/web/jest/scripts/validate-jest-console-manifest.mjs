import {createHash} from "node:crypto";
import {lstat, readFile, realpath} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath, pathToFileURL} from "node:url";

const defaultRepositoryDirectory = fileURLToPath(new URL("../../../../", import.meta.url));
const defaultManifestPath = path.join(defaultRepositoryDirectory, "docs/jest/jest-developer-console.json");
const expectedGameId = "019faa68-f3ec-755d-9ab5-c887fb426801";
const expectedSlug = "riddle-q";
const expectedSupportEmail = "grindheadgames@gmail.com";
const expectedPublisherDisplayName = "Jest";
const expectedPrivacyPolicyUrl = "https://roobsworld.com/privacy";
const expectedConsumableSkus = Array.from(
  {length: 6},
  (_, index) => `com.roobsworld.riddlequest.coinpack${index + 1}`,
);
const expectedSubscriptionSkus = ["com.roobsworld.riddlequest.premium.monthly"];
// onboardingSlug routes through a separate Jest game; none is configured for these referrals.
const expectedOnboardingSlugs = [];
const expectedKeywords = ["riddles"];
const topLevelKeys = [
  "assets",
  "consumableSkus",
  "desiredReviewStatus",
  "desiredVisibility",
  "displayName",
  "gameId",
  "keywords",
  "loadingScreenMode",
  "onboardingSlugs",
  "ownerApprovedValues",
  "publicUrl",
  "sandboxOnlySubscriptionSkus",
  "schemaVersion",
  "shortDescription",
  "slug",
  "supportEmail",
  "supportedOrientation",
];

const isRecord = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

const assertExactKeys = (value, expected, label) => {
  if (!isRecord(value)) throw new Error(`${label} must be an object`);
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (actual.join("\n") !== wanted.join("\n")) {
    throw new Error(`${label} keys must be exactly: ${wanted.join(", ")}`);
  }
};

const assertExactList = (actual, expected, label) => {
  if (!Array.isArray(actual) || actual.some((value) => typeof value !== "string")) {
    throw new Error(`${label} must be a string array`);
  }
  if (actual.join("\n") !== expected.join("\n")) {
    throw new Error(`${label} must be exactly: ${expected.join(", ")}`);
  }
};

const assertOptionalOwnerString = (value, label) => {
  if (value === null) return;
  if (typeof value !== "string" || value.trim() !== value || value.length === 0) {
    throw new Error(`${label} must be null until approved, then a nonempty trimmed string`);
  }
};

const validatePublisherDisplayName = (value) => {
  assertOptionalOwnerString(value, "ownerApprovedValues.publisherDisplayName");
  if (value === null) return;
  if (
    /\S+@\S+\.\S+/.test(value) ||
    /^[a-z][a-z0-9+.-]*:/i.test(value) ||
    /^www\./i.test(value) ||
    /^(?:[a-z0-9-]+\.)+[a-z]{2,}(?:[/?#]|$)/i.test(value)
  ) {
    throw new Error("ownerApprovedValues.publisherDisplayName must be a publisher name, not an email address or URL");
  }
};

const validatePrivacyPolicyUrl = (value, {publicUrl}) => {
  if (value === null) return;
  assertOptionalOwnerString(value, "ownerApprovedValues.privacyPolicyUrl");
  let parsed;
  try {
    parsed = new URL(value);
  } catch (error) {
    throw new Error("ownerApprovedValues.privacyPolicyUrl must be a valid URL", {cause: error});
  }
  if (parsed.protocol !== "https:" || parsed.username || parsed.password || !parsed.hostname) {
    throw new Error("ownerApprovedValues.privacyPolicyUrl must be a public HTTPS URL without credentials");
  }
  const canonicalGameUrl = new URL(publicUrl);
  const comparablePath = (url) => url.pathname.replace(/\/+$/, "") || "/";
  if (parsed.origin === canonicalGameUrl.origin && comparablePath(parsed) === comparablePath(canonicalGameUrl)) {
    throw new Error("ownerApprovedValues.privacyPolicyUrl must not be the canonical public game URL");
  }
};

/**
 * Enforces the Jest launch-checklist boundary for About/Legal navigation.
 * Owner-approved privacy metadata belongs in the Developer Console; the game
 * may expose only its bundled license notice and internal account deletion.
 */
export const validateInformationModalSource = (source, {supportEmail}) => {
  if (!source.includes(`const SUPPORT_EMAIL = "${supportEmail}";`)) {
    throw new Error("The in-game support contact does not match the desired Jest Console manifest");
  }
  for (const expectedRow of [
    '["DATA_EXPORT", "contact"]',
    '["SUPPORT", "contact"]',
  ]) {
    if (!source.includes(expectedRow)) {
      throw new Error(`The in-game About row must remain non-navigable: ${expectedRow}`);
    }
  }
  for (const consoleOnlyOrUnavailableRow of ["PRIVACY_POLICY", "RIDDLE_QUEST_WEBSITE", "TERMS_OF_USE"]) {
    if (source.includes(consoleOnlyOrUnavailableRow)) {
      throw new Error(`The in-game About page must not render unavailable row: ${consoleOnlyOrUnavailableRow}`);
    }
  }
  if (/\b(?:https?:\/\/|mailto:)/i.test(source) || /\bprivacyPolicyUrl\b/.test(source)) {
    throw new Error("The in-game About page must not embed external or Console-only privacy URLs");
  }
  const hrefCount = source.match(/\bhref\s*=/g)?.length ?? 0;
  if (hrefCount !== 1 || !source.includes('href="./third-party-licenses.txt"')) {
    throw new Error("The bundled third-party license notice must be the About page's only href");
  }
  if (/\btarget\s*=|\bwindow\.open\s*\(|\b(?:window\.)?location\s*[.=]/.test(source)) {
    throw new Error("The in-game About page must not open another browsing context or navigate by script");
  }
};

const validateAssetRecord = (asset, label) => {
  assertExactKeys(asset, ["height", "repositoryPath", "sha256", "width"], label);
  if (
    typeof asset.repositoryPath !== "string" ||
    asset.repositoryPath.length === 0 ||
    path.isAbsolute(asset.repositoryPath) ||
    asset.repositoryPath.includes("\\") ||
    asset.repositoryPath.split("/").includes("..")
  ) {
    throw new Error(`${label}.repositoryPath must be a safe repository-relative POSIX path`);
  }
  if (!/^[a-f0-9]{64}$/.test(asset.sha256)) {
    throw new Error(`${label}.sha256 must be a lowercase SHA-256 digest`);
  }
  if (!Number.isSafeInteger(asset.width) || asset.width <= 0 ||
      !Number.isSafeInteger(asset.height) || asset.height <= 0) {
    throw new Error(`${label} dimensions must be positive integers`);
  }
};

export const validateJestConsoleManifestRecord = (manifest, {releaseReady = false} = {}) => {
  assertExactKeys(manifest, topLevelKeys, "Jest Developer Console manifest");
  if (manifest.schemaVersion !== 1) throw new Error("Unsupported Jest Developer Console manifest schema");
  if (manifest.gameId !== expectedGameId) throw new Error(`gameId must be ${expectedGameId}`);
  if (manifest.slug !== expectedSlug) throw new Error(`slug must be ${expectedSlug}`);
  if (manifest.displayName !== "Riddle-Q") throw new Error("displayName must be Riddle-Q");
  if (manifest.publicUrl !== `https://jest.com/g/${manifest.slug}`) {
    throw new Error("publicUrl must be the canonical Jest game URL for the configured slug");
  }
  if (manifest.supportEmail !== expectedSupportEmail) {
    throw new Error(`supportEmail must be ${expectedSupportEmail}`);
  }
  if (
    typeof manifest.shortDescription !== "string" ||
    manifest.shortDescription.trim() !== manifest.shortDescription ||
    manifest.shortDescription.length === 0 ||
    manifest.shortDescription.length > 110
  ) {
    throw new Error("shortDescription must be a nonempty trimmed string of at most 110 characters");
  }
  if (manifest.loadingScreenMode !== "manual") throw new Error("loadingScreenMode must be manual");
  assertExactList(manifest.keywords, expectedKeywords, "keywords");
  if (manifest.supportedOrientation !== "both") throw new Error("supportedOrientation must be both");
  if (manifest.desiredVisibility !== "public") throw new Error("desiredVisibility must be public");
  if (manifest.desiredReviewStatus !== "approved") throw new Error("desiredReviewStatus must be approved");

  assertExactKeys(
    manifest.ownerApprovedValues,
    ["privacyPolicyUrl", "publisherDisplayName"],
    "ownerApprovedValues",
  );
  validatePublisherDisplayName(manifest.ownerApprovedValues.publisherDisplayName);
  validatePrivacyPolicyUrl(manifest.ownerApprovedValues.privacyPolicyUrl, {publicUrl: manifest.publicUrl});
  if (
    manifest.ownerApprovedValues.publisherDisplayName !== null &&
    manifest.ownerApprovedValues.publisherDisplayName !== expectedPublisherDisplayName
  ) {
    throw new Error(`ownerApprovedValues.publisherDisplayName must be ${expectedPublisherDisplayName}`);
  }
  if (
    manifest.ownerApprovedValues.privacyPolicyUrl !== null &&
    manifest.ownerApprovedValues.privacyPolicyUrl !== expectedPrivacyPolicyUrl
  ) {
    throw new Error(`ownerApprovedValues.privacyPolicyUrl must be ${expectedPrivacyPolicyUrl}`);
  }
  const unresolvedOwnerFields = Object.entries(manifest.ownerApprovedValues)
    .filter(([, value]) => value === null)
    .map(([key]) => key)
    .sort();
  if (releaseReady && unresolvedOwnerFields.length > 0) {
    throw new Error(
      `Release-readiness requires owner-approved values for: ${unresolvedOwnerFields.join(", ")}`,
    );
  }

  assertExactKeys(manifest.assets, ["hero", "logo"], "assets");
  validateAssetRecord(manifest.assets.logo, "assets.logo");
  validateAssetRecord(manifest.assets.hero, "assets.hero");
  if (manifest.assets.logo.width !== manifest.assets.logo.height) {
    throw new Error("assets.logo must use a 1:1 aspect ratio");
  }
  if (manifest.assets.hero.width * 9 !== manifest.assets.hero.height * 16) {
    throw new Error("assets.hero must use a 16:9 aspect ratio");
  }
  assertExactList(manifest.consumableSkus, expectedConsumableSkus, "consumableSkus");
  assertExactList(
    manifest.sandboxOnlySubscriptionSkus,
    expectedSubscriptionSkus,
    "sandboxOnlySubscriptionSkus",
  );
  assertExactList(manifest.onboardingSlugs, expectedOnboardingSlugs, "onboardingSlugs");
  return {unresolvedOwnerFields};
};

const parsePngDimensions = (contents, label) => {
  const signature = "89504e470d0a1a0a";
  if (
    contents.length < 24 ||
    contents.subarray(0, 8).toString("hex") !== signature ||
    contents.subarray(12, 16).toString("ascii") !== "IHDR"
  ) {
    throw new Error(`${label} must be a PNG with a valid IHDR header`);
  }
  return {width: contents.readUInt32BE(16), height: contents.readUInt32BE(20)};
};

const validateAssetFile = async ({asset, label, repositoryDirectory}) => {
  const repositoryRoot = await realpath(repositoryDirectory);
  const assetPath = path.resolve(repositoryRoot, asset.repositoryPath);
  const assetRealPath = await realpath(assetPath);
  if (!assetRealPath.startsWith(`${repositoryRoot}${path.sep}`)) {
    throw new Error(`${label} resolves outside the repository`);
  }
  const metadata = await lstat(assetPath);
  if (!metadata.isFile() || metadata.isSymbolicLink()) throw new Error(`${label} must be a regular file`);
  const contents = await readFile(assetPath);
  const digest = createHash("sha256").update(contents).digest("hex");
  if (digest !== asset.sha256) throw new Error(`${label} checksum does not match the desired Console asset`);
  const dimensions = parsePngDimensions(contents, label);
  if (dimensions.width !== asset.width || dimensions.height !== asset.height) {
    throw new Error(`${label} dimensions do not match the desired Console asset`);
  }
};

const readEnvList = (contents, name) => {
  const match = new RegExp(`^${name}=([^\\r\\n]*)$`, "m").exec(contents);
  if (!match) throw new Error(`${name} is missing from firebase-functions/.env.example`);
  return match[1].split(",").map((value) => value.trim()).filter(Boolean);
};

export const validateJestConsoleManifest = async ({
  manifest,
  manifestPath = defaultManifestPath,
  releaseReady = false,
  repositoryDirectory = defaultRepositoryDirectory,
} = {}) => {
  const parsed = manifest ?? JSON.parse(await readFile(manifestPath, "utf8"));
  const result = validateJestConsoleManifestRecord(parsed, {releaseReady});
  await validateAssetFile({asset: parsed.assets.logo, label: "assets.logo", repositoryDirectory});
  await validateAssetFile({asset: parsed.assets.hero, label: "assets.hero", repositoryDirectory});

  const functionsEnvironment = await readFile(
    path.join(repositoryDirectory, "firebase-functions/.env.example"),
    "utf8",
  );
  assertExactList(
    readEnvList(functionsEnvironment, "JEST_PRODUCT_SKUS"),
    parsed.consumableSkus,
    "firebase-functions JEST_PRODUCT_SKUS",
  );
  assertExactList(
    readEnvList(functionsEnvironment, "JEST_SUBSCRIPTION_SKUS"),
    parsed.sandboxOnlySubscriptionSkus,
    "firebase-functions JEST_SUBSCRIPTION_SKUS",
  );
  const configuredGameId = readEnvList(functionsEnvironment, "JEST_GAME_ID");
  assertExactList(configuredGameId, [parsed.gameId], "firebase-functions JEST_GAME_ID");

  const sharingSource = await readFile(
    path.join(repositoryDirectory, "platforms/web/jest/src/sharing/useJestSharing.ts"),
    "utf8",
  );
  const sourceSlugs = [...new Set(
    [...sharingSource.matchAll(/onboardingSlug:\s*"([a-z0-9-]+)"/g)].map((match) => match[1]),
  )].sort();
  assertExactList(sourceSlugs, [...parsed.onboardingSlugs].sort(), "Jest sharing onboarding slugs");

  const informationSource = await readFile(
    path.join(
      repositoryDirectory,
      "src/web/play/modalPages/information/InformationModalPages.tsx",
    ),
    "utf8",
  );
  validateInformationModalSource(informationSource, {supportEmail: parsed.supportEmail});
  return result;
};

const isMain = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMain) {
  const arguments_ = process.argv.slice(2);
  const unknownArguments = arguments_.filter((argument) => argument !== "--release-ready");
  if (unknownArguments.length > 0) throw new Error(`Unknown argument: ${unknownArguments[0]}`);
  const releaseReady = arguments_.includes("--release-ready");
  const {unresolvedOwnerFields} = await validateJestConsoleManifest({releaseReady});
  const ownerStatus = unresolvedOwnerFields.length > 0
    ? `; owner approval still required for ${unresolvedOwnerFields.join(", ")}`
    : "; owner-approved publisher and privacy values are present";
  console.log(`Jest Developer Console manifest passed${ownerStatus}.`);
}
