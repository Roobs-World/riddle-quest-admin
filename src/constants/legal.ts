import type {SupportedLanguage} from "../i18n";

const LEGAL_BASE_URL = "https://www.roobsworld.com";

const LEGAL_PATHS = {
  website: "",
  privacyPolicy: "privacy-policy",
  termsOfUse: "terms-of-use",
  accountDeletion: "account-deletion",
  dataExport: "data-export",
  thirdPartyLicenses: "third-party-licenses",
  support: "support",
} as const;

export type LegalUrlKey = keyof typeof LEGAL_PATHS;

export const SUPPORTED_LEGAL_LANGUAGES: ReadonlyArray<SupportedLanguage> = [
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
];

export const getLegalUrl = (key: LegalUrlKey, language: SupportedLanguage): string => {
  const legalLanguage = SUPPORTED_LEGAL_LANGUAGES.includes(language) ? language : "en";
  const path = LEGAL_PATHS[key];
  const localizedBase = `${LEGAL_BASE_URL}/riddle-quest/${legalLanguage}`;

  return path ? `${localizedBase}/${path}` : localizedBase;
};

export const getLegalUrls = (language: SupportedLanguage): Record<LegalUrlKey, string> => ({
  website: getLegalUrl("website", language),
  privacyPolicy: getLegalUrl("privacyPolicy", language),
  termsOfUse: getLegalUrl("termsOfUse", language),
  accountDeletion: getLegalUrl("accountDeletion", language),
  dataExport: getLegalUrl("dataExport", language),
  thirdPartyLicenses: getLegalUrl("thirdPartyLicenses", language),
  support: getLegalUrl("support", language),
});
