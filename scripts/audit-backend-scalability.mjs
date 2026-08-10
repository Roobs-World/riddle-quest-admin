import {readFile} from "node:fs/promises";

const generationSource = await readFile(
  new URL("../firebase-functions/src/daily/dailyRiddleGeneration.ts", import.meta.url),
  "utf8",
);
const indexes = JSON.parse(
  await readFile(new URL("../firebase-functions/firestore.indexes.json", import.meta.url), "utf8"),
);
const riddleSupplySource = await readFile(
  new URL("../firebase-functions/src/riddles/riddleSupply.ts", import.meta.url),
  "utf8",
);
const gameLogicSource = await readFile(
  new URL("../firebase-functions/src/gameplay/gameLogic.ts", import.meta.url),
  "utf8",
);

const failures = [];

if (/collection\(["']users["']\)\.get\(\)/.test(generationSource)) {
  failures.push("Daily generation must not scan the entire users collection.");
}

if (generationSource.includes("resetAllUsersDailyChallengeProgress")) {
  failures.push("Daily progress must roll over lazily instead of fan-out updating all users.");
}

if (!riddleSupplySource.includes('.orderBy("classicIndex", "desc")') || !riddleSupplySource.includes(".limit(1)")) {
  failures.push("Riddle supply checks must read only the highest classic index.");
}

if (gameLogicSource.includes('.collection("riddles")')) {
  failures.push("Gameplay paths must use the bounded riddle supply service instead of scanning riddles.");
}

const requiredExemptions = new Map([
  [
    "users",
    [
      "lastLogin",
      "createdAt",
      "registeredAt",
      "lastDailyChallengeCompletedAt",
      "progress",
      "stats",
      "unlockedAchievements",
    ],
  ],
  ["leaderboard", ["updatedAt"]],
  ["jestPurchaseGrants", ["grantedAt"]],
  ["jestReferralRewards", ["grantedAt"]],
  ["jestReferralVerifications", ["verifiedAt"]],
  ["riddleSupplyRequests", ["requestedAt"]],
]);

for (const [collectionGroup, fieldPaths] of requiredExemptions) {
  for (const fieldPath of fieldPaths) {
    const exemption = indexes.fieldOverrides?.find(
      (entry) => entry.collectionGroup === collectionGroup && entry.fieldPath === fieldPath,
    );
    if (!exemption || !Array.isArray(exemption.indexes) || exemption.indexes.length !== 0) {
      failures.push(`Missing index exemption for ${collectionGroup}.${fieldPath}.`);
    }
  }
}

if (failures.length > 0) {
  console.error("Backend scalability audit failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log("Backend scalability audit passed.");
}
