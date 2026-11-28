import {afterEach, beforeEach, describe, expect, it} from "@jest/globals";
import {performance as timeline} from "node:perf_hooks";
import {beginFacebookQuitTrace, type FacebookQuitTracePhase} from "../FacebookQuitTrace";

const prefix = "riddle-quest:facebook:quit:";
const phases: FacebookQuitTracePhase[] = [
  "guard", "operation", "preparation", "previous-preparation", "projection", "presence", "invoke", "returned", "finished", "retired",
];
const foreignName = prefix + "foreign-owner";
const originalPerformance = Object.getOwnPropertyDescriptor(globalThis, "performance");
const capturedMarks = () => timeline.getEntriesByType("mark").filter(entry => entry.name.startsWith(prefix));

beforeEach(() => {
  Object.defineProperty(globalThis, "performance", {configurable: true, value: timeline});
});

afterEach(() => {
  if (originalPerformance) Object.defineProperty(globalThis, "performance", originalPerformance);
  else Reflect.deleteProperty(globalThis, "performance");
  for (const mark of capturedMarks()) timeline.clearMarks(mark.name);
});

describe("Facebook Quit trace", () => {
  it("keeps a bounded latest capture with no payload and preserves foreign marks", () => {
    const foreign = timeline.mark(foreignName);
    for (let capture = 0; capture < 20; capture++) {
      const trace = beginFacebookQuitTrace();
      for (let repeat = 0; repeat < 10; repeat++) {
        for (const phase of phases) trace.record(phase);
      }
      trace.close();
      expect(capturedMarks().filter(entry => entry.name !== foreignName).map(entry => ({name: entry.name, detail: entry.toJSON().detail}))).toEqual([
        {name: "riddle-quest:facebook:quit:guard", detail: null},
        {name: "riddle-quest:facebook:quit:operation", detail: null},
        {name: "riddle-quest:facebook:quit:preparation", detail: null},
        {name: "riddle-quest:facebook:quit:previous-preparation", detail: null},
        {name: "riddle-quest:facebook:quit:projection", detail: null},
        {name: "riddle-quest:facebook:quit:presence", detail: null},
        {name: "riddle-quest:facebook:quit:invoke", detail: null},
        {name: "riddle-quest:facebook:quit:returned", detail: null},
        {name: "riddle-quest:facebook:quit:finished", detail: null},
        {name: "riddle-quest:facebook:quit:retired", detail: null},
      ]);
    }

    const latest = beginFacebookQuitTrace();
    latest.record("guard");
    latest.close();
    expect(capturedMarks().map(entry => entry.name)).toEqual([foreignName, "riddle-quest:facebook:quit:guard"]);
    expect(timeline.getEntriesByName(foreignName)).toEqual([foreign]);
  });

  it("isolates the latest lease from stale writes and close calls while preserving its terminal readback", () => {
    const old = beginFacebookQuitTrace();
    old.record("guard");
    const latest = beginFacebookQuitTrace();
    latest.record("operation");
    const operation = timeline.getEntriesByName(prefix + "operation")[0];

    old.record("operation");
    old.record("retired");
    old.close();
    old.close();
    latest.record("finished");
    const finished = timeline.getEntriesByName(prefix + "finished")[0];
    latest.close();
    latest.close();
    latest.record("retired");
    latest.record("finished");

    expect(capturedMarks()).toEqual([operation, finished]);
  });

  it("discards unknown phases without coercing caller values into mark names", () => {
    const trace = beginFacebookQuitTrace();
    trace.record("guard");
    const guard = timeline.getEntriesByName(prefix + "guard")[0];
    const unknownPhases: unknown[] = ["account:private-id", "__proto__", "constructor", "", undefined, null, 1,
      Symbol("private-id"), {toString: () => {throw new Error("Must not coerce caller payload");}}];

    expect(() => {
      for (const phase of unknownPhases) trace.record(phase as FacebookQuitTracePhase);
    }).not.toThrow();
    expect(capturedMarks()).toEqual([guard]);
  });

  it.each(["absent", "undefined", "empty", "getter-throws"])("allows callers to finish when Performance is %s", condition => {
    if (condition === "absent") Reflect.deleteProperty(globalThis, "performance");
    else if (condition === "getter-throws") {
      Object.defineProperty(globalThis, "performance", {configurable: true, get: () => {throw new Error("Performance unavailable");}});
    } else {
      Object.defineProperty(globalThis, "performance", {configurable: true, value: condition === "empty" ? {} : undefined});
    }

    expect(() => {
      const trace = beginFacebookQuitTrace();
      trace.record("guard");
      trace.record("finished");
      trace.close();
      trace.close();
    }).not.toThrow();
    expect(capturedMarks()).toEqual([]);
  });

  it.each([
    ["clearMarks", "throws"], ["clearMarks", "getter-throws"], ["clearMarks", "missing"],
    ["mark", "throws"], ["mark", "getter-throws"], ["mark", "missing"],
  ] as const)("skips failed marks and remains usable when %s %s", (method, failure) => {
    const api = {
      clearMarks: (name: string) => timeline.clearMarks(name),
      mark: (name: string) => timeline.mark(name),
    };
    Object.defineProperty(globalThis, "performance", {configurable: true, value: api});
    const trace = beginFacebookQuitTrace();
    trace.record("guard");
    const workingMethod = Object.getOwnPropertyDescriptor(api, method)!;
    const throwFailure = () => {throw new Error("User Timing failure");};
    Object.defineProperty(api, method, failure === "getter-throws"
      ? {configurable: true, get: throwFailure}
      : {configurable: true, value: failure === "missing" ? undefined : throwFailure});

    expect(() => {
      trace.record("guard");
      trace.record("operation");
    }).not.toThrow();
    Object.defineProperty(api, method, workingMethod);
    trace.record("finished");
    trace.close();

    expect(capturedMarks().map(entry => entry.name)).toEqual(method === "clearMarks"
      ? ["riddle-quest:facebook:quit:guard", "riddle-quest:facebook:quit:finished"]
      : ["riddle-quest:facebook:quit:finished"]);
  });

  it.each(["call", "getter"])("disables a lease after initial cleanup fails in its %s and still invalidates older leases", failure => {
    const old = beginFacebookQuitTrace();
    old.record("retired");
    const retired = timeline.getEntriesByName(prefix + "retired")[0];
    let cleanupBlocked = true;
    Object.defineProperty(globalThis, "performance", {configurable: true, value: {
      get clearMarks() {
        if (cleanupBlocked && failure === "getter") throw new Error("Cleanup getter failed");
        return (name: string) => {
          if (cleanupBlocked && name === prefix + "operation") throw new Error("Cleanup failed");
          timeline.clearMarks(name);
        };
      },
      mark: (name: string) => timeline.mark(name),
    }});

    const failed = beginFacebookQuitTrace();
    cleanupBlocked = false;
    failed.record("guard");
    old.record("operation");
    old.close();
    failed.close();
    expect(capturedMarks()).toEqual([retired]);

    const retry = beginFacebookQuitTrace();
    retry.record("guard");
    retry.close();
    expect(capturedMarks().map(entry => entry.name)).toEqual(["riddle-quest:facebook:quit:guard"]);
  });
});
