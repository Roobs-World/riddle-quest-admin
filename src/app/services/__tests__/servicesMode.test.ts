import {hasTrustedTestHarnessMarker, shouldUseFakeHostServices} from "../../testing/testHarness";

describe("host service trust boundary", () => {
  /** Provides original window behavior. */
  const originalWindow = globalThis.window;

  afterEach(() => {
    Object.defineProperty(globalThis, "window", {configurable: true, value: originalWindow});
  });

  it("requires a marker supplied by the browser test host", () => {
    Object.defineProperty(globalThis, "window", {configurable: true, value: undefined});
    expect(hasTrustedTestHarnessMarker()).toBe(false);

    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {__RIDDLE_QUEST_BROWSER_TEST__: true},
    });
    expect(hasTrustedTestHarnessMarker()).toBe(true);

    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {__RIDDLE_QUEST_JEST_AUTH_TEST__: false},
    });
    expect(hasTrustedTestHarnessMarker()).toBe(true);

    Object.defineProperty(globalThis, "window", {configurable: true, value: {}});
    expect(hasTrustedTestHarnessMarker()).toBe(false);
  });

  it("does not let production URL parameters select fake multiplayer services", () => {
    for (const harness of ["jest", "jest-auth", "race", "race-auth", "dev"]) {
      expect(
        shouldUseFakeHostServices({
          search: `?harness=${harness}`,
          development: false,
          testHarnessEnabled: false,
        }),
      ).toBe(false);
    }
  });

  it("allows fake services only in development or an explicitly marked browser test", () => {
    expect(shouldUseFakeHostServices({search: "?harness=race", development: true, testHarnessEnabled: false})).toBe(
      true,
    );
    expect(shouldUseFakeHostServices({search: "?harness=race", development: false, testHarnessEnabled: true})).toBe(
      true,
    );
    expect(shouldUseFakeHostServices({search: "", development: false, testHarnessEnabled: true})).toBe(false);
    expect(shouldUseFakeHostServices({search: "?harness=unknown", development: false, testHarnessEnabled: true})).toBe(
      false,
    );
  });
});
