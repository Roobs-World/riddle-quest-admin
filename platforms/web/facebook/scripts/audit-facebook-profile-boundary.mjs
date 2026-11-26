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

/** Ensures the retained backend never reads or persists Meta profile identity. */
export function auditFacebookProfileBoundary({sources}) {
  const failures = sources
    .filter(({source}) => PROFILE_READ_PATTERN.test(source) || PROFILE_FIELD_PATTERN.test(source))
    .map(({name}) => `Meta profile data read/field found outside overlay boundary: ${name}`);
  return failures;
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const root = fileURLToPath(new URL("../../../../", import.meta.url));
  const paths = collect(`${root}/platforms/web/facebook/server`);
  const failures = auditFacebookProfileBoundary({
    sources: paths.map((path) => ({name: path.slice(root.length), source: readFileSync(path, "utf8")})),
  });
  if (failures.length > 0) throw new Error(`Facebook profile-boundary audit failed:\n- ${failures.join("\n- ")}`);
  console.log("Facebook profile-boundary audit passed: server code never reads or stores Meta names/photos.");
}
