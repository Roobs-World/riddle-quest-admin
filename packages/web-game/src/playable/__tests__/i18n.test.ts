import {YOUTUBE_COPY} from "../i18n";

describe("YouTube target copy", () => {
  it("contains the same non-empty keys in every supported locale", () => {
    /** Provides entries behavior. */
    const entries = Object.entries(YOUTUBE_COPY);
    expect(entries).toHaveLength(16);
    /** Provides english keys behavior. */
    const englishKeys = Object.keys(YOUTUBE_COPY.en).sort();
    for (const [locale, copy] of entries) {
      expect(Object.keys(copy).sort()).toEqual(englishKeys);
      expect(Object.values(copy).every((value) => value.trim().length > 0)).toBe(true);
      if (locale !== "en") expect(copy.loading).not.toBe(YOUTUBE_COPY.en.loading);
    }
  });
});
