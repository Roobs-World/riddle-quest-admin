import {describe, expect, it} from "@jest/globals";
import {harness, preview} from "../../controllers/__tests__/raceSession.support.ts";

describe("Private creator acceptance routing", () => {
  it.each(["viewer", "invitation", "clear", "identity"] as const)("keeps creator routing after public role facts change: %s", mode => {
    /** Ready challenge is owned by its authenticated creator. */
    const h = harness({challengeId: "owned"});
    h.respond("raceEntry", {status: "ready", challenge: preview("owned"), serverNowMs: 1000,
      ...(mode === "invitation" ? {invitation: {claimState: "unclaimed", publicationState: "published", role: "creator", canCancel: true, expiresAtMs: 20000}} : {viewerRole: "creator"})});
    /** A presentation object cannot turn a creator into an eligible opponent. */
    const state = h.session.getSnapshot();
    if (mode === "clear") state.entryStatus = null;
    else if (mode === "identity") state.activeChallengeId = "other";
    else if (state.entryStatus?.status === "ready") {
      state.entryStatus.viewerRole = "recipient";
      if (state.entryStatus.invitation) state.entryStatus.invitation.role = "recipient";
    }
    h.session.begin("mixed");
    expect(h.session.getSnapshot().stage).toBe("inbox");
    expect(h.commands.filter(command => command.type === "game:startRace")).toHaveLength(0);
  });
  it("does not let a public creator-role rewrite block a known recipient", () => {
    /** Actual recipient may accept a ready recording. */
    const h = harness({challengeId: "offered"});
    h.respond("raceEntry", {status: "ready", challenge: preview("offered"), viewerRole: "recipient", serverNowMs: 1000});
    /** Public presentation role is deliberately changed to contradict accepted facts. */
    const entry = h.session.getSnapshot().entryStatus;
    if (entry?.status === "ready") entry.viewerRole = "creator";
    h.session.begin("mixed");
    expect(h.last()).toMatchObject({type: "game:startRace", payload: {challengeId: "offered"}});
  });
});
