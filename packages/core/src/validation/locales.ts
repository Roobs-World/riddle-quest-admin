/** Defines the supported locales value. */
export const SUPPORTED_LOCALES = [
  "en",
  "es",
  "pt",
  "fr",
  "de",
  "ja",
  "ko",
  "hi",
  "ru",
  "tr",
  "ar",
  "id",
  "it",
  "nl",
  "pl",
  "vi",
] as const;

/** Describes supported locale. */
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];
