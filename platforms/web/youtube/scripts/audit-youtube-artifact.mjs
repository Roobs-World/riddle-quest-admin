import {readFile} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import path from "node:path";
import {inspectWebTargetArtifact} from "../../../../scripts/web/web-target-artifact-inventory.mjs";

export const youtubeSdkEntryResource = "https://www.youtube.com/game_api/v1";
export const youtubeArtifactLimits = Object.freeze({
  maximumFiles: 8_000,
  maximumFileBytesExclusive: 30 * 1024 * 1024,
  recommendedInitialBytes: 15 * 1024 * 1024,
  maximumInitialBytesExclusive: 30 * 1024 * 1024,
  maximumTotalBytesExclusive: 250 * 1024 * 1024,
});

const releaseLocales = [
  "ar", "de", "en", "es", "fr", "hi", "id", "it", "ja", "ko", "nl", "pl", "pt", "ru", "tr", "vi",
];
const validPathComponent = /^[A-Za-z0-9_.-]+$/u;
const benignReactExternalLiterals = new Set([
  "https://react.dev/errors/",
  "http://www.w3.org/2000/svg",
  "http://www.w3.org/1998/Math/MathML",
  "http://www.w3.org/1999/xlink",
  "http://www.w3.org/XML/1998/namespace",
]);
const benignMarkupNamespaceLiterals = new Set([
  "http://www.w3.org/2000/svg",
  "http://www.w3.org/1998/Math/MathML",
  "http://www.w3.org/1999/xlink",
  "http://www.w3.org/XML/1998/namespace",
]);
const vendorReactChunk = /^assets\/vendor-react-[A-Za-z0-9_.-]+\.js$/u;

const isWithin = (root, candidate) => candidate.startsWith(`${root}${path.sep}`);

