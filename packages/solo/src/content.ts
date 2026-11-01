import {splitGraphemes} from "@qwordly/core/game";
import {YOUTUBE_ANSWER_MAX_GRAPHEMES} from "./limits";
import type {YouTubeContent, YouTubeLocale, YouTubeRiddle} from "./types";
/** Defines the youtube locales value. */
export const YOUTUBE_LOCALES = [
  "en",
  "es",
  "pt",
  "fr",
  "de",
  "ja",
  "ko",
  "hi",
  "ru",
  "tr",
  "ar",
  "id",
  "it",
  "nl",
  "pl",
  "vi",
] as const satisfies readonly YouTubeLocale[];
/** Provides locale set behavior. */
const localeSet = new Set<string>(YOUTUBE_LOCALES);
/** Defines the id pattern value. */
const ID_PATTERN = /^[\p{L}\p{M}\p{N}_.:@/-]+$/u;
/** Defines the fingerprint pattern value. */
const FINGERPRINT_PATTERN = /^[a-f0-9]{16,128}$/u;
/** Defines the answer pattern value. */
const ANSWER_PATTERN = /^[\p{L}\p{M}]+$/u;
/** Describes content riddle record. */
type ContentRiddleRecord = Readonly<{
  /** Stores text. */
  text: string;
  /** Stores answer. */
  answer: string;
  /** Stores category id. */
  categoryId: string;
  /** Stores difficulty band. */
  difficultyBand: "easy" | "medium" | "hard";
  /** Stores content fingerprint. */
  contentFingerprint: string;
}>;
/** Describes you tube content document. */
type YouTubeContentDocument = Readonly<{
  /** Stores schema version. */
  schemaVersion: 1;
  /** Stores content version. */
  contentVersion: string;
  /** Stores release ready. */
  releaseReady: boolean;
  /** Stores fixture. */
  fixture: boolean;
  /** Stores locales. */
  locales: YouTubeLocale[];
  /** Stores classic order. */
  classicOrder: string[];
  /** Stores daily schedule. */
  dailySchedule: {
    /** Stores schedule version. */
    scheduleVersion: number;
    /** Stores segments. */
    segments: Array<{
      /** Stores starts on. */
      startsOn: string;
      /** Stores canonical ids. */
      canonicalIds: string[];
    }>;
  };
  /** Stores packs. */
  packs: Record<YouTubeLocale, Record<string, ContentRiddleRecord>>;
}>;
/** Indicates whether is record. */
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
/** Indicates whether is id. */
const isId = (value: unknown, max = 200): value is string =>
  typeof value === "string" && value.length > 0 && value.length <= max && ID_PATTERN.test(value);
