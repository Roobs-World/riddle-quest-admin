import {describe, expect, it} from "@jest/globals";
import fixture from "../../../../firebase-functions/content/youtube-fixtures/youtube-content-fixture-v1.json";
import {createYouTubeContentSource, type YouTubeContentEnvelope} from "../bundledContent";

/** Transport envelope used by the decoder test. */
type WrappedPack = {
  /** Pack payload hidden behind a transport envelope. */
  wrapped: unknown;
};
/** The engineering fixture ships every locale pack inline. */
const inlineDocument = fixture as unknown as YouTubeContentEnvelope;
/** Locale packs separated from the shared envelope, as a target's content plugin emits them. */
const {packs, ...envelope} = fixture as unknown as YouTubeContentEnvelope & {
  /** Inline locale packs keyed by locale. */
  packs: Record<string, unknown>;
};

describe("createYouTubeContentSource", () => {
  it("exposes schema metadata before any pack loads", () => {
    /** Source bound to the inline document. */
    const source = createYouTubeContentSource(inlineDocument);
    expect(source.contentVersion).toBe(fixture.contentVersion);
    expect(source.releaseReady).toBe(Boolean(fixture.releaseReady));
  });

  it("parses an inline locale pack without a decoder", async () => {
    /** English content parsed from the inline packs. */
    const content = await createYouTubeContentSource(inlineDocument).load("en");
    expect(content.locale).toBe("en");
    expect(content.classicOrder.length).toBeGreaterThan(0);
    expect(content.riddles.get(content.classicOrder[0]!)?.answer).toEqual(expect.any(String));
  });

  it("decodes a target-generated locale loader before validation", async () => {
    /** Values handed to the decoder. */
    const decoded: unknown[] = [];
    /** Source whose English pack arrives wrapped by a generated loader. */
    const source = createYouTubeContentSource(
      {
        ...envelope,
        loadPack: {
          en: async () => ({
            /** Pack payload hidden behind a transport envelope. */
            wrapped: packs.en,
          }),
        },
      },
      async (value) => {
        decoded.push(value);
        return (value as WrappedPack).wrapped;
      },
    );
    /** English content parsed after decoding. */
    const content = await source.load("en");
    expect(decoded).toHaveLength(1);
    expect(content.riddles.size).toBeGreaterThan(0);
  });

  it("rejects a missing generated loader for a release locale", async () => {
    /** Release source that only generated an English loader. */
    const source = createYouTubeContentSource({
      ...envelope,
      releaseReady: true,
      fixture: false,
      locales: ["en", "es"],
      loadPack: {en: async () => packs.en},
    });
    await expect(source.load("es")).rejects.toThrow("youtube-content-pack-missing:es");
  });

  it("lets only the engineering fixture fall back to English", async () => {
    /** Fixture source without a Vietnamese pack. */
    const fixtureSource = createYouTubeContentSource({
      ...envelope,
      releaseReady: false,
      fixture: true,
      locales: ["en"],
      loadPack: {en: async () => packs.en},
    });
    await expect(fixtureSource.load("vi")).resolves.toMatchObject({locale: "en"});
    /** Release source without a Vietnamese pack. */
    const releaseSource = createYouTubeContentSource({
      ...envelope,
      releaseReady: true,
      fixture: false,
      locales: ["en"],
      loadPack: {en: async () => packs.en},
    });
    await expect(releaseSource.load("vi")).rejects.toThrow("youtube-content-pack-missing:vi");
  });
});
