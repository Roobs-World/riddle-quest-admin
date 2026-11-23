import {describe, expect, it} from "@jest/globals";
import type {RaceRecovery} from "../../../contracts/index";
import {catalog, harness, preview} from "./raceSession.support.ts";

describe("Race Session competing search journals", () => {
  it.each(["matched", "empty", "failure"] as const)("preserves another tab's journal during a late %s result", async mode => {
    /** Optional shared journal stores validated search intent across lifetimes. */
    let saved: RaceRecovery | null = null;
    /** Public provider callback changes the shared selection before settling. */
    const h = harness({}, null, {wallNow: () => 1000, recovery: {read: () => saved,
      save: record => {saved = record;}, clear: (_owner, id) => {if (saved?.id === id) saved = null;}}});
    h.respond("raceCategories", await catalog());
    await h.session.findOpponent({find: async () => {
      saved = {...saved!, id: "other-tab-journal", intent: {kind: "challenge", challengeId: "newer-challenge"}};
      if (mode === "matched") return {status: "success", value: {status: "matched", challenge: preview()}};
      if (mode === "empty") return {status: "success", value: {status: "empty", locale: "en"}};
      return {status: "retryable-failure", message: "offline"};
    }});
    expect(saved).toMatchObject({id: "other-tab-journal", intent: {kind: "challenge", challengeId: "newer-challenge"}});
    expect(h.session.getSnapshot().findingOpponent).toBe(false);
    expect(h.session.getSnapshot().matchSearchStatus).toBe(mode === "failure" ? "failed" : mode);
    h.session.requestClose();
    expect(saved?.id).toBe("other-tab-journal");
  });
});
