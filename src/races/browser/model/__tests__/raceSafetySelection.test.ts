import {describe, expect, it} from "@jest/globals";
import type {RaceInboxItem} from "../../../contracts/index";
import {harness} from "../../controllers/__tests__/raceSession.support.ts";

/** Distinct rivals make local block cleanup observable through the public inbox. */
const item = (opponentUserId: string): RaceInboxItem => ({itemId: opponentUserId, challengeId: "challenge",
  opponentUserId, opponentDisplayName: opponentUserId, categoryId: "history", result: "win",
  adjustedDeltaMs: 1000, read: false, createdAtMs: 0});

describe("Safety action selection ownership", () => {
  it.each(["block", "report"] as const)("pins %s target before synchronous notifications", kind => {
    /** Action begins with the rival selected by the player. */
    const h = harness({openInbox: true}), selected = item("selected");
    h.respond("raceInbox", {items: [selected, item("other")]});
    /** Public consumers can retain and change the same inbox item during publication. */
    const unsubscribe = h.session.subscribe(() => {if (h.session.getSnapshot().safetyTargetUserId === "selected") selected.opponentUserId = "other";});
    h.session.safety(kind, selected, "harassment"); unsubscribe();
    expect(h.last().payload).toMatchObject({targetUserId: "selected"});
  });
  it.each(["other", null, "selected"])("cleans only the blocked rival after public target becomes %s", target => {
    /** Both rivals remain visible until the correlated block acknowledgment. */
    const h = harness({openInbox: true}); h.respond("raceInbox", {items: [item("selected"), item("other")]});
    h.session.safety("block", item("selected")); h.session.getSnapshot().safetyTargetUserId = target;
    h.respond("raceBlock", {blocked: true});
    expect(h.session.getSnapshot()).toMatchObject({error: null, safetyTargetUserId: null, safetyNotice: "RaceTo10.BLOCK_SUCCESS"});
    expect(h.session.getSnapshot().inboxItems.map(entry => entry.opponentUserId)).toEqual(["other"]);
  });
  it("accepts report acknowledgment after its displayed target is cleared", () => {
    /** Report receipt belongs to its original command even when presentation changes. */
    const h = harness({openInbox: true}); h.respond("raceInbox", {items: [item("selected"), item("other")]});
    h.session.safety("report", item("selected"), "harassment"); h.session.getSnapshot().safetyTargetUserId = null;
    h.respond("raceReport", {queued: true});
    expect(h.session.getSnapshot()).toMatchObject({error: null, safetyTargetUserId: null, safetyNotice: "RaceTo10.REPORT_SUCCESS"});
    expect(h.session.getSnapshot().inboxItems).toHaveLength(2);
  });
});
