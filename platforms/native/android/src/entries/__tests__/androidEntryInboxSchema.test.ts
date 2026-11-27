import {AndroidEntryInboxEnvelopeSchema} from "../androidEntryInboxSchema";

/** A server-issued private invitation can be recovered without accepting its seat. */
const raceUrl = `riddlequest://race?challengeId=live_${"a".repeat(64)}`;
/** A different opaque entry exercises referral receipt retention independently of a pending race. */
const referralUrl = `riddlequest://referral?token=${"b".repeat(43)}`;

describe("Android private entry storage contract", () => {
  it("accepts a new installation with neither a pending preview nor a consumed Play entry", () => {
    expect(AndroidEntryInboxEnvelopeSchema.parse({version: 1, pending: null, consumedInstallEntryUrl: null}))
      .toEqual({version: 1, pending: null, consumedInstallEntryUrl: null});
  });

  it.each([raceUrl, referralUrl])("restores a recognized pending preview without inventing an install receipt %#", url => {
    expect(AndroidEntryInboxEnvelopeSchema.parse({version: 1, pending: {id: "pending-preview", url}, consumedInstallEntryUrl: null}))
      .toEqual({version: 1, pending: {id: "pending-preview", url}, consumedInstallEntryUrl: null});
  });

  it("retains a Play receipt atomically with its still-unaccepted preview", () => {
    expect(AndroidEntryInboxEnvelopeSchema.parse({version: 1, pending: {id: "play-preview", url: referralUrl}, consumedInstallEntryUrl: referralUrl}))
      .toEqual({version: 1, pending: {id: "play-preview", url: referralUrl}, consumedInstallEntryUrl: referralUrl});
  });

  it("keeps a consumed receipt after dismissal and alongside a newer direct invitation", () => {
    expect(AndroidEntryInboxEnvelopeSchema.parse({version: 1, pending: null, consumedInstallEntryUrl: referralUrl}))
      .toEqual({version: 1, pending: null, consumedInstallEntryUrl: referralUrl});
    expect(AndroidEntryInboxEnvelopeSchema.parse({version: 1, pending: {id: "newer-direct", url: raceUrl}, consumedInstallEntryUrl: referralUrl}))
      .toEqual({version: 1, pending: {id: "newer-direct", url: raceUrl}, consumedInstallEntryUrl: referralUrl});
  });

  it.each([
    "https://example.com/race?challengeId=live_" + "a".repeat(64),
    "riddlequest://daily",
    "riddlequest://race?challengeId=live_" + "a".repeat(63),
    "riddlequest://race?challengeId=live_" + "A".repeat(64),
    "riddlequest://referral?token=" + "b".repeat(42),
    "riddlequest://referral?token=" + "b".repeat(44),
    "riddlequest://referral?token=" + "+".repeat(43),
    `${raceUrl}&utm_campaign=private-campaign`,
    `${referralUrl}#campaign`,
    ` ${raceUrl}`,
    encodeURIComponent(referralUrl),
    "x".repeat(513),
  ])("rejects foreign or noncanonical navigation in either durable URL slot %#", url => {
    expect(AndroidEntryInboxEnvelopeSchema.safeParse({version: 1, pending: {id: "preview", url}, consumedInstallEntryUrl: null}).success).toBe(false);
    expect(AndroidEntryInboxEnvelopeSchema.safeParse({version: 1, pending: null, consumedInstallEntryUrl: url}).success).toBe(false);
  });

  it.each([
    {version: 0, pending: null, consumedInstallEntryUrl: null},
    {version: 2, pending: null, consumedInstallEntryUrl: null},
    {version: "1", pending: null, consumedInstallEntryUrl: null},
    {version: 1, consumedInstallEntryUrl: null},
    {version: 1, pending: null},
    {version: 1, pending: null, consumedInstallEntryUrl: null, utm_campaign: "private-campaign"},
    {version: 1, pending: {id: "preview", url: raceUrl, accountUid: "another-account"}, consumedInstallEntryUrl: null},
    {version: 1, pending: {id: "preview", url: referralUrl, rawReferrer: "utm_campaign=private-campaign"}, consumedInstallEntryUrl: null},
    {version: 1, pending: "preview", consumedInstallEntryUrl: null},
    {version: 1, pending: {id: "preview", url: 42}, consumedInstallEntryUrl: null},
    {version: 1, pending: null, consumedInstallEntryUrl: {url: referralUrl}},
  ])("rejects incompatible storage or extra identity/campaign metadata %#", envelope => {
    expect(AndroidEntryInboxEnvelopeSchema.safeParse(envelope).success).toBe(false);
  });

  it.each(["", "x".repeat(129), 42, null, undefined])("rejects unusable local acknowledgement handles %#", id => {
    expect(AndroidEntryInboxEnvelopeSchema.safeParse({version: 1, pending: {id, url: raceUrl}, consumedInstallEntryUrl: null}).success).toBe(false);
  });

  it.each(["x", "x".repeat(128)])("preserves supported acknowledgement handles exactly %#", id => {
    expect(AndroidEntryInboxEnvelopeSchema.parse({version: 1, pending: {id, url: raceUrl}, consumedInstallEntryUrl: null}))
      .toEqual({version: 1, pending: {id, url: raceUrl}, consumedInstallEntryUrl: null});
  });
});
