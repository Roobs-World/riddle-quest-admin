import {expect, it, jest} from "@jest/globals";
import {mkdirSync, readFileSync, rmSync, writeFileSync} from "node:fs";
import path from "node:path";
import {parseEnv} from "node:util";
import type {JestPlatformPort} from "../types";
import {parseNotificationCopyDocument, type NotificationCopy} from "../notifications/copy";

/** Effects captured from the production notification hook. */
const mockEffects: Array<() => void | (() => void)> = [];
/** Selected bundled or exported Firestore copy used by the hook. */
let mockCopy: NotificationCopy;
jest.mock("react", () => ({
  useEffect: (effect: () => void | (() => void)) => mockEffects.push(effect),
  useState: () => [mockCopy, jest.fn()],
}));
import {useJestNotifications} from "../notifications/useJestNotifications";

/** A payload that crosses the target's actual notification adapter boundary. */
type Payload = Parameters<JestPlatformPort["scheduleNotification"]>[0];
/** Repository root, independent of the operator's working directory. */
const repository = path.resolve(__dirname, "../../../../..");
/** Locale under test; other writing systems are reported rather than silently transliterated. */
const locale = process.env.JEST_NOTIFICATION_TEST_LOCALE ?? "en";
/** Public Vite configuration used by the normal Jest artifact. */
const configuration = parseEnv(readFileSync(path.join(repository, "config/vite/portal/.env.jest"), "utf8"));
/** Notification image reference configured for the actual Jest target. */
const assetReference = configuration.VITE_JEST_NOTIFICATION_ASSET_REFERENCE;
/** Localized game copy used by the production fallback. */
const game = JSON.parse(readFileSync(path.join(repository, "src/locales", locale, "game.json"), "utf8")).WebPortal;
/** Localized race copy used by the production fallback. */
const race = JSON.parse(readFileSync(path.join(repository, "src/locales", locale, "race.json"), "utf8")).RaceTo10;
/** Declared Jest listing identity. */
const manifest = JSON.parse(readFileSync(path.join(repository, "docs/jest-developer-console.json"), "utf8"));
/** Optional operator-exported config/notifications document. */
const copyFile = process.env.JEST_NOTIFICATION_COPY_FILE;
/** Source label prevents bundled-copy results being mistaken for a live configuration check. */
const copySource = copyFile ? "Exported Firestore document" : "Bundled fallback copy";

