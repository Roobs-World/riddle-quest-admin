import {liveRacePollInterval} from "../logic/liveRacePolling";
import type {LiveRaceView} from "@qwordly/core/race";

/** Minimal participant projection keeps scheduling tests independent of game content. */
const human = {displayName: "Rival", avatarUrl: null, bot: false, correctCount: 0};

describe("live race observation cadence", () => {
  it("halves the maximum foreground wait for a human rival update", () => {
    expect(liveRacePollInterval({phase: "racing", opponent: human}, true)).toBe(500);
  });
  it.each(["searching", "countdown", "result", "cancelled"] as const)("retains the existing cadence during %s", phase => {
    expect(liveRacePollInterval({phase, opponent: human}, true)).toBe(1000);
  });
  it.each([null, {...human, bot: true}])("keeps solo/bot observations at the existing rate: %p", opponent => {
    expect(liveRacePollInterval({phase: "racing", opponent}, true)).toBe(1000);
  });
  it("uses a five-second reconciliation watchdog when push is connected", () => {
    expect(liveRacePollInterval({phase: "racing", opponent: human}, true, true)).toBe(5000);
    expect(liveRacePollInterval({phase: "racing", opponent: human}, true, false)).toBe(500);
  });
  it("keeps timed settlements fast after either player finishes", () => {
    expect(liveRacePollInterval({phase: "racing", opponent: {...human, correctCount: 10}}, true, true)).toBe(500);
  });
  it("does not accelerate background frames or an unconfirmed join", () => {
    expect(liveRacePollInterval({phase: "racing", opponent: human}, false)).toBe(1000);
    expect(liveRacePollInterval(null, true)).toBe(1000);
  });
  it("keeps every phase bounded while the frame is hidden", () => {
    for (const phase of ["searching", "countdown", "racing", "result", "cancelled"] satisfies LiveRaceView["phase"][]) {
      expect(liveRacePollInterval({phase, opponent: human}, false)).toBe(1000);
    }
  });
});
