import {readdirSync, readFileSync, statSync} from "node:fs";
import {fileURLToPath} from "node:url";

const META_SECRET_PATTERN = /\b(?:FACEBOOK_APP_SECRET|FACEBOOK_UID_SECRET|META_APP_SECRET)\b/u;
const CI_SECRET_VALUE_PATTERN = /\$\{\{\s*secrets\.(?:FACEBOOK_APP_SECRET|FACEBOOK_UID_SECRET)\s*\}\}/u;

const collectFiles = (directory, predicate, output = []) => {
  for (const name of readdirSync(directory)) {
    const path = `${directory}/${name}`;
    const stat = statSync(path);
    if (stat.isDirectory()) {
      if (name !== "node_modules" && name !== "dist" && !name.startsWith("dist-")) {
        collectFiles(path, predicate, output);
      }
    } else if (stat.isFile() && predicate(name)) {
      output.push(path);
    }
  }
  return output;
};

const containsAll = (source, patterns) => patterns.every((pattern) => pattern.test(source));

/** Validates the source-level boundary without reading or printing any secret value. */
export function auditFacebookSecretBoundary({
  browserSources,
  browserEnvironmentSources,
  workflowSources,
  identityEndpointSource,
  deletionEndpointSource,
  accountDeletionSource,
}) {
  const failures = [];
  const leakedBrowserFiles = [...browserSources, ...browserEnvironmentSources]
    .filter(({source}) => META_SECRET_PATTERN.test(source))
    .map(({name}) => name);
  if (leakedBrowserFiles.length > 0) {
    failures.push(`Meta secret identifiers reached browser source/config: ${leakedBrowserFiles.join(", ")}`);
  }
  const injectedWorkflowFiles = workflowSources
    .filter(({source}) => CI_SECRET_VALUE_PATTERN.test(source))
    .map(({name}) => name);
  if (injectedWorkflowFiles.length > 0) {
    failures.push(`CI injects Meta secret values outside Functions Secret Manager: ${injectedWorkflowFiles.join(", ")}`);
  }

  const definitionPatterns = [
    /defineSecret\("FACEBOOK_APP_SECRET"\)/u,
    /defineSecret\("FACEBOOK_UID_SECRET"\)/u,
  ];
  if (!containsAll(identityEndpointSource, [
    ...definitionPatterns,
    /secrets:\s*\[facebookAppSecret,\s*facebookUidSecret\]/u,
  ])) failures.push("Facebook identity endpoints must bind both Meta secrets.");
  if (!containsAll(deletionEndpointSource, [
    ...definitionPatterns,
    /secrets:\s*\[facebookAppSecret,\s*facebookUidSecret\]/u,
  ])) failures.push("Facebook deletion callback must bind both Meta secrets.");
  if (!containsAll(accountDeletionSource, [
    /defineSecret\("FACEBOOK_UID_SECRET"\)/u,
    /secrets:\s*\[facebookUidSecret\]/u,
  ]) || /defineSecret\("FACEBOOK_APP_SECRET"\)/u.test(accountDeletionSource)) {
    failures.push("Authenticated account deletion must bind only the Facebook UID secret.");
  }
  return failures;
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const root = fileURLToPath(new URL("../", import.meta.url));
  const readEntries = (paths) => paths.map((path) => ({
    name: path.slice(root.length),
    source: readFileSync(path, "utf8"),
  }));
  const browserPaths = collectFiles(`${root}/packages/portal/src`, (name) => /\.(?:ts|tsx|js|jsx)$/u.test(name));
  browserPaths.push(`${root}/packages/portal/index.html`, `${root}/packages/portal/vite.config.ts`);
  const envPaths = collectFiles(`${root}/config/vite/portal`, () => true);
  const workflowPaths = collectFiles(`${root}/.github/workflows`, (name) => /\.ya?ml$/u.test(name));
  const failures = auditFacebookSecretBoundary({
    browserSources: readEntries(browserPaths),
    browserEnvironmentSources: readEntries(envPaths),
    workflowSources: readEntries(workflowPaths),
    identityEndpointSource: readFileSync(`${root}/firebase-functions/src/facebook/facebookEndpoints.ts`, "utf8"),
    deletionEndpointSource: readFileSync(`${root}/firebase-functions/src/facebook/facebookDataDeletionEndpoints.ts`, "utf8"),
    accountDeletionSource: readFileSync(
      `${root}/firebase-functions/src/profile/accountDeletion/deleteAccountCallable.ts`, "utf8",
    ),
  });
  if (failures.length > 0) throw new Error(`Facebook secret-boundary audit failed:\n- ${failures.join("\n- ")}`);
  console.log("Facebook secret-boundary audit passed: Meta secrets remain server-only and exactly bound.");
}
