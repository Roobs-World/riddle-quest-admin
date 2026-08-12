import {execFileSync} from "node:child_process";
import {readFileSync, readdirSync, statSync, writeFileSync} from "node:fs";
import {isAbsolute, resolve} from "node:path";
import {fileURLToPath} from "node:url";

const portalDirectory = fileURLToPath(new URL("../", import.meta.url));
const repositoryDirectory = resolve(portalDirectory, "../..");
const outputFile = resolve(portalDirectory, "public/third-party-licenses.txt");
const firebaseLicenseFile = resolve(portalDirectory, "licenses/firebase-js-sdk.LICENSE");
const mode = process.argv[2] ?? "--check";
const pnpmModulesMetadata = JSON.parse(
  readFileSync(resolve(repositoryDirectory, "node_modules/.modules.yaml"), "utf8"),
);
const pnpmStoreDirectory = pnpmModulesMetadata.storeDir;
if (typeof pnpmStoreDirectory !== "string" || !isAbsolute(pnpmStoreDirectory)) {
  throw new Error("The installed pnpm package store must be an absolute path");
}

const normalizeNoticeText = (text) => text
  .replaceAll("\r\n", "\n")
  .replace(/[ \t]+$/gm, "")
  .trim();

if (!new Set(["--check", "--write"]).has(mode)) {
  throw new Error("Usage: node scripts/generate-third-party-licenses.mjs [--check|--write]");
}

/** Runs the active pnpm installation without depending on a global shim. */
function readLicenseInventory() {
  const npmExecutable = process.env.npm_execpath;
  const command = npmExecutable ? process.execPath : "pnpm";
  const prefixArguments = npmExecutable ? [npmExecutable] : [];
  const output = execFileSync(
    command,
    [...prefixArguments, "--filter", "@qwordly/portal", "licenses", "list", "--prod", "--json"],
    {
      cwd: repositoryDirectory,
      encoding: "utf8",
      env: {...process.env, pnpm_config_store_dir: pnpmStoreDirectory},
      maxBuffer: 32 * 1024 * 1024,
      stdio: ["ignore", "pipe", "inherit"],
    },
  );
  return JSON.parse(output);
}

/** Returns license and notice files shipped by a dependency package. */
function readNoticeFiles(packageDirectory) {
  return readdirSync(packageDirectory)
    .filter((name) => /^(?:licen[cs]e|copying|notice)(?:[._-].*)?$/i.test(name))
    .map((name) => ({name, path: resolve(packageDirectory, name)}))
    .filter(({path}) => statSync(path).isFile())
    .sort((left, right) => left.name.localeCompare(right.name))
    .map(({name, path}) => ({
      name,
      text: normalizeNoticeText(readFileSync(path, "utf8")),
    }));
}

/** Produces the committed third-party notice from the installed production graph. */
function createNotice() {
  const inventory = readLicenseInventory();
  const packages = new Map();
  const missingNotices = [];

  for (const records of Object.values(inventory)) {
    for (const record of records) {
      for (const packageDirectory of record.paths) {
        const manifest = JSON.parse(readFileSync(resolve(packageDirectory, "package.json"), "utf8"));
        const id = `${manifest.name}@${manifest.version}`;
        const license = typeof manifest.license === "string" ? manifest.license : record.license;
        if (!license || /^(?:unknown|unlicensed)$/i.test(license)) {
          throw new Error(`Production dependency ${id} has no declared license`);
        }
        let noticeFiles = readNoticeFiles(packageDirectory);
        if (noticeFiles.length === 0) {
          const isFirebasePackage = manifest.name === "firebase" || manifest.name.startsWith("@firebase/");
          if (isFirebasePackage && license === "Apache-2.0") {
            noticeFiles = [{
              name: "firebase-js-sdk.LICENSE",
              text: normalizeNoticeText(readFileSync(firebaseLicenseFile, "utf8")),
            }];
          } else {
            missingNotices.push(`${id} (${license})`);
            continue;
          }
        }
        const homepage = typeof manifest.homepage === "string" ? manifest.homepage : record.homepage;
        packages.set(id, {homepage, id, license, noticeFiles});
      }
    }
  }

  if (missingNotices.length > 0) {
    throw new Error(
      `Production dependencies without bundled license or notice files:\n${missingNotices.sort().join("\n")}`,
    );
  }

  const sortedPackages = [...packages.values()].sort((left, right) => left.id.localeCompare(right.id));
  const textGroups = new Map();
  for (const dependency of sortedPackages) {
    const text = dependency.noticeFiles
      .map(({name, text: contents}) => `--- ${name} ---\n${contents}`)
      .join("\n\n");
    const key = `${dependency.license}\n${text}`;
    const group = textGroups.get(key) ?? {license: dependency.license, packages: [], text};
    group.packages.push(dependency.id);
    textGroups.set(key, group);
  }

  const lines = [
    "Riddle Quest Third-Party Software Notices",
    "==========================================",
    "",
    "This file lists the production runtime dependencies distributed with Riddle Quest.",
    "It is generated from the locked @qwordly/portal production dependency graph.",
    "",
    "Dependency inventory",
    "--------------------",
    ...sortedPackages.map(({homepage, id, license}) =>
      `- ${id} | ${license}${homepage ? ` | ${homepage}` : ""}`,
    ),
    "",
    "License and notice texts",
    "------------------------",
  ];

  for (const group of [...textGroups.values()].sort((left, right) =>
    left.packages[0].localeCompare(right.packages[0]))) {
    lines.push(
      "",
      "===============================================================================",
      `Packages: ${group.packages.join(", ")}`,
      `Declared license: ${group.license}`,
      "===============================================================================",
      group.text,
    );
  }

  return `${lines.join("\n")}\n`;
}

const generatedNotice = createNotice();
const generatedNoticeBytes = Buffer.byteLength(generatedNotice, "utf8");
if (mode === "--write") {
  writeFileSync(outputFile, generatedNotice, {encoding: "utf8", mode: 0o644});
  console.log(`Wrote ${generatedNoticeBytes} bytes to ${outputFile}`);
} else {
  let committedNotice;
  try {
    committedNotice = readFileSync(outputFile, "utf8");
  } catch (error) {
    throw new Error(`Missing generated third-party notice at ${outputFile}`, {cause: error});
  }
  if (committedNotice !== generatedNotice) {
    throw new Error("Third-party notices are stale; run `pnpm licenses:generate` and commit the result");
  }
  console.log(`Third-party notices are current (${generatedNoticeBytes} bytes)`);
}
