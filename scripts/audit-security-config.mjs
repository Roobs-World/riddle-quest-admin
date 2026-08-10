import {readdirSync, readFileSync, statSync} from "node:fs";
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

const jestEnvironment = readFileSync(`${repositoryRoot}/packages/portal/.env.jest`, "utf8");
const jestBackendUrl = /^VITE_JEST_FUNCTIONS_BASE_URL=(.+)$/mu.exec(jestEnvironment)?.[1]?.trim();
const appCheckSiteKey = /^VITE_FIREBASE_APP_CHECK_SITE_KEY=(.+)$/mu.exec(jestEnvironment)?.[1]?.trim();
const sentryDsn = /^VITE_SENTRY_DSN=(.+)$/mu.exec(jestEnvironment)?.[1]?.trim();
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
  [/https:\/\/\*\.sentry\.io/u.test(contentSecurityPolicy),
    "CSP must allow encrypted Sentry event ingestion."],
  [/^[\w-]{30,}$/u.test(appCheckSiteKey ?? ""),
    "The production Jest build must include a Firebase App Check site key."],
  [/sourcemap:\s*uploadSentrySourceMaps\s*\?\s*"hidden"\s*:\s*false/u.test(viteConfiguration),
    "Production source maps must be hidden and generated only for private Sentry upload."],
  [/filesToDeleteAfterUpload:\s*"\.\/dist-jest\/\*\*\/\*\.map"/u.test(viteConfiguration),
    "Private source maps must be deleted before Jest artifact packaging."],
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
