import {describe, expect, it} from "@jest/globals";
import {renderToString} from "react-dom/server";
import {LIVE_RACE_COUNTDOWN_MS, LIVE_RACE_WAIT_MS} from "../../../../core/race";
import {LiveRaceSearchWheel} from "../components/LiveRaceSearchWheel";

/** Reads the progress percentage rendered for one authoritative search deadline. */
const progressAt = (elapsedMs: number, windowMs = LIVE_RACE_WAIT_MS, starting = false): number => {
  /** Deadline returned by the server for a seat created at time zero. */
  const endsAtMs = windowMs;
  /** Rendered markup exposes the ring fill through its accessible progress value. */
  const markup = renderToString(<LiveRaceSearchWheel endsAtMs={endsAtMs} now={elapsedMs} starting={starting} />);
  return Number(/aria-valuenow="(\d+)"/.exec(markup)?.[1]);
};

describe("live race opponent search", () => {
  it("falls back to a bot opponent within seconds so a match always starts quickly", () => {
    // Platform review requires a quick match; the search window plus countdown must stay well under ten seconds.
    expect(LIVE_RACE_WAIT_MS).toBeLessThanOrEqual(6_000);
    expect(LIVE_RACE_WAIT_MS + LIVE_RACE_COUNTDOWN_MS).toBeLessThanOrEqual(11_000);
  });

  it("fills the search ring across the short authoritative bot-fallback window", () => {
    expect(progressAt(0)).toBe(0);
    expect(progressAt(LIVE_RACE_WAIT_MS / 2)).toBe(50);
    expect(progressAt(LIVE_RACE_WAIT_MS)).toBe(100);
    // Late polls never overfill the ring while the server seats the bot.
    expect(progressAt(LIVE_RACE_WAIT_MS * 2)).toBe(100);
  });

  it("keeps the shared countdown on its own five-second interval", () => {
    expect(progressAt(LIVE_RACE_COUNTDOWN_MS / 2, LIVE_RACE_COUNTDOWN_MS, true)).toBe(50);
  });
});
