import {requestExpandedMode} from "@devvit/client";
import {readBrowserStorage} from "../platform/browserStorage";

/** Describes reddit copy. */
type RedditCopy = {
  /** Stores reddit platform. */
  /** Stores reddit platform. */
  RedditPlatform: {
    /** Stores tagline. */
    TAGLINE: string; /** Stores play. */
    /** Stores play. */
    PLAY: string;
  };
};
/** Provides catalogs behavior. */
const catalogs = import.meta.glob<RedditCopy>(
  "../../../../src/locales/{ar,de,en,es,fr,hi,id,it,ja,ko,nl,pl,pt,ru,tr,vi,zh}/redditPlatform.json",
  {import: "default"},
);
/** Provides supported behavior. */
const supported = new Set([
  "ar",
  "de",
  "en",
  "es",
  "fr",
  "hi",
  "id",
  "it",
  "ja",
  "ko",
  "nl",
  "pl",
  "pt",
  "ru",
  "tr",
  "vi",
  "zh",
]);
/** Requests ed. */
const requested = (readBrowserStorage("local", "appLanguage") ?? navigator.languages?.[0] ?? navigator.language ?? "en")
  .toLowerCase()
  .split("-")[0];
/** Provides locale behavior. */
const locale = requested === "in" ? "id" : supported.has(requested) ? requested : "en";
/** Provides catalog path behavior. */
const catalogPath = `../../../../src/locales/${locale}/redditPlatform.json`;
/** Loads catalog. */
const loadCatalog = catalogs[catalogPath];
/** Provides copy behavior. */
const copy = (await loadCatalog?.())?.RedditPlatform;
if (!copy) throw new Error(`Reddit inline locale is missing: ${locale}`);
document.documentElement.lang = locale;
document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
/** Provides tagline behavior. */
const tagline = document.querySelector<HTMLElement>("#tagline");
if (!tagline) throw new Error("Reddit inline tagline is missing");
tagline.textContent = copy.TAGLINE;

/** Provides play behavior. */
const play = document.querySelector<HTMLButtonElement>("#play");
if (!play) throw new Error("Reddit inline Play control is missing");
play.textContent = copy.PLAY;
play.addEventListener("click", (event) => requestExpandedMode(event, "game"));
