import {shouldUseFakeHostServices} from "../../testHarness";

describe("host service trust boundary", () => {
  it("does not let production URL parameters select fake multiplayer services", () => {
    for (const harness of ["jest", "jest-auth", "race", "race-auth", "dev"]) {
      expect(shouldUseFakeHostServices({
        search: `?harness=${harness}`,
        development: false,
        testHarnessEnabled: false,
      })).toBe(false);
    }
  });

  it("allows fake services only in development or an explicitly marked browser test", () => {
    expect(shouldUseFakeHostServices({search: "?harness=race", development: true, testHarnessEnabled: false})).toBe(true);
    expect(shouldUseFakeHostServices({search: "?harness=race", development: false, testHarnessEnabled: true})).toBe(true);
  });
});
