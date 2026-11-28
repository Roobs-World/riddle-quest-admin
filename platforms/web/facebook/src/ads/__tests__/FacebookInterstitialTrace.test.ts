import {afterEach, beforeEach, describe, expect, it, jest} from "@jest/globals";
import {performance as timeline} from "node:perf_hooks";
import {createFacebookInterstitialTrace, recordFacebookInterstitialError, type FacebookInterstitialTracePhase} from "../FacebookInterstitialTrace";

const prefix = "riddle-quest:facebook:interstitial:";
const originalPerformance = Object.getOwnPropertyDescriptor(globalThis, "performance");
const capturedMarks = () => timeline.getEntriesByType("mark").filter(entry => entry.name.startsWith(prefix));
const allowedPhases: FacebookInterstitialTracePhase[] = [
  "completion", "incorrect", "cadence-one", "cadence-two", "opportunity", "admission", "account-inactive",
  "foreground-invalid", "disabled-after-bookkeeping-failure", "format-unavailable", "interstitial-busy", "rewarded-busy",
  "preparation-pending", "wrong-placement", "result-no-longer-current", "eligibility-initial", "eligibility-initial-resolved",
  "eligibility-after-load", "eligibility-after-load-resolved", "eligibility-denied", "ad-free-gate", "clock-invalid",
  "session-cap", "interstitial-cooldown", "rewarded-cooldown", "dialog-guard", "dialog-operation", "dialog-busy",
  "surface-not-hidden", "create-invoked", "create-resolved", "placement-before-load", "load-invoked", "load-resolved",
  "placement-before-show", "show-invoked", "show-resolved", "success", "cancelled", "unavailable", "retryable-failure",
  "terminal-failure", "finished", "retired", "provider-too-many-instances", "provider-unsupported-operation",
  "provider-frequent-load", "provider-no-fill", "provider-invalid-param", "provider-network-failure",
  "provider-not-loaded", "provider-invalid-operation", "provider-rate-limited", "provider-user-input",
];

beforeEach(() => {
  Object.defineProperty(globalThis, "performance", {configurable: true, value: timeline});
});

afterEach(() => {
  if (originalPerformance) Object.defineProperty(globalThis, "performance", originalPerformance);
  else Reflect.deleteProperty(globalThis, "performance");
  for (const entry of capturedMarks()) timeline.clearMarks(entry.name);
});

