import {
  RACE_CATEGORY_IDS,
  RACE_SUPPORTED_LOCALES,
  type RaceCategoryId,
  type RaceDifficultyBand,
} from "@qwordly/core/race";
import {type SupportedLocale} from "@qwordly/core/validation";

/** Existing localized riddle document considered by the race migration. */
export type ExistingRaceContentRecord = {
  /** Stores locale. */
  locale: SupportedLocale;
  /** Stores document path. */
  documentPath: string;
  /** Stores data. */
  data: {
    /** Stores riddle id. */
    riddleId?: unknown;
    /** Stores canonical riddle id. */
    canonicalRiddleId?: unknown;
    /** Stores challenge key. */
    challengeKey?: unknown;
    /** Stores classic index. */
    classicIndex?: unknown;
    /** Stores daily index. */
    dailyIndex?: unknown;
    /** Stores text. */
    text?: unknown;
    /** Stores answer. */
    answer?: unknown;
    /** Stores category id. */
    categoryId?: unknown;
    /** Stores difficulty band. */
    difficultyBand?: unknown;
    /** Stores race eligible. */
    raceEligible?: unknown;
    /** Stores quality version. */
    qualityVersion?: unknown;
  };
};

/** Metadata changes proposed for one existing riddle document. */
export type RaceContentPatch = {
  /** Stores canonical riddle id. */
  canonicalRiddleId: string;
  /** Stores category id. */
  categoryId: RaceCategoryId;
  /** Stores difficulty band. */
  difficultyBand: RaceDifficultyBand;
  /** Stores race eligible. */
  raceEligible: boolean;
  /** Stores quality version. */
  qualityVersion: string;
};

/** Deterministic, non-mutating report produced by a migration dry run. */
export type RaceContentDryRunReport = {
  /** Stores scanned. */
  scanned: number;
  /** Stores proposed writes. */
  proposedWrites: Array<{
    /** Stores document path. */
    documentPath: string; /** Stores patch. */
    /** Stores patch. */
    patch: RaceContentPatch;
  }>;
  /** Stores unchanged. */
  unchanged: string[];
  /** Stores unclassifiable. */
  unclassifiable: Array<{
    /** Stores document path. */
    documentPath: string; /** Stores reason. */
    /** Stores reason. */
    reason: string;
  }>;
  /** Stores collisions. */
  collisions: Array<{
    /** Stores locale. */
    locale: SupportedLocale; /** Stores canonical riddle id. */
    /** Stores canonical riddle id. */
    canonicalRiddleId: string; /** Stores document paths. */
    /** Stores document paths. */
    documentPaths: string[];
  }>;
  /** Stores missing translations. */
  missingTranslations: Array<{
    /** Stores canonical riddle id. */
    canonicalRiddleId: string; /** Stores locales. */
    /** Stores locales. */
    locales: SupportedLocale[];
  }>;
};

/** Indicates whether is race category id. */
const isRaceCategoryId = (value: unknown): value is RaceCategoryId =>
  typeof value === "string" && (RACE_CATEGORY_IDS as readonly string[]).includes(value);

/** Indicates whether is difficulty band. */
const isDifficultyBand = (value: unknown): value is RaceDifficultyBand =>
  value === "easy" || value === "medium" || value === "hard";

/** Infers a race difficulty band from the trimmed answer length. */
export function inferRaceDifficulty(answer: string): RaceDifficultyBand {
  /** Provides length behavior. */
  const length = Array.from(answer.trim()).length;
  if (length <= 3) return "easy";
  if (length <= 5) return "medium";
  return "hard";
}

/** Derives a stable canonical identifier from supported legacy metadata. */
export function inferCanonicalRiddleId(record: ExistingRaceContentRecord): string | null {
  /** Provides {data} behavior. */
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

/** Proposes normalized race metadata without modifying the source record. */
export function proposeRaceContentPatch(record: ExistingRaceContentRecord): RaceContentPatch | null {
  /** Provides canonical riddle id behavior. */
  const canonicalRiddleId = inferCanonicalRiddleId(record);
  /** Provides answer behavior. */
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

/** Provides patch already applied behavior. */
const patchAlreadyApplied = (record: ExistingRaceContentRecord, patch: RaceContentPatch): boolean =>
  record.data.canonicalRiddleId === patch.canonicalRiddleId &&
  record.data.categoryId === patch.categoryId &&
  record.data.difficultyBand === patch.difficultyBand &&
  record.data.raceEligible === patch.raceEligible &&
  record.data.qualityVersion === patch.qualityVersion;

/** Audits proposed migration changes, collisions, and missing translations. */
export function createRaceContentDryRun(records: ExistingRaceContentRecord[]): RaceContentDryRunReport {
  /** Provides report behavior. */
  const report: RaceContentDryRunReport = {
    scanned: records.length,
    proposedWrites: [],
    unchanged: [],
    unclassifiable: [],
    collisions: [],
    missingTranslations: [],
  };
  /** Provides paths by locale and canonical behavior. */
  const pathsByLocaleAndCanonical = new Map<string, string[]>();
  /** Provides locales by canonical behavior. */
  const localesByCanonical = new Map<string, Set<SupportedLocale>>();

  for (const record of records) {
    /** Provides patch behavior. */
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

    /** Provides locale key behavior. */
    const localeKey = `${record.locale}\u0000${patch.canonicalRiddleId}`;
    /** Provides paths behavior. */
    const paths = pathsByLocaleAndCanonical.get(localeKey) ?? [];
    paths.push(record.documentPath);
    pathsByLocaleAndCanonical.set(localeKey, paths);

    /** Provides locales behavior. */
    const locales = localesByCanonical.get(patch.canonicalRiddleId) ?? new Set<SupportedLocale>();
    locales.add(record.locale);
    localesByCanonical.set(patch.canonicalRiddleId, locales);
  }

  for (const [key, documentPaths] of pathsByLocaleAndCanonical.entries()) {
    if (documentPaths.length < 2) continue;
    /** Provides [locale, canonical riddle id] behavior. */
    const [locale, canonicalRiddleId] = key.split("\u0000") as [SupportedLocale, string];
    report.collisions.push({locale, canonicalRiddleId, documentPaths: [...documentPaths].sort()});
  }

  for (const [canonicalRiddleId, presentLocales] of localesByCanonical.entries()) {
    /** Provides locales behavior. */
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
