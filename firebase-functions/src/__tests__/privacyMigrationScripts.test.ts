import {readFileSync} from "node:fs";
import {resolve} from "node:path";

/** Provides script behavior. */
const script = (name: string): string => readFileSync(resolve(__dirname, `../../scripts/${name}`), "utf8");

describe("privacy migration safeguards", () => {
  it("never recreates a leaderboard row during a subject-link backfill", () => {
    /** Provides source behavior. */
    const source = script("maintenance/purge-orphan-leaderboard-rows.js");

    expect(source).toContain("backfills.forEach((ref) => batch.update(ref, {subjectUserId: ref.id}))");
    expect(source).not.toContain("backfills.forEach((ref) => batch.set(");
    expect(source).toContain("apply && confirmedProject !== projectId");
  });

  it("limits the request-receipt migration to top-level race runs", () => {
    /** Provides source behavior. */
    const source = script("races/anonymize-legacy-race-identities.js");
    /** Provides receipt migration behavior. */
    const receiptMigration = source.slice(source.indexOf("async function processLegacyRaceRequestReceipts"));

    expect(source).toContain('parent.parent.id === "raceRuns"');
    expect(source).toContain("parent.parent.parent === null");
    expect(source).toContain("parent.parent.parent !== null");
    expect(source).toContain("orphanedTargets.forEach((document) => batch.delete(document.ref))");
    expect(source).toContain("if (!parentSnapshot?.exists)");
    expect(receiptMigration).toContain("let orphaned = 0");
    expect(receiptMigration).toContain("let deleted = 0");
    expect(source).toContain("apply && confirmedProject !== projectId");
  });
});
