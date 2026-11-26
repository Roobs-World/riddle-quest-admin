#!/usr/bin/env node
import {spawnSync} from "node:child_process";
import {copyFileSync, existsSync, mkdtempSync, renameSync, rmSync, statSync} from "node:fs";
import {tmpdir} from "node:os";
import path from "node:path";
import {fileURLToPath} from "node:url";

const repositoryDirectory = fileURLToPath(new URL("../../", import.meta.url));
const recipes = [
  {
    source: "assets/images-web/chest-closed.png",
    output: "assets/images-web/chest-closed.webp",
    width: 512,
    height: 512,
    filters: [],
  },
  {
    source: "assets/images/icon.png",
    output: "assets/images-web/riddlequest-r.webp",
    width: 256,
    height: 256,
    filters: ["-vf", "scale=256:256:flags=lanczos"],
  },
];

function run(executable, args) {
  const result = spawnSync(executable, args, {encoding: "utf8", maxBuffer: 1024 * 1024});
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${executable} failed: ${result.stderr.trim() || `exit ${result.status}, signal ${result.signal}`}`);
  }
  return result.stdout;
}

function main(args) {
  if (args.length === 1 && ["--help", "-h"].includes(args[0])) {
    console.log("Usage: node scripts/web/optimize-media.mjs [--write]\nWithout --write, encode and inspect candidates without changing project assets.");
    return;
  }
  const write = args.length === 1 && args[0] === "--write";
  if (args.length > 0 && !write) throw new Error("Only --write or --help is supported.");
  const temporaryDirectory = mkdtempSync(path.join(tmpdir(), "riddle-quest-media-"));
  const stagedFiles = [];
  try {
    const candidates = recipes.map((recipe, index) => {
      const source = path.join(repositoryDirectory, recipe.source);
      const output = path.join(repositoryDirectory, recipe.output);
      const candidate = path.join(temporaryDirectory, `${index}.webp`);
      run("ffmpeg", [
        "-hide_banner", "-loglevel", "error", "-nostdin", "-y", "-i", source,
        ...recipe.filters, "-frames:v", "1", "-c:v", "libwebp", "-pix_fmt", "bgra",
        "-lossless", "1", "-quality", "100", "-compression_level", "6",
        "-map_metadata", "-1", "-threads", "1", candidate,
      ]);
      const probe = JSON.parse(run("ffprobe", [
        "-v", "error", "-select_streams", "v:0", "-show_entries",
        "stream=codec_name,width,height", "-of", "json", candidate,
      ]));
      const stream = probe.streams?.[0];
      if (stream?.codec_name !== "webp" || stream.width !== recipe.width || stream.height !== recipe.height) {
        throw new Error(`Unexpected image format or dimensions for ${recipe.output}`);
      }
      run("ffmpeg", [
        "-hide_banner", "-loglevel", "error", "-nostdin", "-xerror",
        "-i", candidate, "-f", "null", "-",
      ]);
      return {
        recipe, candidate, output,
        sourceBytes: statSync(source).size,
        previousBytes: existsSync(output) ? statSync(output).size : null,
        candidateBytes: statSync(candidate).size,
      };
    });
    if (write) {
      // Stage beside each destination so replacement remains atomic across filesystems.
      for (const {candidate, output} of candidates) {
        const staged = `${output}.optimizing-${process.pid}`;
        stagedFiles.push(staged);
        copyFileSync(candidate, staged);
      }
      for (const [index, {output}] of candidates.entries()) renameSync(stagedFiles[index], output);
    }
    console.log(JSON.stringify({
      written: write,
      images: candidates.map(({recipe, sourceBytes, previousBytes, candidateBytes}) => ({
        source: recipe.source, output: recipe.output, sourceBytes, previousBytes, candidateBytes,
        width: recipe.width, height: recipe.height, encoding: "lossless-webp",
      })),
    }, null, 2));
  } finally {
    for (const staged of stagedFiles) rmSync(staged, {force: true});
    rmSync(temporaryDirectory, {recursive: true, force: true});
  }
}

try {
  main(process.argv.slice(2));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
