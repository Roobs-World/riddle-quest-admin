import en from "../../../../../src/locales/en/race.json";
import es from "../../../../../src/locales/es/race.json";
import pt from "../../../../../src/locales/pt/race.json";
import fr from "../../../../../src/locales/fr/race.json";
import de from "../../../../../src/locales/de/race.json";
import ja from "../../../../../src/locales/ja/race.json";
import ko from "../../../../../src/locales/ko/race.json";
import hi from "../../../../../src/locales/hi/race.json";
import ru from "../../../../../src/locales/ru/race.json";
import tr from "../../../../../src/locales/tr/race.json";
import ar from "../../../../../src/locales/ar/race.json";
import id from "../../../../../src/locales/id/race.json";
import it from "../../../../../src/locales/it/race.json";
import nl from "../../../../../src/locales/nl/race.json";
import pl from "../../../../../src/locales/pl/race.json";
import vi from "../../../../../src/locales/vi/race.json";
import {achievementText} from "../../../../../src/localization/copy/achievementCopy";
import type {YouTubeLocale} from "../../../../../src/gameplay/local/types";

const races: Readonly<Record<YouTubeLocale, {RaceTo10: Readonly<Record<string, string>>}>> = {en, es, pt, fr, de, ja, ko, hi, ru, tr, ar, id, it, nl, pl, vi};
/** Native hosted profiles also display race achievements earned by the same account. */
export function hostedAchievementText(locale: YouTubeLocale, key: string, fallback = key): string {
  return key.startsWith("RaceTo10.")
    ? races[locale].RaceTo10[key.slice("RaceTo10.".length)] ?? fallback : achievementText(locale, key, fallback);
}
