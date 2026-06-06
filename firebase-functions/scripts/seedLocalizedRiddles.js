"use strict";

const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");
const admin = require("firebase-admin");

const repoRoot = path.resolve(__dirname, "..", "..");
const functionsRoot = path.resolve(__dirname, "..");

dotenv.config({path: path.join(repoRoot, ".env")});
dotenv.config({path: path.join(functionsRoot, ".env")});

function findFileByName(startDir, fileName) {
  const skipDirectories = new Set([".git", "node_modules", ".expo", ".gradle-local", "coverage", "lib"]);
  const stack = [startDir];

  while (stack.length > 0) {
    const currentDir = stack.pop();
    if (!currentDir) {
      continue;
    }

    let entries;
    try {
      entries = fs.readdirSync(currentDir, {withFileTypes: true});
    } catch {
      continue;
    }

    for (const entry of entries) {
      const entryPath = path.join(currentDir, entry.name);
      if (entry.isFile() && entry.name === fileName) {
        return entryPath;
      }
      if (entry.isDirectory() && !skipDirectories.has(entry.name)) {
        stack.push(entryPath);
      }
    }
  }

  return null;
}

function loadServiceAccountCredential() {
  const credentialPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!credentialPath) {
    throw new Error("GOOGLE_APPLICATION_CREDENTIALS is required to seed Firestore.");
  }

  const basename = path.basename(credentialPath);
  const candidatePaths = [
    credentialPath,
    path.resolve(repoRoot, credentialPath),
    path.resolve(functionsRoot, credentialPath),
    path.join(repoRoot, credentialPath),
    path.join(functionsRoot, credentialPath),
  ];

  for (const candidate of candidatePaths) {
    if (candidate && fs.existsSync(candidate)) {
      return admin.credential.cert(require(candidate));
    }
  }

  const discoveredPath =
    findFileByName(repoRoot, basename) || findFileByName(functionsRoot, basename) || findFileByName(path.dirname(repoRoot), basename);

  if (discoveredPath) {
    return admin.credential.cert(require(discoveredPath));
  }

  throw new Error(`Service account file not found: ${credentialPath}`);
}

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is required to generate riddles.");
  }

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: loadServiceAccountCredential(),
    });
  }

  const {initializeLocalizedRiddleDatabaseIfEmpty, generateLocalizedTodaysDailyChallenge} = require(
    path.join(functionsRoot, "lib", "riddleGeneration.js"),
  );

  const classicCount = Number.parseInt(process.env.RIDDLE_SEED_CLASSIC_COUNT ?? "20", 10);
  const normalizedClassicCount = Number.isFinite(classicCount) && classicCount > 0 ? classicCount : 20;

  console.log(`Seeding localized classic riddles with ${normalizedClassicCount} entries per locale...`);
  await initializeLocalizedRiddleDatabaseIfEmpty(normalizedClassicCount);

  console.log("Seeding today's localized daily challenge for all supported locales...");
  await generateLocalizedTodaysDailyChallenge(true);

  console.log("Localized riddle seed complete.");
}

main()
  .then(async () => {
    if (admin.apps.length) {
      await Promise.all(admin.apps.map((app) => app.delete().catch(() => undefined)));
    }
    process.exit(0);
  })
  .catch(async (error) => {
    console.error("Failed to seed localized riddles:", error);
    if (admin.apps.length) {
      await Promise.all(admin.apps.map((app) => app.delete().catch(() => undefined)));
    }
    process.exit(1);
  });
