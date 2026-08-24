/** Reuses one grapheme segmenter per locale for the lifetime of the module. */
const segmenterCache = new Map<string, Intl.Segmenter>();

/**
 * Resolves the cached grapheme segmenter for a locale when the runtime supports it.
 *
 * @param locale - Locale used by `Intl.Segmenter`; an empty value falls back to `en`.
 * @returns A cached segmenter, or `null` when `Intl.Segmenter` is unavailable.
 */
function getSegmenter(locale: string): Intl.Segmenter | null {
  if (typeof Intl === "undefined" || typeof Intl.Segmenter !== "function") {
    return null;
  }

  const cacheKey = locale || "en";
  const cached = segmenterCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const segmenter = new Intl.Segmenter(cacheKey, {granularity: "grapheme"});
  segmenterCache.set(cacheKey, segmenter);
  return segmenter;
}

/**
 * Splits text into user-perceived characters after NFC normalization.
 *
 * @param value - Text to segment. An empty string produces an empty array.
 * @param locale - Locale supplied to `Intl.Segmenter`. Defaults to `en`.
 * @returns NFC-normalized grapheme clusters in source order.
 * @throws {@link RangeError} when the runtime rejects an invalid locale identifier.
 *
 * @remarks
 * Runtimes without `Intl.Segmenter` fall back to `Array.from`, which preserves
 * Unicode code points but can split combining sequences and joined emoji that a
 * full grapheme segmenter would keep together.
 */
export function splitGraphemes(value: string, locale: string = "en"): string[] {
  if (!value) {
    return [];
  }

  const normalizedValue = value.normalize("NFC");
  const segmenter = getSegmenter(locale);
  if (segmenter) {
    return Array.from(segmenter.segment(normalizedValue), (segment) => segment.segment);
  }

  return Array.from(normalizedValue);
}

/**
 * Splits text into NFC-normalized graphemes and lowercases each cluster.
 *
 * @param value - Text to normalize, segment, and lowercase.
 * @param locale - Locale used for segmentation and locale-aware casing. Defaults
 * to `en`.
 * @returns One lowercased string for each source grapheme. A casing operation may
 * produce more than one Unicode code point inside an element.
 * @throws {@link RangeError} when the runtime rejects an invalid locale identifier.
 */
export function lowerCaseGraphemes(value: string, locale: string = "en"): string[] {
  return splitGraphemes(value, locale).map((grapheme) => grapheme.toLocaleLowerCase(locale));
}

/**
 * Counts user-perceived characters after NFC normalization.
 *
 * @param value - Text whose grapheme clusters should be counted.
 * @param locale - Locale supplied to `Intl.Segmenter`. Defaults to `en`.
 * @returns The number of elements produced by {@link splitGraphemes}.
 * @throws {@link RangeError} when the runtime rejects an invalid locale identifier.
 *
 * @remarks
 * The count inherits {@link splitGraphemes}' code-point fallback on runtimes
 * without `Intl.Segmenter`.
 */
export function graphemeLength(value: string, locale: string = "en"): number {
  return splitGraphemes(value, locale).length;
}
