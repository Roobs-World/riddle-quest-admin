import {reconcilePresenceOptIn} from "../reconcilePresenceOptIn";

/** Provides harness behavior. */
const harness = () => ({
  start: jest.fn(async () => undefined),
  stop: jest.fn(async () => undefined),
  setConsent: jest.fn(async () => undefined),
});

it("starts an enabled visible session without touching account-wide opt-out", async () => {
  /** Provides value behavior. */
  const value = harness();
  await reconcilePresenceOptIn({enabled: true, canStart: true, ...value});
  expect(value.start).toHaveBeenCalledTimes(1);
  expect(value.stop).not.toHaveBeenCalled();
  expect(value.setConsent).toHaveBeenCalledWith(true);
});

it("keeps an enabled hidden session dormant without disabling sibling sessions", async () => {
  /** Provides value behavior. */
  const value = harness();
  await reconcilePresenceOptIn({enabled: true, canStart: false, ...value});
  expect(value.start).not.toHaveBeenCalled();
  expect(value.stop).not.toHaveBeenCalled();
  expect(value.setConsent).toHaveBeenCalledWith(true);
});

it("stops locally before atomically disabling every sibling session", async () => {
  /** Provides events behavior. */
  const events: string[] = [];
  await reconcilePresenceOptIn({
    enabled: false,
    canStart: true,
    start: async () => {
      events.push("start");
    },
    stop: async () => {
      events.push("stop");
    },
    setConsent: async (enabled) => {
      events.push(`consent:${enabled}`);
    },
  });
  expect(events).toEqual(["stop", "consent:false"]);
});