/** Indicates whether is utc day. */
const isUtcDay = (value: unknown): value is string => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/u.test(value)) return false;
  /** Parses d. */
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
};
/** Parses riddle. */
const parseRiddle = (id: string, value: unknown, locale: YouTubeLocale): YouTubeRiddle => {
  if (
    !isRecord(value) ||
    typeof value.text !== "string" ||
    value.text.trim().length < 1 ||
    value.text.length > 500 ||
    typeof value.answer !== "string" ||
    value.answer !== value.answer.normalize("NFC") ||
    !ANSWER_PATTERN.test(value.answer) ||
    splitGraphemes(value.answer, locale).length < 1 ||
    splitGraphemes(value.answer, locale).length > YOUTUBE_ANSWER_MAX_GRAPHEMES ||
    !isId(value.categoryId, 80) ||
    (value.difficultyBand !== "easy" && value.difficultyBand !== "medium" && value.difficultyBand !== "hard") ||
    typeof value.contentFingerprint !== "string" ||
    !FINGERPRINT_PATTERN.test(value.contentFingerprint)
  ) {
    throw new Error(`youtube-content-riddle-invalid:${locale}:${id}`);
  }
  return {
    canonicalId: id,
    text: value.text,
    answer: value.answer,
    categoryId: value.categoryId,
    difficultyBand: value.difficultyBand,
    contentFingerprint: value.contentFingerprint,
  };
};
/** Maps a YouTube BCP-47 language to a bundled primary-language pack. */
export function resolveYouTubeLocale(languageTag: string): YouTubeLocale {
  /** Provides primary behavior. */
  const primary = languageTag.trim().toLocaleLowerCase("en").split(/[-_]/u)[0];
  return localeSet.has(primary) ? (primary as YouTubeLocale) : "en";
}
/** Validates the compiled content boundary before exposing answer-bearing data to the app. */
export function parseYouTubeContentDocument(value: unknown, locale: YouTubeLocale): YouTubeContent {
  if (
    !isRecord(value) ||
    value.schemaVersion !== 1 ||
    typeof value.releaseReady !== "boolean" ||
    !isId(value.contentVersion, 160) ||
    !Array.isArray(value.locales) ||
    !value.locales.every((entry) => localeSet.has(String(entry))) ||
    new Set(value.locales).size !== value.locales.length ||
    !value.locales.includes(locale)
  ) {
    throw new Error("youtube-content-envelope-invalid");
  }
  if (
    !Array.isArray(value.classicOrder) ||
    value.classicOrder.length === 0 ||
    !value.classicOrder.every((entry) => isId(entry, 160)) ||
    new Set(value.classicOrder).size !== value.classicOrder.length
  ) {
    throw new Error("youtube-content-classic-order-invalid");
  }
  if (
    !isRecord(value.dailySchedule) ||
    !Number.isSafeInteger(value.dailySchedule.scheduleVersion) ||
    Number(value.dailySchedule.scheduleVersion) < 1 ||
    !Array.isArray(value.dailySchedule.segments) ||
    value.dailySchedule.segments.length < 1 ||
    value.dailySchedule.scheduleVersion !== value.dailySchedule.segments.length
  ) {
    throw new Error("youtube-content-daily-schedule-invalid");
  }
  /** Provides daily segments behavior. */
  const dailySegments = value.dailySchedule.segments.map((segment, index) => {
    if (
      !isRecord(segment) ||
      Object.keys(segment).sort().join(",") !== "canonicalIds,startsOn" ||
      !isUtcDay(segment.startsOn) ||
      !Array.isArray(segment.canonicalIds) ||
      segment.canonicalIds.length < 1 ||
      !segment.canonicalIds.every((entry) => isId(entry, 160)) ||
      new Set(segment.canonicalIds).size !== segment.canonicalIds.length
    ) {
      throw new Error(`youtube-content-daily-segment-invalid:${index}`);
    }
    if (
      index > 0 &&
      segment.startsOn <=
        String(
          (
            value.dailySchedule as {
              /** Stores segments. */
              segments: Array<{
                /** Stores starts on. */
                startsOn: string;
              }>;
            }
          ).segments[index - 1]?.startsOn,
        )
    ) {
      throw new Error(`youtube-content-daily-segment-order-invalid:${index}`);
    }
    return {startsOn: segment.startsOn, canonicalIds: [...segment.canonicalIds] as string[]};
  });
  if (!isRecord(value.packs) || !isRecord(value.packs[locale]))
    throw new Error(`youtube-content-pack-missing:${locale}`);
  /** Provides raw pack behavior. */
  const rawPack = value.packs[locale];
  /** Provides required ids behavior. */
  const requiredIds = new Set([...value.classicOrder, ...dailySegments.flatMap(({canonicalIds}) => canonicalIds)]);
  /** Provides riddles behavior. */
  const riddles = new Map<string, YouTubeRiddle>();
  for (const id of requiredIds) {
    if (!isId(id, 160)) throw new Error(`youtube-content-id-invalid:${String(id)}`);
    riddles.set(id, parseRiddle(id, rawPack[id], locale));
  }
  return {
    contentVersion: value.contentVersion,
    locale,
    classicOrder: [...value.classicOrder] as string[],
    daily: {
      scheduleVersion: value.dailySchedule.scheduleVersion as number,
      segments: dailySegments,
    },
    riddles,
  };
}
/** Bundled envelope shape shared by the source JSON document and target-generated loader envelopes. */
export type YouTubeContentEnvelope = Readonly<{
  /** Schema compatibility is available before any answer-bearing pack loads. */
  contentVersion: string;
  /** Whether the document is the reviewed release pack rather than an engineering fixture. */
  releaseReady?: unknown;
  /** Explicit engineering fixture permits an English fallback. */
  fixture?: boolean;
  /** Locales included in this document. */
  locales: readonly string[];
  /** Local dynamic loaders generated by a target's content plugin. */
  loadPack?: Partial<Record<YouTubeLocale, () => Promise<unknown>>>;
  /** Inline locale packs when the document ships whole. */
  packs?: unknown;
}>;
/** Locale-selecting content access bound to one bundled document. */
export type YouTubeContentSource = Readonly<{
  /** Schema compatibility is available before loading any answer-bearing pack. */
  contentVersion: string;
  /** Whether the bound document is release-ready. */
  releaseReady: boolean;
  /** Loads only the selected locale from the bound document. */
  load(locale: YouTubeLocale): Promise<YouTubeContent>;
}>;
/** Binds one bundled content document, and its optional pack decoder, to a locale-selecting loader. */
export function createYouTubeContentSource(
  contentDocument: YouTubeContentEnvelope,
  decodePack: (value: unknown) => Promise<unknown> = async (value) => value,
): YouTubeContentSource {
  return {
    contentVersion: contentDocument.contentVersion,
    releaseReady: Boolean(contentDocument.releaseReady),
    /** Loads only the selected locale from the bound document. */
    async load(locale) {
      /** Release languages stay strict; only the engineering fixture may fall back. */
      const selected = contentDocument.locales.includes(locale)
        ? locale
        : contentDocument.fixture === true
          ? "en"
          : locale;
      if (!contentDocument.loadPack) return parseYouTubeContentDocument(contentDocument, selected);
      /** Target-generated loader for the selected local pack. */
      const load = contentDocument.loadPack[selected];
      if (!load) throw new Error(`youtube-content-pack-missing:${selected}`);
      /** Answer-bearing data stays behind the existing runtime validation. */
      const pack = await decodePack(await load());
      return parseYouTubeContentDocument({...contentDocument, packs: {[selected]: pack}}, selected);
    },
  };
}
