import {trackJestFunnelEvent} from "../useJestPlatformOperations";

/** Represents an operation gate that permits telemetry. */
const openGate = {isOpen: () => true};

it("sanitizes attribution before sending a Jest funnel event", () => {
  /** Records the sanitized Jest event. */
  const captureEvent = jest.fn();

  trackJestFunnelEvent({
    gate: openGate,
    platform: {captureEvent},
    session: {
      entryIntent: {
        campaign: "friend_challenge_v2",
        reference: "invite",
        utmSource: "jest",
      },
    },
    eventName: "registration_prompt_shown",
    params: {source: "milestone", playerId: "must-not-leak"},
  });

  expect(captureEvent).toHaveBeenCalledWith("registration_prompt_shown", {
    campaign: "friend_challenge_v2",
    reference: "invite",
    source: "milestone",
    utm_source: "jest",
  });
});

it("does not send events after the deletion gate closes", () => {
  /** Records any unexpected post-deletion event. */
  const captureEvent = jest.fn();

  trackJestFunnelEvent({
    gate: {isOpen: () => false},
    platform: {captureEvent},
    session: null,
    eventName: "session_started",
  });

  expect(captureEvent).not.toHaveBeenCalled();
});

it("contains a synchronous Jest telemetry failure", () => {
  /** Simulates a synchronous platform telemetry failure. */
  const captureEvent = jest.fn(() => {
    throw new Error("jest-telemetry-unavailable");
  });

  expect(() => trackJestFunnelEvent({
    gate: openGate,
    platform: {captureEvent},
    session: null,
    eventName: "session_started",
  })).not.toThrow();
  expect(captureEvent).toHaveBeenCalledTimes(1);
});
