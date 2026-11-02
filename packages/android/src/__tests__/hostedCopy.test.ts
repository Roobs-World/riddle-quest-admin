import {describe, expect, it} from "@jest/globals";
import {YOUTUBE_COPY} from "@qwordly/solo";
import {HOSTED_COPY, hostedText, translateHostCopy, type HostedCopyKey} from "../i18n/hostedCopy";

/** Every hosted key, taken from the English table so a key added to the type but not the table fails here. */
const keys = Object.keys(HOSTED_COPY.en) as HostedCopyKey[];

describe("hosted copy", () => {
  it("covers every locale the shared solo tables support with the same keys", () => {
    for (const locale of Object.keys(YOUTUBE_COPY) as (keyof typeof YOUTUBE_COPY)[]) {
      /** This locale's table. */
      const table = HOSTED_COPY[locale];
      expect(Object.keys(table).sort()).toEqual([...keys].sort());
      for (const key of keys) expect(table[key].trim().length).toBeGreaterThan(0);
    }
  });

  it("differs from English in every translated locale for the connectivity strings", () => {
    for (const locale of Object.keys(HOSTED_COPY) as (keyof typeof HOSTED_COPY)[]) {
      if (locale === "en") continue;
      expect(hostedText(locale, "connecting")).not.toBe(hostedText("en", "connecting"));
      expect(hostedText(locale, "accountIntro")).not.toBe(hostedText("en", "accountIntro"));
    }
  });

  it("maps the host-service messages the shared services raise and exposes unknown keys verbatim", () => {
    expect(translateHostCopy("es", "ErrorMessages.UNABLE_TO_LOAD_RIDDLES")).toBe(hostedText("es", "riddlesLoadFailed"));
    expect(translateHostCopy("en", "ErrorMessages.SERVICE_TEMPORARILY_UNAVAILABLE")).toBe(hostedText("en", "serviceUnavailable"));
    expect(translateHostCopy("en", "ErrorMessages.SOMETHING_NEW")).toBe("ErrorMessages.SOMETHING_NEW");
  });
});