function assertNoUnapprovedExternalUrls({root, file, source, indexPath, sdkUrlIndex}) {
  const relativeFile = path.relative(root, file).split(path.sep).join("/");
  const externalUrl = /(?:https?:\/\/|\/\/)(?:[A-Za-z0-9]|\[[0-9A-Fa-f:.]+\])[^\s"'`()<>\\[\]{}]*/giu;
  for (const match of source.matchAll(externalUrl)) {
    const literal = match[0];
    const isSdkEntry =
      file === indexPath &&
      literal === youtubeSdkEntryResource &&
      match.index === sdkUrlIndex;
    const isBenignReactLiteral =
      vendorReactChunk.test(relativeFile) && benignReactExternalLiterals.has(literal);
    const isBenignMarkupNamespace =
      /\.(?:svg|xml)$/iu.test(relativeFile) && benignMarkupNamespaceLiterals.has(literal);
    if (!isSdkEntry && !isBenignReactLiteral && !isBenignMarkupNamespace) {
      throw new Error(
        `YouTube artifact contains an unapproved external URL in ${relativeFile}: ${literal.slice(0, 200)}`,
      );
    }
  }
}

function assertNoRootRelativeResources({root, file, source}) {
  const relativeFile = path.relative(root, file).split(path.sep).join("/");
  const extension = path.extname(file).toLowerCase();
  const patterns = [];
  if ([".css", ".html", ".htm", ".svg", ".xml"].includes(extension)) {
    patterns.push(
      /\b(?:src|href|xlink:href|action|poster|srcset|data)\s*=\s*["']\/(?!\/)/iu,
      /\burl\(\s*(?:["']\s*)?\/(?!\/)/iu,
      /@import\s+(?:url\(\s*)?(?:["']\s*)?\/(?!\/)/iu,
    );
  }
  if ([".js", ".mjs", ".cjs"].includes(extension)) {
    patterns.push(
      /\.(?:src|href|action|poster)\s*=\s*["'`]\/(?!\/)/u,
      /\b(?:src|href|action|poster)\s*:\s*["'`]\/(?!\/)/u,
      /\bsetAttribute\(\s*["'`](?:src|href|action|poster)["'`]\s*,\s*["'`]\/(?!\/)/u,
      /\bnew\s+URL\(\s*["'`]\/(?!\/)/u,
      /\bimport\(\s*["'`]\/(?!\/)/u,
    );
  }
  if (patterns.some((pattern) => pattern.test(source))) {
    throw new Error(`YouTube artifact contains a root-relative resource in ${relativeFile}`);
  }
}

function validateContentManifest(value, allowIncompleteFixture) {
  const expectedKeys = [
    "classicRiddleCount",
    "contentSha256",
    "contentVersion",
    "dailyScheduleEntries",
    "fixture",
    "locales",
    "releaseReady",
    "schemaVersion",
    "target",
  ];
  if (
    value === null ||
    typeof value !== "object" ||
    Object.keys(value).sort().join(",") !== expectedKeys.sort().join(",") ||
    value.schemaVersion !== 1 ||
    value.target !== "youtube-playables" ||
    typeof value.contentVersion !== "string" ||
    value.contentVersion.length < 1 ||
    !/^[0-9a-f]{64}$/u.test(value.contentSha256 ?? "") ||
    !Array.isArray(value.locales) ||
    !Number.isInteger(value.classicRiddleCount) ||
    value.classicRiddleCount < 1 ||
    !Number.isInteger(value.dailyScheduleEntries) ||
    value.dailyScheduleEntries < 1
  ) {
    throw new Error("YouTube content manifest is malformed");
  }
  const locales = [...value.locales].sort().join(",");
  if (allowIncompleteFixture) {
    if (
      value.releaseReady !== false ||
      value.fixture !== true ||
      locales !== "en"
    ) throw new Error("YouTube fixture audit requires the explicit non-release English content fixture");
  } else if (
    value.releaseReady !== true ||
    value.fixture !== false ||
    locales !== [...releaseLocales].sort().join(",") ||
    value.classicRiddleCount < 180 ||
    value.dailyScheduleEntries < value.classicRiddleCount
  ) {
    throw new Error("YouTube release artifact requires releaseReady content for all 16 locales and at least 180 riddles");
  }
  return value;
}

export async function auditYouTubeArtifact(rootDirectory, {allowIncompleteFixture = false} = {}) {
  const inventory = await inspectWebTargetArtifact({rootDirectory, target: "youtube"});
  const {directories, files, root, sizedFiles, textFiles: inspectedParts, totalBytes} = inventory;
  for (const entry of [...directories, ...files]) {
    if (!validPathComponent.test(path.basename(entry))) {
      throw new Error(`YouTube artifact path uses a forbidden filename: ${path.relative(root, entry)}`);
    }
  }
  if (files.length > youtubeArtifactLimits.maximumFiles) {
    throw new Error(`YouTube artifact has ${files.length} files; limit is ${youtubeArtifactLimits.maximumFiles}`);
  }

  const oversized = sizedFiles.find(({bytes}) => bytes >= youtubeArtifactLimits.maximumFileBytesExclusive);
  if (oversized) {
    throw new Error(`YouTube artifact file must be strictly below 30 MiB: ${path.relative(root, oversized.file)}`);
  }
  if (totalBytes >= youtubeArtifactLimits.maximumTotalBytesExclusive) {
    throw new Error("YouTube artifact total must be strictly below 250 MiB");
  }

  const indexPath = path.join(root, "index.html");
  if (!files.includes(indexPath)) throw new Error("YouTube artifact is missing root-level index.html");
  const html = await readFile(indexPath, "utf8");
  if (!/^<!doctype html>/iu.test(html)) throw new Error("YouTube entry document must declare the HTML5 doctype");
  if (!/<html\s[^>]*\blang=["'][^"']+["']/iu.test(html) || !/<meta\s[^>]*\bcharset=/iu.test(html)) {
    throw new Error("YouTube entry document is missing required language or charset metadata");
  }

  const sdkScripts = [...html.matchAll(/<script\b[^>]*>/giu)].filter(({0: tag}) =>
    new RegExp(`\\bsrc=["']${youtubeSdkEntryResource.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["']`, "iu").test(tag)
  );
  if (sdkScripts.length !== 1 || /\b(?:async|defer)\b/iu.test(sdkScripts[0][0])) {
    throw new Error("YouTube entry must load the exact Playables SDK once, synchronously");
  }
  const sdkUrlIndex = sdkScripts[0].index + sdkScripts[0][0].indexOf(youtubeSdkEntryResource);
  const moduleScriptIndex = html.search(/<script\b(?=[^>]*\btype=["']module["'])[^>]*>/iu);
  if (moduleScriptIndex < 0 || sdkScripts[0].index >= moduleScriptIndex) {
    throw new Error("YouTube Playables SDK must precede the application module");
  }

  for (const match of html.matchAll(/(?:src|href)=["']([^"']+)["']/giu)) {
    const reference = match[1];
    if (reference === youtubeSdkEntryResource || /^(?:data:|#)/iu.test(reference)) continue;
    if (/^(?:https?:)?\/\//iu.test(reference)) {
      throw new Error(`YouTube entry document contains an unapproved external resource: ${reference}`);
    }
    if (reference.startsWith("/")) throw new Error(`YouTube entry resources must use relative paths: ${reference}`);
    const relativeReference = reference.split(/[?#]/u, 1)[0];
    const resolved = path.resolve(root, relativeReference);
    if (!isWithin(root, resolved) || !files.includes(resolved)) {
      throw new Error(`YouTube entry references a missing or unsafe asset: ${reference}`);
    }
  }

  const content = inspectedParts.map(({file, source}) =>
    file === indexPath ? source.replaceAll(youtubeSdkEntryResource, "") : source
  ).join("\n");
  const forbidden = [
    ["Jest SDK", /cdn\.jest\.com|\bJestSDK\b/iu],
    ["Facebook Instant Games SDK", /connect\.facebook\.net|\bFBInstant\b|fbapp-config/iu],
    ["Reddit Devvit integration", /\bdevvit(?:-internal)?\b|redditGatewaySecret|requestExpandedMode|RedditPlatform/iu],
    ["Firebase integration", /\bfirebase(?:app|auth|database|firestore|functions|storage)?\b|firebaseio\.com|googleapis\.com|cloudfunctions\.net/iu],
    ["external observability or analytics", /\bSentry\b|sentry\.io|google-analytics\.com|googletagmanager\.com|\bgtag\s*\(|\b(?:mixpanel|amplitude)\b|analytics\.segment\.(?:com|io)/iu],
    ["browser network API", /\bfetch\s*\(|\bXMLHttpRequest\b|\bWebSocket\b|\bEventSource\b|\bsendBeacon\s*\(/u],
    ["same-origin API route", /["'`]\/api(?:\/|[?"'`])/iu],
    ["browser-owned locale", /\bnavigator\.languages?\b/u],
    ["browser-owned lifecycle", /\bvisibilitychange\b|\bdocument\.visibilityState\b/u],
    ["browser-owned connectivity", /\bnavigator\.onLine\b/u],
    ["browser persistence", /\b(?:localStorage|sessionStorage|indexedDB)\b/u],
    ["advertising integration", /\b(?:showInterstitialAd|showRewardedAd|rewarded[ -]?ad|interstitial[ -]?ad|adsbygoogle|AdMob)\b|(?:googlesyndication|doubleclick)\.net/iu],
    ["purchase integration", /\b(?:purchaseAsync|checkout|in[ -]?app purchase|IAP)\b/iu],
    [
      "Race-to-10 surface",
      /\b(?:RaceTo10Game|RaceTo10View|RaceTo10Gameplay|RaceHubTabs|raceTo10Service)\b|\bRaceTo10\./u,
    ],
    [
      "leaderboard surface",
      /\b(?:LeaderboardModalPage|loadLeaderboard|fetchLeaderboard|recordLeaderboard|leaderboardService)\b|\bLeaderboard\./u,
    ],
    [
      "account or profile surface",
      /\b(?:AccountModalPage|ProfileModalPage|LocalAccountDeletionGate|deleteAccount|updateProfile|saveProfile|uploadAvatar)\b|\b(?:game:deleteAccount|Profile\.)/u,
    ],
    ["sharing surface", /\b(?:shareAsync|requestShare|createReferral|bindReferral|referralService|useJestSharing)\b/u],
    ["multiplayer surface", /\b(?:MatchmakingService|matchmakingService|multiplayerSession|createChallenge|joinChallenge|RaceLobbyPanels)\b/u],
    ["external hyperlink", /\bhref\s*:\s*["'`]https?:\/\//iu],
    ["external navigation", /\bwindow\.open\s*\(|\blocation\.(?:assign|replace)\s*\(|\blocation\.href\s*=(?!=)/u],
    ["worker integration", /\b(?:SharedWorker|Worker)\s*\(|\bserviceWorker\b/u],
    ["WebAssembly integration", /\bWebAssembly\b|\.wasm\b/u],
    ["dynamic code evaluation", /\beval\s*\(|\bnew\s+Function\s*\(/u],
    ["obfuscator signature", /\b_0x[0-9a-f]{4,}\b/iu],
    ["embedded credential", /\b(?:AIza[0-9A-Za-z_-]{30,}|sk-[0-9A-Za-z_-]{20,})\b/u],
  ];
  for (const [label, pattern] of forbidden) {
    if (pattern.test(content)) throw new Error(`${label} found in YouTube artifact`);
  }
  for (const inspected of inspectedParts) {
    assertNoUnapprovedExternalUrls({root, ...inspected, indexPath, sdkUrlIndex});
    assertNoRootRelativeResources({root, ...inspected});
  }
  for (const sdkMember of [
    "firstFrameReady",
    "gameReady",
    "loadData",
    "saveData",
    "getLanguage",
    "isAudioEnabled",
    "onAudioEnabledChange",
    "onPause",
    "onResume",
  ]) {
    if (!content.includes(sdkMember)) throw new Error(`YouTube artifact is missing required SDK integration: ${sdkMember}`);
  }
  if (files.some((file) => /\.(?:map|wasm)$/iu.test(file))) {
    throw new Error("Source maps and WebAssembly must not ship in the YouTube artifact");
  }

  const contentManifestPath = path.join(root, "youtube-content-manifest.json");
  if (!files.includes(contentManifestPath)) throw new Error("YouTube artifact is missing its content manifest");
  const contentManifest = validateContentManifest(
    JSON.parse(await readFile(contentManifestPath, "utf8")),
    allowIncompleteFixture,
  );

  // Counting every emitted byte as initially transferred is deliberately conservative and
  // cannot under-report the platform's initial-transfer budget.
  const initialBytes = totalBytes;
  if (initialBytes >= youtubeArtifactLimits.maximumInitialBytesExclusive) {
    throw new Error("YouTube artifact initial transfer must be strictly below 30 MiB");
  }
  const warning = initialBytes >= youtubeArtifactLimits.recommendedInitialBytes
    ? " (warning: above the recommended 15 MiB initial-transfer budget)"
    : "";
  return {
    root,
    files,
    sizedFiles,
    totalBytes,
    initialBytes,
    contentManifest,
    warning,
  };
}

async function runCli() {
  const args = process.argv.slice(2);
  const allowIncompleteFixture = args.includes("--allow-incomplete-fixture");
  const positional = args.filter((argument) => !argument.startsWith("--"));
  const unknownFlags = args.filter((argument) => argument.startsWith("--") && argument !== "--allow-incomplete-fixture");
  if (unknownFlags.length > 0 || positional.length > 1) {
    throw new Error("Usage: audit-youtube-artifact.mjs [artifact-directory] [--allow-incomplete-fixture]");
  }
  const rootDirectory = positional[0] ?? (process.env.YOUTUBE_BUILD_OUT_DIR?.trim() || "builds/youtube");
  const result = await auditYouTubeArtifact(rootDirectory, {allowIncompleteFixture});
  console.log(
    `YouTube artifact audit passed: ${result.files.length} files, ` +
      `${(result.totalBytes / 1024 / 1024).toFixed(2)} MiB total and conservative initial transfer, ` +
      `${result.contentManifest.locales.length} locale(s)${result.warning}`,
  );
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  await runCli();
}
