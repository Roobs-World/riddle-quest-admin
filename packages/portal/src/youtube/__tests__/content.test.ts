import {loadYouTubeContent, parseYouTubeContentDocument, resolveYouTubeLocale, youtubeContentVersion} from "../../playable/content";
/** Provides content document behavior. */
const contentDocument = (startsOn: string) => ({
  schemaVersion: 1,
  contentVersion: "content-v1",
  releaseReady: false,
  fixture: true,
  locales: ["en"],
  classicOrder: ["riddle:one"],
  dailySchedule: {scheduleVersion: 1, segments: [{startsOn, canonicalIds: ["riddle:one"]}]},
  packs: {
    en: {
      "riddle:one": {
        text: "A valid clue?",
        answer: "word",
        categoryId: "mixed",
        difficultyBand: "easy",
        contentFingerprint: "0123456789abcdef",
      },
    },
  },
});

describe("YouTube runtime content boundary", () => {
  it("falls back unsupported BCP-47 tags while preserving supported primary tags", () => {
    expect(resolveYouTubeLocale("fr-CA")).toBe("fr");
    expect(resolveYouTubeLocale("unknown-ZZ")).toBe("en");
  });

  it("loads the source fixture asynchronously and keeps compatibility metadata available without a pack", async () => {
    expect(typeof youtubeContentVersion).toBe("string");
    /** Runtime selection falls back only for the explicit English fixture. */
    const content = await loadYouTubeContent("fr");
    expect(content.locale).toBe("en");
    expect(content.contentVersion).toBe(youtubeContentVersion);
    expect(content.riddles.size).toBeGreaterThan(0);
  });

  it("rejects regex-shaped invalid UTC dates without throwing a RangeError", () => {
    expect(() => parseYouTubeContentDocument(contentDocument("2026-99-99"), "en")).toThrow(
      "youtube-content-daily-segment-invalid:0",
    );
  });
});
