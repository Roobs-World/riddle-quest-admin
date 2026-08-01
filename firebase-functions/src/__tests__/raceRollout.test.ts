import {evaluateRaceRollout, hashRaceCohortUser} from "../race/raceRollout";

describe("Race rollout cohort evaluation", () => {
  it("defaults off for missing or malformed configuration", () => {
    expect(evaluateRaceRollout(undefined, "player-1")).toEqual({
      enabled: false,
      locale: "en",
      reason: "rollout_disabled",
    });
    expect(evaluateRaceRollout({enabled: "yes"}, "player-1").enabled).toBe(false);
  });

  it("supports a deterministic percentage cohort", () => {
    expect(evaluateRaceRollout({enabled: true, percentage: 100, allowlistHashes: []}, "player-1").enabled).toBe(true);
    expect(evaluateRaceRollout({enabled: true, percentage: 0, allowlistHashes: []}, "player-1")).toMatchObject({
      enabled: false,
      reason: "not_in_cohort",
    });
  });

  it("allows a hashed player override without storing the raw ID", () => {
    const hash = hashRaceCohortUser("player-1");
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(evaluateRaceRollout({enabled: true, percentage: 0, allowlistHashes: [hash]}, "player-1").enabled).toBe(true);
  });
});
