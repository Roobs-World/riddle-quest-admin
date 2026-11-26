import {detectDeviceLanguage, isSupportedLocale, LANGUAGE_OPTIONS} from "../i18n";

it("falls back to English for Chinese device languages and omits Chinese from language choices", () => {
  expect(isSupportedLocale("zh")).toBe(false);
  expect(LANGUAGE_OPTIONS.some((option) => String(option.code) === "zh")).toBe(false);
  for (const locale of ["zh", "zh-CN", "zh-TW", "zh-Hans", "zh-Hant"]) {
    expect(detectDeviceLanguage(locale)).toBe("en");
  }
});
