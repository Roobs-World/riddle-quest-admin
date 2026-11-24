import {afterEach, describe, expect, it} from "@jest/globals";
import {readFileSync, readdirSync} from "node:fs";
import path from "node:path";
import {renderToString} from "react-dom/server";
import {ACHIEVEMENT_DEFINITIONS} from "../../catalog/achievements";
import {LANGUAGE_OPTIONS, setLocaleAndWait} from "../../../../localization/browser/i18n";
import {AchievementFanfare} from "../../../components/rewards/FanfareModalContent";
import {AchievementsModalPage} from "../../../components/ProfileStatsModalPages";

/** Reads the actual catalogs independently of i18n's English fallback. */
function catalog(locale: string): Record<string, unknown> {
  /** Directory containing this locale’s actual JSON catalogs. */
  const directory = path.resolve(__dirname, "../../../../../src/locales", locale);
  return Object.assign({}, ...readdirSync(directory).filter((name) => name.endsWith(".json"))
    .map((name) => JSON.parse(readFileSync(path.join(directory, name), "utf8"))));
}
/** Resolves a declared translation without silently substituting English. */
function lookup(root: Record<string, unknown>, key: string | undefined): unknown {
  return key?.split(".").reduce<unknown>((value, segment) =>
    value && typeof value === "object" ? Reflect.get(value, segment) : undefined, root);
}

afterEach(async () => {await setLocaleAndWait("en");});

describe("achievement localization", () => {
  it.each(LANGUAGE_OPTIONS.map(({code}) => code))("defines every achievement name and description in %s", (locale) => {
    /** Catalog loaded without the runtime English fallback. */
    const translations = catalog(locale);
    for (const achievement of ACHIEVEMENT_DEFINITIONS) {
      expect({id: achievement.id, nameKey: achievement.nameKey, descriptionKey: achievement.descriptionKey})
        .toEqual({id: achievement.id, nameKey: expect.any(String), descriptionKey: expect.any(String)});
      expect(lookup(translations, achievement.nameKey)).toEqual(expect.any(String));
      expect(lookup(translations, achievement.descriptionKey)).toEqual(expect.any(String));
      expect(lookup(translations, achievement.nameKey)).not.toBe("");
      expect(lookup(translations, achievement.descriptionKey)).not.toBe("");
    }
  });

  it.each(LANGUAGE_OPTIONS.map(({code}) => code))("uses %s copy in both the unlock fanfare and the saved achievement list", async (locale) => {
    await setLocaleAndWait(locale);
    /** Catalog loaded without the runtime English fallback. */
    const translations = catalog(locale);
    /** Representative saved achievement rendered in both surfaces. */
    const achievement = ACHIEVEMENT_DEFINITIONS.find(({id}) => id === "classic_perfect")!;
    /** Expected localized achievement name from the catalog. */
    const title = lookup(translations, achievement.nameKey) as string;
    /** Expected localized description from the catalog. */
    const description = lookup(translations, achievement.descriptionKey) as string;
    /** Unlock surface rendered using the active locale. */
    const fanfare = renderToString(<AchievementFanfare achievementId="classic_perfect" />);
    /** Saved profile containing the same unlocked achievement. */
    const profile = {username: "Player", coins: 670, level: 3, xp: 250, winStreak: 1,
      gamesPlayed: 2, wins: 2, achievements: ["classic_perfect"], classicIndex: 2};
    /** Saved achievements surface rendered using the active locale. */
    const savedList = renderToString(<AchievementsModalPage profile={profile} />);
    for (const rendered of [fanfare, savedList]) {
      expect(rendered).toContain(renderToString(<span>{title}</span>).slice(6, -7));
      expect(rendered).toContain(renderToString(<span>{description}</span>).slice(6, -7));
      if (locale !== "en") expect(rendered).not.toContain("Classic Bullseye");
    }
  });
});
