export const SUPPORTED_LOCALES = [
  "en",
  "es",
  "pt",
  "fr",
  "de",
  "ja",
  "ko",
  "zh",
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

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];
