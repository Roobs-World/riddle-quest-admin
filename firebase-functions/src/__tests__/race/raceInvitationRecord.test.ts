import {parseRaceInvitation} from "../../race/invitations/raceInvitationRecord";

/** Supported legacy invitations need no explicit independent state fields. */
const legacy = {challengeId: "invitation", creatorId: "creator", locale: "en", status: "inviting", createdAtMs: 0, expiresAtMs: 1000};
it("preserves independent legacy publication normalization and binds the canonical document", () => {
  expect(parseRaceInvitation(legacy, false, "invitation")).toMatchObject({claimState: "unclaimed", publicationState: "pending"});
  expect(parseRaceInvitation({...legacy, recipientId: "recipient", publishedAtMs: 100}, false, "invitation"))
    .toMatchObject({claimState: "claimed", publicationState: "published"});
  expect(parseRaceInvitation({...legacy, status: "claimed", recipientId: "recipient"}, true, "invitation").publicationState).toBe("published");
  expect(() => parseRaceInvitation(legacy, false, "other-invitation")).toThrow("Stored race invitation is invalid");
});
it.each([
  {status: "claimed"}, {challengeId: "other/document"}, {creatorId: "other/account"}, {recipientId: "other/account"}, {challengeId: "x".repeat(161)},
  {createdAtMs: -1}, {createdAtMs: 0.5}, {expiresAtMs: Infinity}, {expiresAtMs: Number.MAX_SAFE_INTEGER + 1},
  {publishedAtMs: -1}, {cancelledAtMs: 0.5}, {claimedAtMs: NaN},
])("rejects unsafe stored invitation paths and clocks without exposing payloads: %j", changes => {
  expect(() => parseRaceInvitation({...legacy, ...changes})).toThrow("Stored race invitation is invalid");
});
