import {describe, expect, it} from "@jest/globals";
import {harness} from "./raceSession.support";

/** A server-owned waiting invitation carries no challenge ID in its presentation view. */
const waiting = (creator = false, expiresAtMs = 1000000) => ({status: "waiting" as const, serverNowMs: 10000,
  invitation: {claimState: "unclaimed" as const, publicationState: "pending" as const,
    role: creator ? "creator" as const : "recipient" as const, canCancel: creator, expiresAtMs}});

describe("Private waiting invitation selection", () => {
  it.each(["identity", "clear"] as const)("polls the accepted challenge after public %s mutation", mode => {
    /** Accepted request remains authoritative even though waiting responses omit identity. */
    const h = harness({challengeId: "original"});
    h.respond("raceEntry", waiting());
    if (mode === "identity") h.session.getSnapshot().activeChallengeId = "foreign";
    else h.session.getSnapshot().entryStatus = null;
    h.advance(1000);
    expect(h.commands).toHaveLength(2);
    expect(h.last()).toMatchObject({type: "game:getRaceEntry", payload: {challengeId: "original"}});
  });
  it("expires at the accepted deadline despite a public extension", () => {
    /** Authority time is anchored at the receipt rather than a mutable displayed deadline. */
    const h = harness({challengeId: "original"});
    h.respond("raceEntry", waiting(false, 11000));
    /** Deliberately retained display object cannot extend the invitation lifetime. */
    const entry = h.session.getSnapshot().entryStatus;
    if (entry?.status === "waiting") entry.invitation.expiresAtMs = 1000000;
    h.advance(1000);
    expect(h.session.getSnapshot().entryStatus?.status).toBe("expired");
    expect(h.commands).toHaveLength(1);
  });
  it("cannot grant cancellation by rewriting recipient capability", () => {
    /** Only the accepted explicit capability permits a cancellation command. */
    const h = harness({challengeId: "original"});
    h.respond("raceEntry", waiting());
    /** Public capability edits are not authorization. */
    const entry = h.session.getSnapshot().entryStatus;
    if (entry?.status === "waiting") {entry.invitation.canCancel = true; entry.invitation.role = "creator";}
    h.session.cancelInvitation();
    expect(h.commands).toHaveLength(1);
  });
  it("keeps accepted creator cancellation and its original identity", () => {
    /** A creator's accepted capability survives erased presentation state. */
    const h = harness({challengeId: "original"});
    h.respond("raceEntry", waiting(true));
    h.session.getSnapshot().entryStatus = null;
    h.session.getSnapshot().activeChallengeId = "foreign";
    h.session.cancelInvitation();
    expect(h.last()).toMatchObject({type: "game:cancelRaceInvite", payload: {challengeId: "original"}});
  });
  it("retries the accepted identity instead of an overwritten UI selection", () => {
    /** Retrying the entry read must retain the accepted challenge. */
    const h = harness({challengeId: "original"});
    h.respond("raceEntry", waiting());
    h.session.getSnapshot().activeChallengeId = "foreign";
    h.session.retry();
    expect(h.last()).toMatchObject({type: "game:getRaceEntry", payload: {challengeId: "original"}});
  });
  it("does not revive an expired accepted invitation from a rewritten public view", () => {
    /** A visibility refresh stays pending while the original authority deadline elapses. */
    const h = harness({challengeId: "original"});
    h.respond("raceEntry", waiting(false, 11000));
    h.session.setVisible(false); h.session.setVisible(true);
    /** Correlated pending poll may arrive after local authority-time expiration. */
    const poll = h.last();
    h.advance(1000);
    h.session.getSnapshot().entryStatus = waiting(false, 1000000);
    h.respond("raceEntry", waiting(false, 1000000), poll);
    expect(h.session.getSnapshot().entryStatus?.status).toBe("expired");
  });
});
