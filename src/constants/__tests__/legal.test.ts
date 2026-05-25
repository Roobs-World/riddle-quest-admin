import {getLegalUrl, getLegalUrls, SUPPORTED_LEGAL_LANGUAGES} from "../legal";

describe("legal URL helpers", () => {
  const expectedPaths = {
    website: "",
    privacyPolicy: "/privacy-policy",
    termsOfUse: "/terms-of-use",
    accountDeletion: "/account-deletion",
    dataExport: "/data-export",
    thirdPartyLicenses: "/third-party-licenses",
    support: "/support",
  } as const;

  it.each(SUPPORTED_LEGAL_LANGUAGES)("builds localized legal URLs for %s", (language) => {
    Object.entries(expectedPaths).forEach(([key, suffix]) => {
      expect(getLegalUrl(key as keyof typeof expectedPaths, language)).toBe(
        `https://www.roobsworld.com/riddle-quest/${language}${suffix}`,
      );
    });
  });

  it("returns the full URL map for a language", () => {
    expect(getLegalUrls("fr")).toEqual({
      website: "https://www.roobsworld.com/riddle-quest/fr",
      privacyPolicy: "https://www.roobsworld.com/riddle-quest/fr/privacy-policy",
      termsOfUse: "https://www.roobsworld.com/riddle-quest/fr/terms-of-use",
      accountDeletion: "https://www.roobsworld.com/riddle-quest/fr/account-deletion",
      dataExport: "https://www.roobsworld.com/riddle-quest/fr/data-export",
      thirdPartyLicenses: "https://www.roobsworld.com/riddle-quest/fr/third-party-licenses",
      support: "https://www.roobsworld.com/riddle-quest/fr/support",
    });
  });
});
