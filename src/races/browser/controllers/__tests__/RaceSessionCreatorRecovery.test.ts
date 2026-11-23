import {expect, it} from "@jest/globals";
import {harness} from "./raceSession.support.ts";

it("cancels incompatible creator metadata once using the privately accepted invitation", () => {
  /** Correlated authority transport owns the original invitation selection. */
  const h = harness({challengeId:"opaque-seat"});
  /** Answer-free facts come only from the successful creator-role negotiation. */
  const invitation = {claimState:"unclaimed",publicationState:"published",role:"creator",canCancel:true,expiresAtMs:20000};
  h.respond("raceEntry",{status:"unavailable",reason:"invalid",invitation,serverNowMs:10000});
  h.session.getSnapshot().activeChallengeId = "observer-replacement";
  h.session.cancelInvitation();
  expect(h.last()).toMatchObject({type:"game:cancelRaceInvite",payload:{challengeId:"opaque-seat"}});
  h.session.cancelInvitation();
  expect(h.commands).toHaveLength(2);
  h.respond("raceInviteCancel",{status:"cancelled",invitation:{...invitation,canCancel:false},serverNowMs:10001});
  h.session.cancelInvitation();
  expect(h.commands).toHaveLength(2);
});

it("does not invent cancellation for legacy incompatible readiness", () => {
  /** An old response contains no negotiated ownership capability. */
  const h = harness({challengeId:"opaque-seat"});
  h.respond("raceEntry",{status:"unavailable",reason:"invalid",serverNowMs:10000});
  h.session.cancelInvitation();
  expect(h.commands).toHaveLength(1);
});

it("ignores a presentation observer that invents the creator cancellation capability", () => {
  /** Private accepted selection remains independent of its mutable presentation copy. */
  const h = harness({challengeId:"opaque-seat"});
  h.respond("raceEntry",{status:"unavailable",reason:"invalid",invitation:{claimState:"unclaimed",publicationState:"published",role:"creator",canCancel:false,expiresAtMs:20000},serverNowMs:10000});
  /** This public mutation must not grant an authority action. */
  const entry = h.session.getSnapshot().entryStatus;
  if (entry?.status !== "unavailable" || !entry.invitation) throw new Error("Missing recovery fixture");
  entry.invitation.canCancel = true;
  h.session.cancelInvitation();
  expect(h.commands).toHaveLength(1);
});
