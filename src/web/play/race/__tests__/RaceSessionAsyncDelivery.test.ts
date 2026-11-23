import {describe, expect, it} from "@jest/globals";
import {catalog, fixture, harness} from "./raceSession.support";

/** Controlled rejection remains handled even against the old adapter, preventing process-level test noise. */
const deferred = () => {
  /** Rejects the delayed transport operation. */
  let reject!: (reason: Error) => void;
  /** Original delivery promise consumed by the production transport. */
  const promise = new Promise<void>((_resolve, fail) => {reject = fail;});
  void promise.catch(() => {});
  return {promise, reject};
};
/** Advances promise observers without advancing the response timeout clock. */
const settle = async () => {await Promise.resolve(); await Promise.resolve();};

describe("Race Session asynchronous transport ownership", () => {
  it("rejects a still-owned asynchronous start delivery and retains its exact retry receipt", async () => {
    /** Failure arrives after the adapter returned to the caller. */
    const delivery = deferred();
    /** Only start delivery uses the asynchronous transport in this fixture. */
    const h = harness({}, null, {postToHost: message => message.type === "game:startRace" ? delivery.promise : undefined});
    h.respond("raceCategories", await catalog()); h.session.begin("mixed");
    /** Retry must use this original receipt rather than mint another mutation. */
    const original = h.last(); delivery.reject(new Error("bridge offline")); await settle();
    expect(h.session.getSnapshot()).toMatchObject({pending: null, stage: "categories", run: null, error: "RaceTo10.ERROR_GENERIC"});
    expect(h.timers.size).toBe(0);
    h.session.retry(); expect(h.last()).toMatchObject({requestId: original.requestId, payload: original.payload});
  });
  it("ignores a rejection after synchronous confirmation installed its successor command", async () => {
    /** The adapter confirms successfully before its unrelated trailing promise rejects. */
    const delivery = deferred(), run = await fixture(true);
    /** Callback is invoked only after the assigned harness starts its mutation. */
    let h: ReturnType<typeof harness>;
    h = harness({}, null, {postToHost: message => {
      if (message.type !== "game:startRace") return;
      h.respond("raceStart", {run}, message); return delivery.promise;
    }});
    h.respond("raceCategories", await catalog()); h.session.begin("mixed");
    delivery.reject(new Error("late rejection")); await settle();
    expect(h.session.getSnapshot()).toMatchObject({pending: "raceReady", run, error: null});
    expect(h.timers.size).toBe(1);
  });
  it("ignores a delayed rejection after the session is disposed", async () => {
    /** Teardown invalidates the original transport lifetime. */
    const delivery = deferred();
    /** Pending host delivery outlives its disposed session. */
    const h = harness({}, null, {postToHost: message => message.type === "game:startRace" ? delivery.promise : undefined});
    h.respond("raceCategories", await catalog()); h.session.begin("mixed"); h.session.dispose();
    delivery.reject(new Error("late rejection")); await settle();
    expect(h.session.getSnapshot().error).toBeNull(); expect(h.timers.size).toBe(0);
  });
  it("ignores an old rejection when a newer delivery reuses the same mutation ID", async () => {
    /** Original promise can reject after a correlated host failure has already enabled retry. */
    const old = deferred(), retry = deferred();
    /** Only the first transport attempt returns the old promise. */
    let attempts = 0;
    /** Explicit retry owns a separate delivery despite its shared server receipt. */
    const h = harness({}, null, {postToHost: message => {
      if (message.type === "game:startRace") return ++attempts === 1 ? old.promise : retry.promise;
    }});
    h.respond("raceCategories", await catalog()); h.session.begin("mixed");
    /** Correlated host rejection is independent from the still-unsettled adapter promise. */
    const original = h.last(); h.reject("raceStart", "offline"); h.session.retry();
    old.reject(new Error("late old promise")); await settle();
    expect(h.last().requestId).toBe(original.requestId);
    expect(h.session.getSnapshot()).toMatchObject({pending: "raceStart", error: null});
    expect(h.timers.size).toBe(1); h.session.dispose();
  });
});
