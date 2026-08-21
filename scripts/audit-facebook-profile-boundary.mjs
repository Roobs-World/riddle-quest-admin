import {readdirSync, readFileSync, statSync} from "node:fs";
import {fileURLToPath} from "node:url";

const PROFILE_READ_PATTERN = /\b(?:getName|getPhoto)\s*\(/u;
const PROFILE_FIELD_PATTERN = /\b(?:facebook|meta)(?:Player)?(?:Name|Photo|Picture|Avatar|Profile)\b/u;

const collect = (directory, output = []) => {
  for (const name of readdirSync(directory)) {
    const path = `${directory}/${name}`;
    const stat = statSync(path);
    if (stat.isDirectory()) {
      if (name !== "node_modules" && !name.startsWith("dist")) collect(path, output);
    } else if (stat.isFile() && /\.(?:ts|tsx|js|jsx)$/u.test(name)) output.push(path);
  }
  return output;
};

/** Ensures Meta profile identity can reach the client only through provider-owned overlay calls. */
export function auditFacebookProfileBoundary({sources, adapterSource}) {
  const failures = sources
    .filter(({source}) => PROFILE_READ_PATTERN.test(source) || PROFILE_FIELD_PATTERN.test(source))
    .map(({name}) => `Meta profile data read/field found outside overlay boundary: ${name}`);
  for (const api of [
    "createProfilePictureOverlayViewAsync",
    "createProfileNameOverlayViewAsync",
  ]) {
    if (!adapterSource.includes(api)) failures.push(`Missing provider overlay API: ${api}`);
  }
  if (PROFILE_READ_PATTERN.test(adapterSource)) {
    failures.push("Overlay adapter must not read Meta name/photo values.");
  }
  return failures;
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const root = fileURLToPath(new URL("../", import.meta.url));
  const adapterPath = `${root}/packages/portal/src/facebook/FacebookOverlayCapability.ts`;
  const excluded = new Set([
    adapterPath,
    `${root}/packages/portal/src/facebook/fbinstant.ts`,
    `${root}/packages/portal/src/facebook/__tests__/FacebookOverlayCapability.test.ts`,
    `${root}/packages/portal/src/facebook/__tests__/facebookBrowser.jest-playwright.test.ts`,
  ]);
  const paths = [
    ...collect(`${root}/packages/portal/src/facebook`),
    ...collect(`${root}/firebase-functions/src/facebook`),
  ].filter((path) => !excluded.has(path));
  const failures = auditFacebookProfileBoundary({
    sources: paths.map((path) => ({name: path.slice(root.length), source: readFileSync(path, "utf8")})),
    adapterSource: readFileSync(adapterPath, "utf8"),
  });
  if (failures.length > 0) throw new Error(`Facebook profile-boundary audit failed:\n- ${failures.join("\n- ")}`);
  console.log("Facebook profile-boundary audit passed: names/photos remain inside provider overlays.");
}