it("audits actual engagement and race payloads against the supplied Jest Fund checklist", async () => {
  /** Report destination requested by the dedicated operator command. */
  const reportDirectory = process.env.JEST_NOTIFICATION_REPORT_DIR;
  if (reportDirectory) {
    // A copy-loading failure must never leave an earlier passing report behind.
    rmSync(path.join(reportDirectory, "notifications.json"), {force: true});
    rmSync(path.join(reportDirectory, "notifications.md"), {force: true});
  }
  mockCopy = copyFile
    ? parseNotificationCopyDocument(JSON.parse(readFileSync(copyFile, "utf8")), locale)
    : {
        dailyBody: game.NOTIFICATION_DAILY_BODY,
        dailyCta: game.NOTIFICATION_DAILY_CTA,
        streakBody: game.NOTIFICATION_STREAK_BODY,
        streakCta: game.NOTIFICATION_STREAK_CTA,
        weeklyBody: game.NOTIFICATION_WEEKLY_BODY,
        weeklyCta: game.NOTIFICATION_WEEKLY_CTA,
        raceTitle: race.TITLE,
        raceBody: race.RESULTS_NOTIFICATION_BODY,
        raceCta: race.CHECK_RESULTS,
      };
  /** Rows captured for ordinary and maximum-length player names. */
  const rows: Array<{
    /** Personalization scenario that produced this notification. */
    scenario: string;
    /** Actual outbound adapter payload. */
    payload: Payload;
    /** Individually evaluated Fund checklist rules. */
    checks: Record<string, boolean>;
  }> = [];
  /** Unexpected lifecycle errors must fail the audit rather than produce an empty green report. */
  const failures: string[] = [];
  for (const username of ["Nova", "A".repeat(24)]) {
    mockEffects.length = 0;
    Object.defineProperty(globalThis, "window", {configurable: true, value: new EventTarget()});
    /** Actual outbound payloads; this adapter never contacts Jest or sends messages. */
    const payloads: Payload[] = [];
    /** Minimal notification adapter used at the production hook boundary. */
    const platform = {
      scheduleNotification: async (payload: Payload) => {
        payloads.push(payload);
        return {status: "success" as const, value: undefined};
      },
      removeNotification: async () => ({status: "success" as const, value: undefined}),
    } as JestPlatformPort;
    useJestNotifications({
      locale,
      mockRuntime: false,
      session: {
        player: {playerId: "fund-checklist-player", registered: true},
        profile: {username}, entryIntent: {}, preferences: {}, playerData: null, firebaseAuthenticated: true,
      },
      engagementProgress: {level: 100, winStreak: 30, wins: 500},
      gameTitle: game.JEST_APP_TITLE,
      playerFallback: game.NOTIFICATION_PLAYER_FALLBACK,
      fallbackCopy: mockCopy,
      assetReference,
      platform,
      notificationsEnabled: () => true,
      withPlatformActivity: async (operation) => operation(),
      trackFunnel: (event, details) => {
        if (event.includes("failed")) failures.push(`${event}: ${JSON.stringify(details)}`);
      },
    });
    // Copy loading is covered separately. These effects exercise the real scheduling
    // and race-event paths with the explicitly identified copy source above.
    mockEffects[1]();
    /** Removes the production race-event listener after each scenario. */
    const cleanup = mockEffects[2]();
    window.dispatchEvent(new CustomEvent("riddle-quest:race-challenge-published", {detail: {challengeId: "fund-test-race"}}));
    await new Promise<void>((resolve) => setImmediate(resolve));
    if (typeof cleanup === "function") cleanup();
    if (payloads.length !== 8) failures.push(`${username}: expected 7 daily reminders and 1 race reminder; got ${payloads.length}`);
    /** Daily payloads must contain three different bodies and cover all seven days. */
    const daily = payloads.filter((payload) => payload.identifier?.startsWith("riddle-quest-d"));
    if (new Set(daily.map((payload) => payload.body)).size < 3) failures.push("Daily reminders are not diverse");
    if (daily.map((payload) => payload.scheduledInDays).sort().join(",") !== "1,2,3,4,5,6,7") failures.push("D1-D7 coverage is incomplete");
    payloads.forEach((payload) => rows.push({
      scenario: username === "Nova" ? "Ordinary name" : "24-character name",
      payload,
      checks: {
        gameTitle: `${payload.title ?? ""} ${payload.body}`.includes(manifest.displayName),
        imageReference: Boolean(assetReference && payload.assetReference === assetReference),
        bodyLength: payload.body.length > 0 && [...payload.body].length <= 100,
        basicCharacters: /^[\x20-\x7e]+$/.test(`${payload.title ?? ""}${payload.body}${payload.ctaText}`),
        resolvedTokens: !/\{[^}]+\}/.test(`${payload.title ?? ""}${payload.body}${payload.ctaText}`),
      },
    }));
  }
  if (reportDirectory) {
    mkdirSync(reportDirectory, {recursive: true});
    writeFileSync(path.join(reportDirectory, "notifications.json"), JSON.stringify({
      generatedAt: new Date().toISOString(), locale, copySource, assetReference, failures, rows,
      assetLibraryExists: "UNVERIFIED - inspect Developer Console",
      assetApproved: "UNVERIFIED - inspect Developer Console",
      delivery: "NOT TESTED - no messages sent",
    }, null, 2));
    /** Escapes notification text for Markdown table cells. */
    const cell = (value: unknown) => String(value ?? "").replace(/\|/g, "\\|").replace(/[\r\n]/g, " ");
    /** Human-readable checklist with every rendered body and exact character count. */
    const report = [
      "# Jest Fund notification test", "", `Locale: ${locale}. Source: ${copySource}.`, "",
      `Configured asset reference: ${assetReference || "MISSING"}.`, "",
      "Asset exists in Jest library: **UNVERIFIED**. Asset approved: **UNVERIFIED**.",
      "No real messages were sent. SDK acceptance, approval, and delivery require the sandbox procedure in docs/jest-notification-testing.md.", "",
      "Basic characters uses conservative printable ASCII (U+0020-U+007E); non-Latin copy needs review, not automatic removal.", "",
      "| Scenario | Identifier | Day | Title | Body | Characters | Failed checks |",
      "| --- | --- | --- | --- | --- | --- | --- |",
      ...rows.map(({scenario, payload, checks}) => `| ${[scenario, payload.identifier, payload.scheduledInDays, payload.title, payload.body, [...payload.body].length, Object.entries(checks).filter(([, passed]) => !passed).map(([name]) => name).join(", ") || "None"].map(cell).join(" | ")} |`),
      "", ...failures.map((failure) => `- ${failure}`), "",
    ].join("\n");
    writeFileSync(path.join(reportDirectory, "notifications.md"), report);
  }
  expect(failures).toEqual([]);
  expect(rows).toHaveLength(16);
  expect(rows.filter(({checks}) => Object.values(checks).some((passed) => !passed))).toEqual([]);
});
