import {describe, expect, it} from "@jest/globals";
import {harness, fixture} from "./raceSession.support.ts";

/** Selection snapshot is supplied by a storage adapter, never competitive authority. */
const selection = {version: 1, id: "recovery-id", ownerId: "owner-1", locale: "en", savedAtMs: 1000,
  expiresAtMs: 3000, intent: {kind: "start", request: {locale: "en", categoryId: "mixed", requestId: "original-start", prepare: true, includeEvaluation: true}}};

describe("Race Session restored storage validation", () => {
  it.each([{ownerId: "other-owner"}, {locale: "fr"}, {expiresAtMs: 2000}, {savedAtMs: 2001}, {version: 99},
    {intent: {kind: "start", request: {locale: "en", categoryId: "mixed"}}},
    {intent: {kind: "start", request: {...selection.intent.request, categoryId: "unknown"}}}])
  ("ignores invalid adapter-provided selection %j", invalid => {
    /** Round-trip serialization models unchecked values crossing the injected storage boundary. */
    let h: ReturnType<typeof harness> | undefined;
    expect(() => {h = harness({}, null, {wallNow: () => 2000, recovery: {read: () => JSON.parse(JSON.stringify({...selection, ...invalid})), save: () => {}, clear: () => {}}});}).not.toThrow();
    expect(h!.last()).toMatchObject({type: "game:listRaceCategories"});
    expect(h!.session.getSnapshot()).toMatchObject({pending: "raceCategories", error: null, run: null});
  });
  it.each([" ", "x".repeat(161), 42, {runId: "run"}])("ignores invalid adapter-provided run hint %j", invalid => {
    /** Invalid run hints cannot become pending bridge ownership. */
    const h = harness({}, null, {persistence: {read: () => JSON.parse(JSON.stringify(invalid)), save: () => {}, clear: () => {}}});
    expect(h.last().type).toBe("game:listRaceCategories");
  });
  it("normalizes a valid run hint before matching the actual authority response", async () => {
    /** Compatibility permits padded identifiers but ownership uses the canonical parsed value. */
    const h = harness({}, null, {persistence: {read: () => "  owned-run  ", save: () => {}, clear: () => {}}});
    expect(h.last()).toMatchObject({type: "game:resumeRace", payload: {runId: "owned-run"}});
    h.respond("raceResume", {run: {...await fixture(true), runId: "owned-run"}});
    expect(h.session.getSnapshot()).toMatchObject({error: null, run: {runId: "owned-run"}, pending: "raceReady"});
  });
});
