import {liveRacePollInterval} from "../logic/liveRacePolling";
import type {LiveRaceView} from "@riddle-quest/core/race";

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
  it("observes the short public bot-fallback deadline every second even with healthy push", () => {
    /** Resumable public searches must not inherit the private invitation watchdog. */
    const view = {phase: "searching" satisfies LiveRaceView["phase"], opponent: null, waitForPlayer: true};
    expect(liveRacePollInterval(view, true, true)).toBe(1000);
    expect(liveRacePollInterval(view, true, false)).toBe(1000);
    expect(liveRacePollInterval(view, false, true)).toBe(1000);
  });
  it("keeps the slower healthy-push watchdog for private friend invitations", () => {
    /** Private invitations retain their independent waiting lifetime. */
    const view = {phase: "searching" satisfies LiveRaceView["phase"], opponent: null, challengeId: "a".repeat(64)};
    expect(liveRacePollInterval(view, true, true)).toBe(4000);
    expect(liveRacePollInterval(view, true, false)).toBe(1000);
    expect(liveRacePollInterval(view, false, true)).toBe(1000);
  });
  it("preserves legacy fallback and countdown deadlines with healthy push", () => {
    expect(liveRacePollInterval({phase: "searching", opponent: null}, true, true)).toBe(1000);
    expect(liveRacePollInterval({phase: "countdown", opponent: human, waitForPlayer: true}, true, true)).toBe(1000);
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
