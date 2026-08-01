import {isRaceHarness, isRaceTo10Enabled} from "../raceFeatureFlag";

describe("Race to 10 feature flag", () => {
  it("defaults off, including for generic development harnesses", () => {
    expect(isRaceTo10Enabled()).toBe(false);
    expect(isRaceTo10Enabled({search: "?harness=jest"})).toBe(false);
    expect(isRaceTo10Enabled({search: "?harness=dev"})).toBe(false);
  });

  it("enables the deterministic race harness", () => {
    expect(isRaceTo10Enabled({search: "?harness=race"})).toBe(true);
    expect(isRaceHarness("?harness=race")).toBe(true);
    expect(isRaceTo10Enabled({search: "?harness=race-auth"})).toBe(true);
    expect(isRaceHarness("?harness=race-auth")).toBe(true);
  });

  it("allows an explicit production build flag", () => {
    expect(isRaceTo10Enabled({envValue: "1"})).toBe(true);
    expect(isRaceTo10Enabled({envValue: "0"})).toBe(false);
  });
});
