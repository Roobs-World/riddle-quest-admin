import type {YouTubeLocale} from "../../../../../src/solo";
import en from "../../../../../src/locales/en/profile.json";
import es from "../../../../../src/locales/es/profile.json";
import pt from "../../../../../src/locales/pt/profile.json";
import fr from "../../../../../src/locales/fr/profile.json";
import de from "../../../../../src/locales/de/profile.json";
import ja from "../../../../../src/locales/ja/profile.json";
import ko from "../../../../../src/locales/ko/profile.json";
import hi from "../../../../../src/locales/hi/profile.json";
import ru from "../../../../../src/locales/ru/profile.json";
import tr from "../../../../../src/locales/tr/profile.json";
import ar from "../../../../../src/locales/ar/profile.json";
import id from "../../../../../src/locales/id/profile.json";
import it from "../../../../../src/locales/it/profile.json";
import nl from "../../../../../src/locales/nl/profile.json";
import pl from "../../../../../src/locales/pl/profile.json";
import vi from "../../../../../src/locales/vi/profile.json";

/** Existing translated profile strings shared with the Jest game. */
const dictionaries = {en, es, pt, fr, de, ja, ko, hi, ru, tr, ar, id, it, nl, pl, vi} satisfies Record<YouTubeLocale, typeof en>;
/** Avatar controls reuse the corresponding web profile translations. */
export type AvatarCopyKey = "UPLOAD_FROM_LIBRARY_BUTTON" | "ALERT_AVATAR_SELECT_FAIL" | "ALERT_AVATAR_UPDATE_ERROR" | "ALERT_AVATAR_UPDATE_SUCCESS";
/** Resolves avatar text for every supported content language. */
export const avatarText = (locale: YouTubeLocale, key: AvatarCopyKey): string => dictionaries[locale].Profile[key];
