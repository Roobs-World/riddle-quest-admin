const segmenterCache = new Map<string, Intl.Segmenter>();

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

export function lowerCaseGraphemes(value: string, locale: string = "en"): string[] {
  return splitGraphemes(value, locale).map((grapheme) => grapheme.toLocaleLowerCase(locale));
}

export function graphemeLength(value: string, locale: string = "en"): number {
  return splitGraphemes(value, locale).length;
}
