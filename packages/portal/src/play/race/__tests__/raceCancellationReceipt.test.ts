import {describe, expect, it} from "@jest/globals";
import {harness, preview} from "./raceSession.support";

/** Creator-owned invitation authorizes one cancellation intent. */
const invitation = {claimState: "unclaimed" as const, publicationState: "pending" as const,
  role: "creator" as const, canCancel: true, expiresAtMs: 1000000};

describe("Invitation cancellation receipts", () => {
  it.each(["waiting", "ready", "expired", "unavailable"] as const)("rejects a cancellation success carrying %s", status => {
    /** The cancellation endpoint commits and returns only cancelled state. */
    const h = harness({challengeId: "original"});
    h.respond("raceEntry", {status: "waiting", invitation, serverNowMs: 10000});
    h.session.cancelInvitation();
    h.respond("raceInviteCancel", status === "ready" ? {status, challenge: preview("original"), serverNowMs: 10010} :
      {status, ...(status === "unavailable" ? {reason: "missing"} : {invitation}), serverNowMs: 10010});
    expect(h.session.getSnapshot()).toMatchObject({entryStatus: {status: "waiting"}, error: "RaceTo10.ERROR_INVALID_RESPONSE", pending: null});
  });
  it.each(["waiting", "ready", "expired", "unavailable"] as const)("preserves cancelled state when a later read returns %s", status => {
    /** Accepted cancellation is terminal for the selected invitation lifetime. */
    const h = harness({challengeId: "original"});
    h.respond("raceEntry", {status: "waiting", invitation, serverNowMs: 10000});
    h.session.cancelInvitation();
    h.respond("raceInviteCancel", {status: "cancelled", invitation: {...invitation, canCancel: false}, serverNowMs: 10010});
    h.session.retry();
    h.respond("raceEntry", status === "ready" ? {status, challenge: preview("original"), existingRunId: "foreign-run", serverNowMs: 10020} :
      {status, ...(status === "unavailable" ? {reason: "missing"} : {invitation}), serverNowMs: 10020});
    expect(h.session.getSnapshot()).toMatchObject({entryStatus: {status: "cancelled"}, challenge: null, error: null, pending: null});
    expect(h.commands.filter(command => command.type === "game:resumeRace")).toHaveLength(0);
  });
  it("accepts a canonical cancelled receipt and does not poll it", () => {
    /** Correct server cancellation ends polling and its creator capability. */
    const h = harness({challengeId: "original"});
    h.respond("raceEntry", {status: "waiting", invitation, serverNowMs: 10000});
    h.session.cancelInvitation();
    h.respond("raceInviteCancel", {status: "cancelled", invitation: {...invitation, canCancel: false}, serverNowMs: 10010});
    h.advance(10000); h.session.cancelInvitation();
    expect(h.session.getSnapshot()).toMatchObject({entryStatus: {status: "cancelled"}, error: null});
    expect(h.commands).toHaveLength(2);
  });
});
