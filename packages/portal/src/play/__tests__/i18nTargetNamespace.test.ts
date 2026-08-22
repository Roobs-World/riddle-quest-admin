jest.mock("../../test/localeModulesMock", () => ({
  loadNonEnglishNamespace: jest.fn(async () => ({})),
}));

import {registerTargetLocaleNamespace, setLocale, tr} from "../i18n";

const settleLocaleLoad = async (): Promise<void> => {
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
};

it("loads target-owned copy only after the target registers its namespace", async () => {
  const load = jest.fn(async (locale: string) => ({
    RedditPlatform: {TAGLINE: `${locale} target copy`},
  }));
  registerTargetLocaleNamespace({
    namespace: "redditPlatform",
    english: {RedditPlatform: {TAGLINE: "en target copy"}},
    load,
  });

  expect(tr("RedditPlatform.TAGLINE")).toBe("en target copy");
  setLocale("de");
  await settleLocaleLoad();

  expect(load).toHaveBeenCalledWith("de");
  expect(tr("RedditPlatform.TAGLINE")).toBe("de target copy");
});
