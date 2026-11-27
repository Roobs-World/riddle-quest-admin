import {type YouTubeLocale} from "../../../../../src/gameplay/local/types";
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

/** Existing translated race copy shared with the Jest game. */
const dictionaries = {en, es, pt, fr, de, ja, ko, hi, ru, tr, ar, id, it, nl, pl, vi} satisfies Record<YouTubeLocale, typeof en>;
/** Keys use the existing web translations, including category names. */
export type RaceCopyKey = keyof typeof en.RaceTo10;
/** Resolves one translated race string with bounded template substitution. */
export function raceText(locale: YouTubeLocale, key: RaceCopyKey, params: Readonly<Record<string, string | number>> = {}): string {
  return dictionaries[locale].RaceTo10[key].replace(/\{(\w+)\}/g, (token, name: string) => String(params[name] ?? token));
}
