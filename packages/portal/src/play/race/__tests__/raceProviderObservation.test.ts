import {describe, expect, it} from "@jest/globals";
import type {RaceMatchResponse, RaceRecovery} from "@qwordly/core/race";
import type {MatchmakingCapability, MatchmakingResult} from "../../../platform/types";
import {catalog, harness, preview} from "./raceSession.support";

describe("Provider observation retains its original journey", () => {
  it.each(["dispatch", "value", "cancelled", "match", "fallback", "empty", "invalid", "valid", "inherited"])("rejects replacement during %s observation", async mode => {
    /** Observation may enter a new account only once, without recursive getter effects. */
    let armed = true, calls = 0;
    /** Shared journal writes expose any old response attributed to the new account. */
    const journals = new Map<string, RaceRecovery>();
    /** Public entry replacement installs its own authoritative read and journal. */
    const replace = () => {if (armed) {armed = false; h.session.enter({ownerId: "owner-2", locale: "en", challengeId: "replacement"});}};
    /** Plain accepted response remains the compatibility control. */
    const value: RaceMatchResponse = {status: "matched", challenge: preview("old-offer")};
    if (["match", "invalid"].includes(mode)) Object.defineProperty(value, "challenge", {get: () => {replace(); return mode === "invalid" ? {} : preview("old-offer");}});
    /** Empty discovery and fallback selection also pass through schema property observation. */
    const empty: RaceMatchResponse = {status: "empty", locale: "en"};
    if (mode === "fallback") Object.defineProperty(empty, "fallback", {get: () => {replace(); return {offerId: "a".repeat(64), categoryId: "mixed"};}});
    if (mode === "empty") Object.defineProperty(empty, "locale", {get: () => {replace(); return "en";}});
    /** SDK result access can itself notify subscribers before returning its payload. */
    const result: MatchmakingResult = mode === "inherited" ? Object.create({
      /** SDK class-style delivery discriminant is inherited rather than enumerable. */
      get status() {return "success";},
      /** Valid inherited content preserves compatibility with accessor-based adapters. */
      get value() {return value;},
    }) : mode === "cancelled" ? {
      /** Cancellation observation may synchronously replace the original account. */
      get status() {replace(); return "cancelled" as const;},
    } : {status: "success",
      /** Content observation may replace the journey before its schema is parsed. */
      get value() {if (mode === "value") replace(); return ["fallback", "empty"].includes(mode) ? empty : value;},
    };
    /** Method lookup may replace the journey before its retired function is called. */
    const adapter: MatchmakingCapability = {find: async () => {calls++; return result;}};
    if (mode === "dispatch") Object.defineProperty(adapter, "find", {get: () => {replace(); return async () => {calls++; return result;};}});
    /** All assertions use public session state, commands and account-bound persistence. */
    const h = harness({}, null, {getMatchmaking: () => adapter,
      recovery: {read: owner => journals.get(owner ?? "") ?? null, save: record => {journals.set(record.ownerId, record);},
        clear: (owner, id) => {if (journals.get(owner ?? "")?.id === id) journals.delete(owner ?? "");}}});
    h.respond("raceCategories", await catalog()); await h.session.findOpponent(adapter);
    if (["valid", "inherited"].includes(mode)) expect(h.session.getSnapshot()).toMatchObject({stage: "challenge", activeChallengeId: "old-offer", findingOpponent: false});
    else {
      expect(h.session.getSnapshot()).toMatchObject({stage: "challenge", activeChallengeId: "replacement", pending: "raceEntry", findingOpponent: false});
      expect(journals.get("owner-2")?.intent).toMatchObject({kind: "challenge", challengeId: "replacement"});
      expect(h.last()).toMatchObject({type: "game:getRaceEntry", payload: {challengeId: "replacement"}});
    }
    expect(calls).toBe(mode === "dispatch" ? 0 : 1);
  });
});
