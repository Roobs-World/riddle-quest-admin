import {describe, expect, it} from "@jest/globals";
import {recorded, preview} from "./raceSession.support";
import {projectRaceOutcome} from "../logic/racePresentation";

describe("Race Session privately confirmed result isolation", () => {
  it.each(["canonical", "matching-public-edit"])("pins the final clock across %s repeated outcome delivery", async delivery => {
    /** The first confirmed recording owns its final competitive facts. */
    const h = await recorded(), canonical = structuredClone(h.session.getSnapshot().outcome!);
    /** A consumer retains the displayed result object and accidentally modifies its clock. */
    const visible = h.session.getSnapshot().outcome!;
    visible.wallFinishMs += 1;visible.adjustedFinishMs += 1;
    h.session.retry();h.respond("raceOutcome", delivery === "canonical" ? canonical : {...visible});
    expect(h.session.getSnapshot().error).toBe(delivery === "canonical" ? null : "RaceTo10.ERROR_INVALID_RESPONSE");
    if (delivery === "matching-public-edit") {h.session.retry();h.respond("raceOutcome", canonical);}
    expect(h.session.getSnapshot()).toMatchObject({error: null, outcome: canonical,
      run: {wallElapsedMs: canonical.wallFinishMs, adjustedElapsedMs: canonical.adjustedFinishMs}});
    expect(h.effects.filter(effect => effect.kind === "outcome")).toHaveLength(1);
  });
  it("keeps provider completion callback edits out of the confirmed result baseline", async () => {
    /** Optional platform completion receives presentation data, not ownership of settled facts. */
    const h = await recorded(effect => {if (effect.kind === "outcome") {
      effect.outcome.wallFinishMs += 1;effect.outcome.adjustedFinishMs += 1;
    }});
    /** Canonical time remains owned by the completed authority view. */
    const canonical = projectRaceOutcome(h.session.getSnapshot().run!,60000)!;
    h.session.retry();h.respond("raceOutcome",canonical);
    expect(h.session.getSnapshot()).toMatchObject({error:null,outcome:canonical});
    expect(h.effects.filter(effect => effect.kind === "outcome")).toHaveLength(1);
  });
  it.each(["canonical", "matching-public-edit"])("checks publication against confirmed time for %s response", async delivery => {
    /** Publication must preserve the recorded finish, irrespective of a displayed result edit. */
    const h = await recorded(), canonical = structuredClone(h.session.getSnapshot().outcome!);
    h.session.getSnapshot().outcome!.adjustedFinishMs += 1;
    h.session.publish();
    /** A fully shaped preview differs only in the advertised finish time. */
    const publication = {challengeId:"published",preview:{...preview("published"),adjustedTimeToBeatMs:canonical.adjustedFinishMs+(delivery === "canonical" ? 0 : 1)}};
    h.respond("racePublish",publication);
    expect(h.session.getSnapshot().error).toBe(delivery === "canonical" ? null : "RaceTo10.ERROR_INVALID_RESPONSE");
    expect(h.effects.filter(effect => effect.kind === "publication")).toHaveLength(delivery === "canonical" ? 1 : 0);
    if(delivery === "matching-public-edit") {
      h.session.retry();h.respond("racePublish",{...publication,preview:{...publication.preview,adjustedTimeToBeatMs:canonical.adjustedFinishMs}});
      expect(h.session.getSnapshot().error).toBeNull();
      expect(h.effects.filter(effect => effect.kind === "publication")).toHaveLength(1);
    }
    expect(h.session.getSnapshot().outcome).toEqual(canonical);
  });
  it("restores private run identity when a consumer edits terminal presentation metadata", async () => {
    /** A canonical result read must rebuild its run from private confirmed facts. */
    const h = await recorded(), canonical = structuredClone(h.session.getSnapshot().outcome!);
    /** Mutated public metadata is presentation data rather than a new authority contract. */
    const visible = h.session.getSnapshot().run!;
    visible.role = "challenger";visible.categoryId = "history";visible.locale = "fr";
    h.session.retry();h.respond("raceOutcome",canonical);
    expect(h.session.getSnapshot()).toMatchObject({error:null,run:{role:"creator",categoryId:"mixed",locale:"en"}});
    h.session.publish();h.respond("racePublish",{challengeId:"published",preview:{...preview("published"),adjustedTimeToBeatMs:canonical.adjustedFinishMs}});
    expect(h.effects.filter(effect => effect.kind === "publication")).toHaveLength(1);
  });
  it("accepts later reward presentation while preserving one completion effect", async () => {
    /** Reward refresh is valid authority data without a different competitive result. */
    const h = await recorded(), canonical = structuredClone(h.session.getSnapshot().outcome!);
    h.session.retry();h.respond("raceOutcome",{...canonical,achievementCoinsAwarded:150,newCoins:900});
    expect(h.session.getSnapshot()).toMatchObject({error:null,outcome:{...canonical,achievementCoinsAwarded:150,newCoins:900}});
    expect(h.effects.filter(effect => effect.kind === "outcome")).toHaveLength(1);
  });
});
