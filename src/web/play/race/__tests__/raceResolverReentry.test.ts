import {describe, expect, it} from "@jest/globals";
import type {RaceRecovery} from "../../../../core/race";
import type {MatchmakingCapability, MatchmakingResult} from "../../../platform/types";
import {catalog, harness, preview} from "./raceSession.support";

describe("Resolver reentry preserves the replacement journey", () => {
  it.each(["initial", "dispatch", "completion", "retirement", "valid"])("rechecks ownership after %s lookup", async mode => {
    /** Old provider completion remains under test control. */
    let resolve!: (result: MatchmakingResult) => void;
    /** Reentry may occur at different lookup continuations, including final retirement. */
    let armed = false, lookups = 0, calls = 0;
    /** Provider dispatch itself is observable without reading session internals. */
    const adapter: MatchmakingCapability = {find: () => {calls++; return new Promise(yes => {resolve = yes;});}};
    /** Shared journals retain their account and exact revision ownership. */
    const journals = new Map<string, RaceRecovery>();
    /** Replacement entry owns its own bridge command and challenge journal. */
    const h = harness({}, null, {getMatchmaking: () => {
      lookups++;
      if (armed && (mode !== "dispatch" || lookups === 3)) {
        armed = false; h.session.enter({ownerId: "owner-2", locale: "en", challengeId: "replacement"});
        if (mode === "retirement") return undefined;
      }
      return adapter;
    }, recovery: {read: owner => journals.get(owner ?? "") ?? null, save: record => {journals.set(record.ownerId, record);},
      clear: (owner, id) => {if (journals.get(owner ?? "")?.id === id) journals.delete(owner ?? "");}}});
    h.respond("raceCategories", await catalog());
    if (["initial", "dispatch"].includes(mode)) armed = true;
    /** The cancelled branch has published idle while its private delivery is still settling. */
    h.session.subscribe(() => {if (mode === "retirement" && h.session.getSnapshot().matchSearchStatus === "idle" && h.session.getSnapshot().findingOpponent) armed = true;});
    /** Public discovery promise includes the final ownership cleanup. */
    const pending = h.session.findOpponent(adapter);
    if (["completion", "retirement", "valid"].includes(mode)) {
      if (mode === "completion") armed = true;
      resolve(mode === "retirement" ? {status: "cancelled"} : {status: "success", value: {status: "matched", challenge: preview("old-offer")}});
    }
    await pending;
    if (mode === "valid") expect(h.session.getSnapshot()).toMatchObject({stage: "challenge", activeChallengeId: "old-offer", findingOpponent: false});
    else {
      expect(h.session.getSnapshot()).toMatchObject({stage: "challenge", activeChallengeId: "replacement", findingOpponent: false, pending: "raceEntry"});
      expect(h.last()).toMatchObject({type: "game:getRaceEntry", payload: {challengeId: "replacement"}});
      expect(journals.get("owner-2")?.intent).toMatchObject({kind: "challenge", challengeId: "replacement"});
    }
    expect(calls).toBe(["initial", "dispatch"].includes(mode) ? 0 : 1);
  });
});
