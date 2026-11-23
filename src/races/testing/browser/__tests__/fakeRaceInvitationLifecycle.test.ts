import {afterEach, beforeEach, describe, expect, it, jest} from "@jest/globals";
import {RaceEntryResponseSchema} from "../../../contracts/index";
import {createFakeRaceServices} from "../fakeRaceServices";

/** Completes a creator recording through the same typed mutation interface used by browser flows. */
async function completedCreator(withHint = false) {
  /** Independent creator transport adapter. */
  const services = createFakeRaceServices();
  /** Immutable preloaded fixture supplies authoritative answers to this test. */
  let {run} = await services.startRace({locale: "en", categoryId: "mixed", requestId: "creator-start", includeEvaluation: true});
  if (withHint) run = (await services.requestRaceHint({runId: run.runId, riddleId: run.currentRiddle!.riddleId,
    requestId: "creator-hint"})).run;
  for (let position = 0; position < 10; position++) {
    run = (await services.submitRaceGuess({runId: run.runId, riddleId: run.currentRiddle!.riddleId,
      guess: run.currentRiddle!.evaluation!.answer, requestId: `creator-answer-${position}`})).run;
  }
  expect(run.status).toBe("completed");
  return {services, run};
}

/** Browser storage descriptor belongs to the test and is restored after every scenario. */
const previousStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
beforeEach(() => {
  /** Shared browser persistence across independent injected transport instances. */
  const values = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", {configurable: true, value: {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {values.set(key, value);},
  }});
});
afterEach(() => {
  if (previousStorage) Object.defineProperty(globalThis, "localStorage", previousStorage);
  else Reflect.deleteProperty(globalThis, "localStorage");
});

describe("injected invitation transport lifecycle", () => {
  it("opens each shared link against its own creator recording across separate surfaces", async () => {
    /** First independently completed creator recording. */
    const first = await completedCreator();
    /** Second creator uses a different recorded event sequence. */
    const second = await completedCreator(true);
    /** Publication receipt bound to the first recording. */
    const firstShare = await first.services.publishRace({runId: first.run.runId, requestId: "publish-first"});
    /** Publication receipt bound to the second recording. */
    const secondShare = await second.services.publishRace({runId: second.run.runId, requestId: "publish-second"});
    expect(firstShare.challengeId).not.toBe(secondShare.challengeId);
    /** Separate surface resolves persisted publication ownership. */
    const recipient = createFakeRaceServices();
    for (const [publication, recording, other] of [
      [firstShare, first.run, second.run], [secondShare, second.run, first.run],
    ] as const) {
      await expect(recipient.getRaceEntry!(publication.challengeId, "en")).resolves.toMatchObject({
        status: "ready", challenge: {challengeId: publication.challengeId},
      });
      /** Accepted run must carry this publication's recorded opponent. */
      const {run} = await recipient.startRace({locale: "en", challengeId: publication.challengeId,
        requestId: `accept-${publication.challengeId}`});
      expect(run.challengeId).toBe(publication.challengeId);
      expect(run.opponent?.events).toEqual(recording.events);
      expect(run.opponent?.events).not.toEqual(other.events);
      expect(run.opponent?.adjustedFinishMs).toBe(publication.preview.adjustedTimeToBeatMs);
    }
  });
  it.each([false, true])("preserves typed recipient readiness when publication comes first: %s", async publishFirst => {
    /** Creator's complete recording can be published before or after recipient arrival. */
    const {services: creator, run} = await completedCreator();
    /** Reservation is separate from recording publication. */
    const reservation = await creator.reserveRaceInvite!({requestId: "reserve"});
    await expect(creator.getRaceEntry!(reservation.challengeId, "en")).resolves.toMatchObject({status: "waiting",
      invitation: {role: "creator", canCancel: true, publicationState: "pending"}});
    if (publishFirst) await creator.publishRace({runId: run.runId, requestId: "publish", reservedChallengeId: reservation.challengeId});
    /** Another mounted surface recovers the persisted reservation and recording. */
    const recipient = createFakeRaceServices();
    /** Entry claims a recipient seat independently of publication. */
    const entry = await recipient.getRaceEntry!(reservation.challengeId, "en");
    expect(RaceEntryResponseSchema.parse(entry)).toMatchObject({status: publishFirst ? "ready" : "waiting",
      invitation: {role: "recipient", canCancel: false, claimState: "claimed"}});
    if (!publishFirst) await creator.publishRace({runId: run.runId, requestId: "publish", reservedChallengeId: reservation.challengeId});
    await expect(recipient.getRaceEntry!(reservation.challengeId, "en")).resolves.toMatchObject({status: "ready",
      challenge: {challengeId: reservation.challengeId}, invitation: {claimState: "claimed", publicationState: "published"}});
    await expect(recipient.cancelRaceInvite!({challengeId: reservation.challengeId, requestId: "unauthorized-cancel"}))
      .rejects.toThrow("Only the creator can cancel");
  });

  it("recovers creator cancellation on a different recipient surface and refuses cancelled publication", async () => {
    /** A completed recording cannot override cancellation of its reserved invitation. */
    const {services: creator, run} = await completedCreator();
    /** Independent reservation awaiting publication. */
    const reservation = await creator.reserveRaceInvite!({requestId: "reserve"});
    await expect(creator.cancelRaceInvite!({challengeId: reservation.challengeId, requestId: "cancel"}))
      .resolves.toMatchObject({status: "cancelled", invitation: {canCancel: false}});
    await expect(createFakeRaceServices().getRaceEntry!(reservation.challengeId, "en"))
      .resolves.toMatchObject({status: "cancelled", invitation: {role: "recipient", canCancel: false}});
    await expect(creator.publishRace({runId: run.runId, requestId: "publish", reservedChallengeId: reservation.challengeId}))
      .rejects.toThrow("Invitation is unavailable");
  });

  it("distinguishes missing, expired and wrong-language entries while recovering a public recording", async () => {
    /** Public recording can be recovered without an invitation reservation. */
    const {services: creator, run} = await completedCreator();
    /** Published public challenge retained in browser-harness persistence. */
    const publication = await creator.publishRace({runId: run.runId, requestId: "public-publish"});
    /** Independent recipient exercises typed lookup outcomes. */
    const recipient = createFakeRaceServices();
    await expect(recipient.getRaceEntry!("missing", "en")).resolves.toMatchObject({status: "unavailable", reason: "missing"});
    await expect(recipient.getRaceEntry!(publication.challengeId, "ja")).resolves.toMatchObject({status: "unavailable", reason: "locale"});
    await expect(recipient.getRaceEntry!(publication.challengeId, "en")).resolves.toMatchObject({status: "ready"});
    /** Authority clock crosses both challenge and invitation expiry without a real wait. */
    const clock = jest.spyOn(Date, "now").mockReturnValue(publication.preview.expiresAtMs + 1);
    try {await expect(recipient.getRaceEntry!(publication.challengeId, "en")).resolves.toMatchObject({status: "expired"});}
    finally {clock.mockRestore();}
    /** Fresh reservation has its own deadline independent of the public recording. */
    const reservation = await creator.reserveRaceInvite!({requestId: "expiry-reserve"});
    /** Fresh spy controls the reservation expiry after restoring the first observation clock. */
    const invitationClock = jest.spyOn(Date, "now").mockReturnValue(reservation.expiresAtMs + 1);
    try {await expect(creator.getRaceEntry!(reservation.challengeId, "en")).resolves.toMatchObject({status: "expired"});}
    finally {invitationClock.mockRestore();}
  });
});
