import {isRaceHarness, isRaceTo10Enabled} from "../logic/raceFeatureFlag";

describe("Race to 10 feature flag", () => {
  it("defaults off, including for generic development harnesses", () => {
    expect(isRaceTo10Enabled()).toBe(false);
    expect(isRaceTo10Enabled({search: "?harness=jest"})).toBe(false);
    expect(isRaceTo10Enabled({search: "?harness=dev"})).toBe(false);
  });

  it("enables the deterministic race harness", () => {
    expect(isRaceTo10Enabled({search: "?harness=race", testHarnessEnabled: true})).toBe(true);
    expect(isRaceHarness("?harness=race", true)).toBe(true);
    expect(isRaceTo10Enabled({search: "?harness=race-auth", testHarnessEnabled: true})).toBe(true);
    expect(isRaceHarness("?harness=race-auth", true)).toBe(true);
  });

  it("does not let a production URL enable race test mechanics", () => {
    expect(isRaceTo10Enabled({search: "?harness=race", testHarnessEnabled: false})).toBe(false);
    expect(isRaceHarness("?harness=race-auth", false)).toBe(false);
  });

  it("allows an explicit production build flag", () => {
    expect(isRaceTo10Enabled({envValue: "1"})).toBe(true);
    expect(isRaceTo10Enabled({envValue: "0"})).toBe(false);
  });
});
