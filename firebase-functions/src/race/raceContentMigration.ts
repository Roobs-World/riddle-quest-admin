import {
  RACE_CATEGORY_IDS,
  RACE_SUPPORTED_LOCALES,
  type RaceCategoryId,
  type RaceDifficultyBand,
} from "@qwordly/core/race";
import {type SupportedLocale} from "@qwordly/core/validation";

export type ExistingRaceContentRecord = {
  locale: SupportedLocale;
  documentPath: string;
  data: {
    riddleId?: unknown;
    canonicalRiddleId?: unknown;
    challengeKey?: unknown;
    classicIndex?: unknown;
    dailyIndex?: unknown;
    text?: unknown;
    answer?: unknown;
    categoryId?: unknown;
    difficultyBand?: unknown;
    raceEligible?: unknown;
    qualityVersion?: unknown;
  };
};

export type RaceContentPatch = {
  canonicalRiddleId: string;
  categoryId: RaceCategoryId;
  difficultyBand: RaceDifficultyBand;
  raceEligible: boolean;
  qualityVersion: string;
};

export type RaceContentDryRunReport = {
  scanned: number;
  proposedWrites: Array<{documentPath: string; patch: RaceContentPatch}>;
  unchanged: string[];
  unclassifiable: Array<{documentPath: string; reason: string}>;
  collisions: Array<{locale: SupportedLocale; canonicalRiddleId: string; documentPaths: string[]}>;
  missingTranslations: Array<{canonicalRiddleId: string; locales: SupportedLocale[]}>;
};

const isRaceCategoryId = (value: unknown): value is RaceCategoryId =>
  typeof value === "string" && (RACE_CATEGORY_IDS as readonly string[]).includes(value);

const isDifficultyBand = (value: unknown): value is RaceDifficultyBand =>
  value === "easy" || value === "medium" || value === "hard";

export function inferRaceDifficulty(answer: string): RaceDifficultyBand {
  const length = Array.from(answer.trim()).length;
  if (length <= 3) return "easy";
  if (length <= 5) return "medium";
  return "hard";
}

export function inferCanonicalRiddleId(record: ExistingRaceContentRecord): string | null {
  const {data} = record;
  if (typeof data.canonicalRiddleId === "string" && data.canonicalRiddleId.trim()) {
    return data.canonicalRiddleId.trim();
  }
  if (typeof data.classicIndex === "number" && Number.isInteger(data.classicIndex) && data.classicIndex >= 0) {
    return `classic:${data.classicIndex}`;
  }
  if (typeof data.challengeKey === "string" && data.challengeKey.trim()) {
    return `daily:${data.challengeKey.trim()}`;
  }
  if (typeof data.dailyIndex === "number" && Number.isInteger(data.dailyIndex) && data.dailyIndex >= 0) {
    return `daily:${data.dailyIndex}`;
  }
  return null;
}

export function proposeRaceContentPatch(record: ExistingRaceContentRecord): RaceContentPatch | null {
  const canonicalRiddleId = inferCanonicalRiddleId(record);
  const answer = typeof record.data.answer === "string" ? record.data.answer.trim() : "";
  if (!canonicalRiddleId || !answer) return null;

  return {
    canonicalRiddleId,
    categoryId: isRaceCategoryId(record.data.categoryId) ? record.data.categoryId : "mixed",
    difficultyBand: isDifficultyBand(record.data.difficultyBand)
      ? record.data.difficultyBand
      : inferRaceDifficulty(answer),
    raceEligible: record.data.raceEligible === true,
    qualityVersion:
      typeof record.data.qualityVersion === "string" && record.data.qualityVersion.trim()
        ? record.data.qualityVersion.trim()
        : "unreviewed_v1",
  };
}

const patchAlreadyApplied = (record: ExistingRaceContentRecord, patch: RaceContentPatch): boolean =>
  record.data.canonicalRiddleId === patch.canonicalRiddleId &&
  record.data.categoryId === patch.categoryId &&
  record.data.difficultyBand === patch.difficultyBand &&
  record.data.raceEligible === patch.raceEligible &&
  record.data.qualityVersion === patch.qualityVersion;

export function createRaceContentDryRun(records: ExistingRaceContentRecord[]): RaceContentDryRunReport {
  const report: RaceContentDryRunReport = {
    scanned: records.length,
    proposedWrites: [],
    unchanged: [],
    unclassifiable: [],
    collisions: [],
    missingTranslations: [],
  };
  const pathsByLocaleAndCanonical = new Map<string, string[]>();
  const localesByCanonical = new Map<string, Set<SupportedLocale>>();

  for (const record of records) {
    const patch = proposeRaceContentPatch(record);
    if (!patch) {
      report.unclassifiable.push({
        documentPath: record.documentPath,
        reason: "A canonical index/key and non-empty answer are required",
      });
      continue;
    }

    if (patchAlreadyApplied(record, patch)) report.unchanged.push(record.documentPath);
    else report.proposedWrites.push({documentPath: record.documentPath, patch});

    const localeKey = `${record.locale}\u0000${patch.canonicalRiddleId}`;
    const paths = pathsByLocaleAndCanonical.get(localeKey) ?? [];
    paths.push(record.documentPath);
    pathsByLocaleAndCanonical.set(localeKey, paths);

    const locales = localesByCanonical.get(patch.canonicalRiddleId) ?? new Set<SupportedLocale>();
    locales.add(record.locale);
    localesByCanonical.set(patch.canonicalRiddleId, locales);
  }

  for (const [key, documentPaths] of pathsByLocaleAndCanonical.entries()) {
    if (documentPaths.length < 2) continue;
    const [locale, canonicalRiddleId] = key.split("\u0000") as [SupportedLocale, string];
    report.collisions.push({locale, canonicalRiddleId, documentPaths: [...documentPaths].sort()});
  }

  for (const [canonicalRiddleId, presentLocales] of localesByCanonical.entries()) {
    const locales = RACE_SUPPORTED_LOCALES.filter((locale) => !presentLocales.has(locale));
    if (locales.length > 0) report.missingTranslations.push({canonicalRiddleId, locales});
  }

  report.proposedWrites.sort((left, right) => left.documentPath.localeCompare(right.documentPath));
  report.unchanged.sort();
  report.unclassifiable.sort((left, right) => left.documentPath.localeCompare(right.documentPath));
  report.collisions.sort((left, right) =>
    `${left.locale}:${left.canonicalRiddleId}`.localeCompare(`${right.locale}:${right.canonicalRiddleId}`),
  );
  report.missingTranslations.sort((left, right) => left.canonicalRiddleId.localeCompare(right.canonicalRiddleId));
  return report;
}
