import {lstat, readFile, readdir} from "node:fs/promises";
import path from "node:path";

const targetNames = Object.freeze({
  jest: "Jest",
  facebook: "Facebook",
  reddit: "Reddit",
  youtube: "YouTube",
});

const inspectableTextExtension = /\.(?:css|html?|js|mjs|cjs|json|svg|xml|txt|webmanifest)$/iu;
const commonForbiddenContent = Object.freeze([
  Object.freeze([
    "private key",
    /-----BEGIN(?: [A-Z0-9]+)* PRIVATE KEY-----/u,
  ]),
  Object.freeze([
    "service account",
    /["']type["']\s*:\s*["']service_account["']|["']private_key_id["']\s*:/iu,
  ]),
  Object.freeze([
    "server secret",
    /\b(?:JEST_SHARED_SECRET|FACEBOOK_APP_SECRET|FACEBOOK_UID_SECRET|META_APP_SECRET|REDDIT_CLIENT_SECRET|REDDIT_UID_SECRET|OPENAI_API_KEY|GOOGLE_APPLICATION_CREDENTIALS)\b/iu,
  ]),
]);

const isInspectableTextFile = (file) =>
  inspectableTextExtension.test(file) || path.basename(file).toLowerCase().startsWith(".env");

/**
 * Inventories one Web Target artifact and enforces target-independent filesystem
 * and credential invariants before any provider-specific audit runs.
 */
export async function inspectWebTargetArtifact({rootDirectory, target}) {
  const targetName = targetNames[target];
  if (!targetName) throw new Error(`Unknown Web Target artifact audit: ${JSON.stringify(target)}`);

  const root = path.resolve(rootDirectory);
  const rootMetadata = await lstat(root);
  if (rootMetadata.isSymbolicLink() || !rootMetadata.isDirectory()) {
    throw new Error(`${targetName} artifact root must be a real directory, not a link`);
  }

  const directories = [];
  const sizedFiles = [];
  async function walk(directory) {
    const entries = await readdir(directory, {withFileTypes: true});
    entries.sort((left, right) => left.name.localeCompare(right.name, "en"));
    for (const entry of entries) {
      const absolute = path.join(directory, entry.name);
      const metadata = await lstat(absolute);
      if (metadata.isSymbolicLink() || (!metadata.isDirectory() && !metadata.isFile())) {
        throw new Error(`${targetName} artifact contains a non-regular entry: ${absolute}`);
      }
      if (metadata.isDirectory()) {
        directories.push(absolute);
        await walk(absolute);
      } else {
        sizedFiles.push(Object.freeze({file: absolute, bytes: metadata.size}));
      }
    }
  }
  await walk(root);

  sizedFiles.sort(({file: left}, {file: right}) => left.localeCompare(right, "en"));
  directories.sort((left, right) => left.localeCompare(right, "en"));
  if (sizedFiles.length === 0) throw new Error(`${targetName} artifact is empty`);

  const files = sizedFiles.map(({file}) => file);
  const textFiles = await Promise.all(files.filter(isInspectableTextFile).map(async (file) =>
    Object.freeze({file, source: await readFile(file, "utf8")})
  ));
  for (const {file, source} of textFiles) {
    for (const [label, pattern] of commonForbiddenContent) {
      if (pattern.test(source)) {
        throw new Error(`${label} found in ${targetName} artifact: ${path.relative(root, file)}`);
      }
    }
  }

  return Object.freeze({
    root,
    directories: Object.freeze(directories),
    files: Object.freeze(files),
    sizedFiles: Object.freeze(sizedFiles),
    textFiles: Object.freeze(textFiles),
    totalBytes: sizedFiles.reduce((sum, {bytes}) => sum + bytes, 0),
  });
}
