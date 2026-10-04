#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const EXPECTED_FACEBOOK_EXPORTS = Object.freeze([
  "issueFacebookIdentityNonce",
  "exchangeFacebookIdentity",
  "facebookDataDeletionCallback",
  "facebookDataDeletionStatus",
  "recordFacebookTournament",
  "listFacebookTournament",
  "blockRival",
  "reportRival",
  "listLiveRaceHistory",
  "aggregatePresenceStatus",
  "setPresenceConsent",
  "createFacebookReferral",
  "bindFacebookReferral",
  "syncKnownRivalPresenceVisibility",
  "syncBlockedRivalPresenceVisibility",
  "joinFacebookContext",
  "leaveFacebookContext",
  "listFacebookContextBoard",
  "recordFacebookContextRun",
  "facebookContextRetentionScheduler",
  "getFacebookClientConfiguration",
  "claimFacebookNotificationPermissionPrompt",
  "acceptFacebookNotificationPermissionPrompt",
  "grantFacebookRewardedContinue",
]);

function readExportNames(source) {
  const blocks = [...source.matchAll(/\bexport\s*\{([^}]*)\}(?:\s*from\s*(?:"[^"]*"|'[^']*'))?\s*;/gu)];
  return blocks.flatMap((match) => match[1]
    .replace(/\/\*[\s\S]*?\*\//gu, "")
    .replace(/\/\/.*$/gmu, "")
    .split(",")
    .map((name) => name.trim().split(/\s+as\s+/u).at(-1))
    .filter(Boolean));
}

function auditFacebookBackendExports(source) {
  const names = readExportNames(source);
  const failures = EXPECTED_FACEBOOK_EXPORTS
    .filter((name) => !names.includes(name))
    .map((name) => `Missing Facebook backend export: ${name}`);
  const duplicates = names.filter((name, index) => names.indexOf(name) !== index);
  if (duplicates.length > 0) failures.push(`Duplicate Functions exports: ${[...new Set(duplicates)].join(", ")}`);
  return failures;
}

if (require.main === module) {
  const indexPath = path.resolve(__dirname, "../src/index.ts");
  const failures = auditFacebookBackendExports(fs.readFileSync(indexPath, "utf8"));
  if (failures.length > 0) throw new Error(`Facebook backend export audit failed:\n- ${failures.join("\n- ")}`);
  console.log(`Facebook backend export audit passed: ${EXPECTED_FACEBOOK_EXPORTS.length} entry points are exported.`);
}

module.exports = {EXPECTED_FACEBOOK_EXPORTS, auditFacebookBackendExports, readExportNames};
