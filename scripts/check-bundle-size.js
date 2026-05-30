const fs = require("fs");
const os = require("os");
const path = require("path");
const {execFileSync} = require("child_process");

const root = path.resolve(__dirname, "..");
const pnpmCommand = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const maxBundleBytes = Number(process.env.PERF_MAX_ANDROID_BUNDLE_BYTES || 12 * 1024 * 1024);

function walkFiles(dir, files = []) {
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(fullPath, files);
    } else {
      files.push(fullPath);
    }
  }

  return files;
}

function findAndroidBundle(outputDir) {
  const bundleFiles = walkFiles(outputDir).filter((file) => /_expo[\\/]+static[\\/]+js[\\/]+android[\\/]+.*\.(?:hbc|js)$/i.test(file));

  if (bundleFiles.length === 0) {
    throw new Error(`Could not find an exported Android bundle under ${outputDir}.`);
  }

  return bundleFiles.sort((a, b) => a.localeCompare(b))[0];
}

function formatMiB(bytes) {
  return (bytes / (1024 * 1024)).toFixed(2);
}

function main() {
  const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), "qwordly-perf-export-"));
  const startedAt = Date.now();

  try {
    execFileSync(
      pnpmCommand,
      ["exec", "expo", "export", "--platform", "android", "--no-minify", "--output-dir", outputDir],
      {
        cwd: root,
        stdio: "inherit",
        shell: process.platform === "win32",
      },
    );

    const bundlePath = findAndroidBundle(outputDir);
    const bundleBytes = fs.statSync(bundlePath).size;
    const elapsedMs = Date.now() - startedAt;

    console.log(JSON.stringify({
      bundlePath: path.relative(root, bundlePath),
      bundleBytes,
      bundleMiB: formatMiB(bundleBytes),
      exportElapsedMs: elapsedMs,
      maxBundleBytes,
    }, null, 2));

    if (bundleBytes > maxBundleBytes) {
      throw new Error(
        `Android bundle size ${bundleBytes} bytes (${formatMiB(bundleBytes)} MiB) exceeds the limit of ${maxBundleBytes} bytes.`,
      );
    }
  } finally {
    fs.rmSync(outputDir, {recursive: true, force: true});
  }
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
