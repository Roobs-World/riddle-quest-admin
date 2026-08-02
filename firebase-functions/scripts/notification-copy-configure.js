#!/usr/bin/env node
"use strict";

const {initializeApp} = require("firebase-admin/app");
const {FieldValue, getFirestore} = require("firebase-admin/firestore");
const {mkdir, readFile, readdir, writeFile} = require("node:fs/promises");
const path = require("node:path");

const args = process.argv.slice(2);
const option = (name) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};
const has = (name) => args.includes(name);
const projectId = option("--project") || process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT;
const apply = has("--apply");
const confirmedProject = option("--confirm-project");
const fail = (message) => {
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
};

if (!projectId) fail("Provide --project or set GCLOUD_PROJECT/GOOGLE_CLOUD_PROJECT.");
else if (apply && confirmedProject !== projectId) fail(`Applying requires --confirm-project ${projectId}.`);
else {
  void (async () => {
    const localeRoot = path.resolve(__dirname, "../../src/locales");
    const localeNames = (await readdir(localeRoot, {withFileTypes: true}))
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
    const locales = {};
    for (const locale of localeNames) {
      const [game, race] = await Promise.all([
        readFile(path.join(localeRoot, locale, "game.json"), "utf8").then(JSON.parse),
        readFile(path.join(localeRoot, locale, "race.json"), "utf8").then(JSON.parse),
      ]);
      const copy = {
        dailyBody: game.WebPortal.NOTIFICATION_DAILY_BODY,
        dailyCta: game.WebPortal.NOTIFICATION_DAILY_CTA,
        streakBody: game.WebPortal.NOTIFICATION_STREAK_BODY,
        streakCta: game.WebPortal.NOTIFICATION_STREAK_CTA,
        weeklyBody: game.WebPortal.NOTIFICATION_WEEKLY_BODY,
        weeklyCta: game.WebPortal.NOTIFICATION_WEEKLY_CTA,
        raceTitle: race.RaceTo10.TITLE,
        raceBody: race.RaceTo10.RESULTS_NOTIFICATION_BODY,
        raceCta: race.RaceTo10.CHECK_RESULTS,
      };
      const bodyFields = new Set(["dailyBody", "streakBody", "weeklyBody", "raceBody"]);
      const ctaFields = new Set(["dailyCta", "streakCta", "weeklyCta", "raceCta"]);
      for (const [field, value] of Object.entries(copy)) {
        const maxLength = bodyFields.has(field) ? 100 : ctaFields.has(field) ? 50 : 200;
        if (
          typeof value !== "string"
          || value.trim().length === 0
          || [...value.trim()].length > maxLength
          || /\p{Extended_Pictographic}/u.test(value)
        ) {
          throw new Error(`Invalid ${field} notification copy for locale ${locale}.`);
        }
      }
      locales[locale] = copy;
    }

    initializeApp({projectId});
    const reference = getFirestore().doc("config/notifications");
    const snapshot = await reference.get();
    const next = {schemaVersion: 1, defaultLocale: "en", locales};
    process.stdout.write(`${JSON.stringify({
      projectId,
      mode: apply ? "apply" : "preview",
      document: reference.path,
      localeCount: localeNames.length,
      existingDocument: snapshot.exists,
    }, null, 2)}\n`);
    if (!apply) return;

    const backupDirectory = path.resolve(option("--backup-dir") || "artifacts/notification-copy-backups");
    await mkdir(backupDirectory, {recursive: true});
    const backupPath = path.join(
      backupDirectory,
      `notifications-${projectId}-${new Date().toISOString().replace(/[:.]/g, "-")}.json`,
    );
    await writeFile(backupPath, `${JSON.stringify({
      projectId,
      createdAt: new Date().toISOString(),
      existed: snapshot.exists,
      data: snapshot.exists ? snapshot.data() : null,
    }, null, 2)}\n`, {flag: "wx"});
    await reference.set({...next, updatedAt: FieldValue.serverTimestamp()});
    process.stdout.write(`${JSON.stringify({applied: true, backupPath}, null, 2)}\n`);
  })().catch((error) => fail(error instanceof Error ? error.stack || error.message : String(error)));
}
