import {execFileSync} from "node:child_process";
import {readFileSync, readdirSync, statSync, writeFileSync} from "node:fs";
import {isAbsolute, resolve} from "node:path";
import {fileURLToPath, pathToFileURL} from "node:url";

const portalDirectory = fileURLToPath(new URL("../", import.meta.url));
const repositoryDirectory = resolve(portalDirectory, "../..");
const licensePackage = process.env.RIDDLE_QUEST_LICENSE_PACKAGE ?? "@qwordly/portal";
const configuredOutputFile = process.env.RIDDLE_QUEST_LICENSE_OUTPUT;
if (configuredOutputFile !== undefined && !isAbsolute(configuredOutputFile)) {
  throw new Error("RIDDLE_QUEST_LICENSE_OUTPUT must be absolute when provided");
}
const outputFile = configuredOutputFile ?? resolve(portalDirectory, "public/third-party-licenses.txt");
const firebaseLicenseFile = resolve(portalDirectory, "licenses/firebase-js-sdk.LICENSE");
const bundledLicenseFiles = new Map([
  ["twirp-ts", resolve(portalDirectory, "licenses/twirp-ts.LICENSE")],
]);
const mode = process.argv[2] ?? "--check";
const pnpmModulesMetadata = JSON.parse(
  readFileSync(resolve(repositoryDirectory, "node_modules/.modules.yaml"), "utf8"),
);
const pnpmStoreDirectory = process.env.RIDDLE_QUEST_LICENSE_STORE_DIR ?? pnpmModulesMetadata.storeDir;
if (typeof pnpmStoreDirectory !== "string" || !isAbsolute(pnpmStoreDirectory)) {
  throw new Error("The installed pnpm package store must be an absolute path");
}

const normalizeNoticeText = (text) => text
  .replaceAll("\r\n", "\n")
  .replace(/[ \t]+$/gm, "")
  .trim();

const permissiveLicenseText = (license, manifest) => {
  const holder = typeof manifest.author === "string"
    ? manifest.author
    : typeof manifest.author?.name === "string" ? manifest.author.name : `${manifest.name} contributors`;
  if (/^MIT(?:\s|$|\()/i.test(license)) return `Copyright (c) ${holder}

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.`;
  if (license === "ISC") return `Copyright (c) ${holder}

Permission to use, copy, modify, and/or distribute this software for any purpose with or without fee is hereby granted, provided that the above copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.`;
  if (license === "0BSD") return `Copyright (C) ${holder}

Permission to use, copy, modify, and/or distribute this software for any purpose with or without fee is hereby granted.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.`;
  if (license === "Apache-2.0") return normalizeNoticeText(readFileSync(firebaseLicenseFile, "utf8"));
  return undefined;
};



/** Runs the active pnpm installation without depending on a global shim. */
function readLicenseInventory(packageNames) {
  const npmExecutable = process.env.npm_execpath;
  // Vercel sets npm_execpath to npm even when the install was performed by
  // pnpm. Only invoke it when it is actually a pnpm entrypoint; npm does not
  // implement `pnpm licenses list` and exits before producing JSON.
  const usesPnpmExecutable = typeof npmExecutable === "string" && /(?:^|[/\\])pnpm(?:\.cjs)?$/.test(npmExecutable);
  const command = usesPnpmExecutable ? process.execPath : "pnpm";
  const prefixArguments = usesPnpmExecutable ? [npmExecutable] : [];
  const output = execFileSync(
    command,
    [...prefixArguments, "--filter", licensePackage, "licenses", "list", ...(packageNames ? [] : ["--prod"]), "--json"],
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
    .filter((name) => /^(?:(?:licen[cs]e|copying|notice)(?:[._-].*)?|mit-license)$/i.test(name))
    .map((name) => ({name, path: resolve(packageDirectory, name)}))
    .filter(({path}) => statSync(path).isFile())
    .sort((left, right) => left.name.localeCompare(right.name))
    .map(({name, path}) => ({
      name,
      text: normalizeNoticeText(readFileSync(path, "utf8")),
    }));
}

/** Produces the committed third-party notice from the installed production graph. */
export function createNotice(packageNames, {includeHomepages = true} = {}) {
  const inventory = readLicenseInventory(packageNames);
  const packages = new Map();
  const missingNotices = [];

  for (const records of Object.values(inventory)) {
    for (const record of records) {
      for (const packageDirectory of record.paths) {
        const manifest = JSON.parse(readFileSync(resolve(packageDirectory, "package.json"), "utf8"));
        if (packageNames && !packageNames.has(manifest.name)) continue;
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
          } else if (bundledLicenseFiles.has(manifest.name)) {
            const fallback = bundledLicenseFiles.get(manifest.name);
            noticeFiles = [{
              name: fallback.split("/").at(-1),
              text: normalizeNoticeText(readFileSync(fallback, "utf8")),
            }];
          } else {
            const fallbackText = permissiveLicenseText(license, manifest);
            if (fallbackText) noticeFiles = [{name: `${license}.SPDX`, text: fallbackText}];
            else {
              missingNotices.push(`${id} (${license})`);
              continue;
            }
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

  if (packageNames) {
    const names = new Set([...packages.values()].map(record => record.id.slice(0, record.id.lastIndexOf("@"))));
    for (const name of packageNames) if (!names.has(name)) throw new Error(`Emitted package has no notice: ${name}`);
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
    packageNames ? "It includes only packages emitted in this Web Target." : "It is generated from the locked @qwordly/portal production dependency graph.",
    "",
    "Dependency inventory",
    "--------------------",
    ...sortedPackages.map(({homepage, id, license}) =>
      `- ${id} | ${license}${includeHomepages && homepage ? ` | ${homepage}` : ""}`,
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

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
if (!new Set(["--check", "--write"]).has(mode)) {
  throw new Error("Usage: node scripts/generate-third-party-licenses.mjs [--check|--write]");
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

}