describe("Facebook interstitial trace", () => {
  it.each([
    ["ADS_TOO_MANY_INSTANCES", "provider-too-many-instances"],
    ["CLIENT_UNSUPPORTED_OPERATION", "provider-unsupported-operation"],
    ["ADS_FREQUENT_LOAD", "provider-frequent-load"], ["ADS_NO_FILL", "provider-no-fill"],
    ["INVALID_PARAM", "provider-invalid-param"], ["NETWORK_FAILURE", "provider-network-failure"],
    ["ADS_NOT_LOADED", "provider-not-loaded"], ["INVALID_OPERATION", "provider-invalid-operation"],
    ["RATE_LIMITED", "provider-rate-limited"], ["USER_INPUT", "provider-user-input"],
  ])("records only the fixed category for provider code %s", (code, phase) => {
    const lease = createFacebookInterstitialTrace().begin();
    recordFacebookInterstitialError(lease, {code, message: "private provider payload"});
    expect(capturedMarks().map(entry => ({name: entry.name, detail: entry.toJSON().detail}))).toEqual([
      {name: prefix + "completion", detail: null}, {name: prefix + phase, detail: null},
    ]);
  });

  it("ignores unknown codes, accessor properties and inspection failures without calling getters", () => {
    const lease = createFacebookInterstitialTrace().begin();
    const codeGetter = jest.fn(() => {throw new Error("private provider payload");});
    const accessor = Object.defineProperty({}, "code", {get: codeGetter});
    const inspectionFailure = new Proxy({}, {getOwnPropertyDescriptor: () => {throw new Error("uninspectable");}});
    for (const error of [undefined, null, "ADS_NO_FILL", {code: "private code"}, {code: "__proto__"},
      {code: {toString: codeGetter}}, Object.create({code: "ADS_NO_FILL"}), accessor, inspectionFailure]) {
      expect(() => recordFacebookInterstitialError(lease, error)).not.toThrow();
    }
    expect(codeGetter).not.toHaveBeenCalled();
    expect(capturedMarks().map(entry => entry.name)).toEqual([prefix + "completion"]);
  });

  it("starts each completion capture and retains its readback after close without clearing foreign marks", () => {
    const foreign = timeline.mark(prefix + "foreign-owner");
    const coordinator = createFacebookInterstitialTrace();
    const first = coordinator.begin();
    first.record("opportunity");
    const latest = coordinator.begin();
    latest.record("cadence-one");
    latest.close();

    expect(capturedMarks().map(entry => ({name: entry.name, detail: entry.toJSON().detail}))).toEqual([
      {name: "riddle-quest:facebook:interstitial:foreign-owner", detail: null},
      {name: "riddle-quest:facebook:interstitial:completion", detail: null},
      {name: "riddle-quest:facebook:interstitial:cadence-one", detail: null},
    ]);
    expect(timeline.getEntriesByName(prefix + "foreign-owner")).toEqual([foreign]);
  });

  it("captures an immutable operation lease and isolates a newer visit from stale callbacks or retirement", () => {
    const firstVisit = createFacebookInterstitialTrace();
    expect(firstVisit.capture()).toBeUndefined();
    const first = firstVisit.begin();
    const captured = firstVisit.capture();
    expect(captured).toBe(first);
    const second = firstVisit.begin();
    second.record("admission");
    captured?.record("success");
    captured?.close();
    expect(firstVisit.capture()).toBe(second);

    const nextVisit = createFacebookInterstitialTrace();
    const latest = nextVisit.begin();
    latest.record("dialog-guard");
    expect(firstVisit.capture()).toBeUndefined();
    firstVisit.retire();
    firstVisit.retire();
    firstVisit.begin().record("success");
    second.record("cancelled");
    second.close();
    expect(nextVisit.capture()).toBe(latest);
    latest.record("finished");
    latest.close();
    latest.record("retired");

    expect(nextVisit.capture()).toBeUndefined();
    expect(capturedMarks().map(entry => entry.name)).toEqual([
      "riddle-quest:facebook:interstitial:completion",
      "riddle-quest:facebook:interstitial:dialog-guard",
      "riddle-quest:facebook:interstitial:finished",
    ]);
  });

  it("bounds repeated captures to one payload-free mark per allowed phase", () => {
    const foreign = timeline.mark(prefix + "foreign-owner");
    const coordinator = createFacebookInterstitialTrace();
    for (let capture = 0; capture < 20; capture++) {
      const lease = coordinator.begin();
      for (let repeat = 0; repeat < 10; repeat++) {
        for (const phase of allowedPhases) lease.record(phase);
      }
      lease.close();
      const marks = capturedMarks().filter(entry => entry.name !== foreign.name);
      expect(marks.map(entry => entry.name)).toEqual(allowedPhases.map(phase => prefix + phase));
      expect(marks.every(entry => entry.toJSON().detail === null)).toBe(true);
    }
    expect(timeline.getEntriesByName(foreign.name)).toEqual([foreign]);
  });

  it("retires its active capture once and prevents that visit from starting again", () => {
    const coordinator = createFacebookInterstitialTrace();
    const lease = coordinator.begin();
    coordinator.retire();
    const terminal = capturedMarks();

    coordinator.retire();
    lease.record("success");
    lease.close();
    coordinator.begin().record("admission");
    expect(coordinator.capture()).toBeUndefined();
    expect(capturedMarks()).toEqual(terminal);
    expect(terminal.map(entry => entry.name)).toEqual([
      "riddle-quest:facebook:interstitial:completion",
      "riddle-quest:facebook:interstitial:retired",
    ]);
  });

  it("discards unknown phases without converting caller values into mark names", () => {
    const lease = createFacebookInterstitialTrace().begin();
    const completion = capturedMarks();
    const unknownPhases: unknown[] = ["account:private-id", "__proto__", "constructor", "", undefined, null, 1,
      Symbol("private-id"), {toString: () => {throw new Error("Must not coerce caller payload");}}];
    expect(() => {
      for (const phase of unknownPhases) lease.record(phase as FacebookInterstitialTracePhase);
    }).not.toThrow();
    expect(capturedMarks()).toEqual(completion);
  });

  it.each(["absent", "undefined", "empty", "getter-throws"])("allows the visit to finish when Performance is %s", condition => {
    if (condition === "absent") Reflect.deleteProperty(globalThis, "performance");
    else if (condition === "getter-throws") {
      Object.defineProperty(globalThis, "performance", {configurable: true, get: () => {throw new Error("Performance unavailable");}});
    } else {
      Object.defineProperty(globalThis, "performance", {configurable: true, value: condition === "empty" ? {} : undefined});
    }
    expect(() => {
      const coordinator = createFacebookInterstitialTrace();
      const lease = coordinator.begin();
      lease.record("admission");
      coordinator.capture()?.record("finished");
      lease.close();
      coordinator.retire();
      coordinator.begin().close();
    }).not.toThrow();
    expect(capturedMarks()).toEqual([]);
  });

  it.each([
    ["clearMarks", "throws"], ["clearMarks", "getter-throws"], ["clearMarks", "missing"],
    ["mark", "throws"], ["mark", "getter-throws"], ["mark", "missing"],
  ] as const)("does not change control flow when %s %s during a capture", (method, failure) => {
    const api = {
      clearMarks: (name: string) => timeline.clearMarks(name),
      mark: (name: string) => timeline.mark(name),
    };
    Object.defineProperty(globalThis, "performance", {configurable: true, value: api});
    const coordinator = createFacebookInterstitialTrace();
    const lease = coordinator.begin();
    const workingMethod = Object.getOwnPropertyDescriptor(api, method)!;
    const throwFailure = () => {throw new Error("User Timing failure");};
    Object.defineProperty(api, method, failure === "getter-throws"
      ? {configurable: true, get: throwFailure}
      : {configurable: true, value: failure === "missing" ? undefined : throwFailure});

    expect(() => {
      lease.record("admission");
      lease.record("completion");
      coordinator.capture()?.record("show-invoked");
    }).not.toThrow();
    Object.defineProperty(api, method, workingMethod);
    lease.record("finished");
    lease.close();
    expect(capturedMarks().map(entry => entry.name)).toEqual(method === "clearMarks"
      ? ["riddle-quest:facebook:interstitial:completion", "riddle-quest:facebook:interstitial:finished"]
      : ["riddle-quest:facebook:interstitial:finished"]);
  });

  it.each(["call", "getter"])("invalidates old leases even when initial cleanup fails in its %s", failure => {
    const oldVisit = createFacebookInterstitialTrace();
    const old = oldVisit.begin();
    old.record("finished");
    const retained = capturedMarks().filter(entry => entry.name.endsWith(":finished"));
    let blocked = true;
    Object.defineProperty(globalThis, "performance", {configurable: true, value: {
      get clearMarks() {
        if (blocked && failure === "getter") throw new Error("Cleanup getter failed");
        return (name: string) => {
          if (blocked && name === prefix + "opportunity") throw new Error("Cleanup failed");
          timeline.clearMarks(name);
        };
      },
      mark: (name: string) => timeline.mark(name),
    }});

    const nextVisit = createFacebookInterstitialTrace();
    const failed = nextVisit.begin();
    blocked = false;
    failed.record("success");
    old.record("admission");
    oldVisit.retire();
    expect(nextVisit.capture()).toBeUndefined();
    expect(capturedMarks()).toEqual(failure === "getter"
      ? [expect.objectContaining({name: prefix + "completion"}), ...retained] : retained);

    const latest = nextVisit.begin();
    latest.record("success");
    latest.close();
    expect(capturedMarks().map(entry => entry.name)).toEqual([
      "riddle-quest:facebook:interstitial:completion",
      "riddle-quest:facebook:interstitial:success",
    ]);
  });
});
