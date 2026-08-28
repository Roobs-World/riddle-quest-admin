import {describe, expect, test} from "@jest/globals";
import {parseFacebookAgeCategory, resolveFacebookCapabilityVisibility} from "../FacebookCapabilityPolicy";

describe("Facebook optional capability visibility", () => {
  test("parses only an explicit verified 13+ category", () => {
    expect(parseFacebookAgeCategory("13_plus")).toBe("13_plus");
    expect(parseFacebookAgeCategory("unknown")).toBe("unknown");
    expect(parseFacebookAgeCategory(undefined)).toBe("unknown");
  });
  test("hides every optional capability for an unknown age category while preserving play", () => {
    expect(
      resolveFacebookCapabilityVisibility({
        ageCategory: "unknown",
        available: {commerce: true, ads: true, notifications: true, nativeSocial: true},
      }),
    ).toEqual({corePlay: true, commerce: false, ads: false, notifications: false, nativeSocial: false});
  });

  test("exposes only independently supported APIs for a known 13+ player", () => {
    expect(
      resolveFacebookCapabilityVisibility({
        ageCategory: "13_plus",
        available: {commerce: true, ads: false, notifications: true, nativeSocial: false},
      }),
    ).toEqual({corePlay: true, commerce: true, ads: false, notifications: true, nativeSocial: false});
  });

  test.each(["commerce", "ads", "notifications", "nativeSocial"] as const)(
    "does not let unsupported %s disable another feature or core play",
    (feature) => {
      /** Provides available behavior. */
      const available = {commerce: true, ads: true, notifications: true, nativeSocial: true};
      available[feature] = false;
      /** Provides result behavior. */
      const result = resolveFacebookCapabilityVisibility({ageCategory: "13_plus", available});
      expect(result[feature]).toBe(false);
      expect(result.corePlay).toBe(true);
      expect(
        Object.entries(result)
          .filter(([name]) => name !== feature && name !== "corePlay")
          .every(([, enabled]) => enabled),
      ).toBe(true);
    },
  );
});
