import {describe, expect, test} from "@jest/globals";
import {gateFacebookSessionCapabilities, parseFacebookAgeCategory, resolveFacebookCapabilityVisibility} from "../FacebookCapabilityPolicy";
import type {PlatformCapabilities} from "../../../../../src/web/platform/types";

describe("Facebook optional capability visibility", () => {
  test("removes context and matchmaking together when the authenticated server gate is closed", () => {
    /** SDK capabilities before authenticated server gating. */
    const capabilities: PlatformCapabilities = {
      nativeSocial: {currentContext: jest.fn(), chooseContext: jest.fn(), matchPlayer: jest.fn()},
      matchmaking: {find: jest.fn()},
      overlay: {renderPlayer: jest.fn()},
      lifecycle: {onPause: jest.fn()},
    };
    /** Capabilities with matchmaking disabled by server configuration. */
    const disabled = gateFacebookSessionCapabilities(capabilities, {matchmakingEnabled: false, configurationLoaded: true});
    expect(disabled.nativeSocial).toBeUndefined();
    expect(disabled.matchmaking).toBeUndefined();
    expect(disabled.overlay).toBe(capabilities.overlay);
    expect(disabled.lifecycle).toBe(capabilities.lifecycle);
    /** Capabilities after configuration loading fails. */
    const failed = gateFacebookSessionCapabilities(capabilities, {matchmakingEnabled: false, configurationLoaded: false});
    expect(failed.overlay).toBeUndefined();
    expect(failed.matchmaking).toBeUndefined();
    expect(gateFacebookSessionCapabilities(capabilities, {matchmakingEnabled: true, configurationLoaded: true})).toEqual(capabilities);
    expect(capabilities.matchmaking).toBeDefined();
  });
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
