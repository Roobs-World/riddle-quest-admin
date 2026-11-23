import {confirmUnavailableLiveInvitation, LIVE_RACE_COMMAND_DEADLINE_MS} from "../../live/liveRaceDeliveryDeadline";

/** Exact invitation owner identifier for the authority-confirmation regressions. */
const challengeId = `live_${"a".repeat(64)}`;
/** Validated unavailable server preview; transport rejection alone never proves this state. */
const preview = {challengeId, locale: "en", categoryId: "science",
  creator: {displayName: "Inviter", avatarUrl: null, bot: false, correctCount: 0},
  expiresAtMs: 900000, status: "unavailable"};

it.each(["failed-precondition", "functions/failed-precondition"])("confirms an unavailable invitation after %s", async code => {
  /** Controlled preview transport for this invitation confirmation. */
  const challenge = jest.fn().mockResolvedValue(preview);
  await expect(confirmUnavailableLiveInvitation({code}, challengeId, {challenge})).resolves.toBe(true);
  expect(challenge).toHaveBeenCalledWith({challengeId});
});

it.each(["available", "accepted", "own"])("does not retire an invitation with authoritative status %s", async status => {
  /** Controlled preview transport for this invitation confirmation. */
  const challenge = jest.fn().mockResolvedValue({...preview, status});
  await expect(confirmUnavailableLiveInvitation({code: "functions/failed-precondition"}, challengeId, {challenge})).resolves.toBe(false);
});

it.each([null, {}, {code: "functions/unavailable"}, {code: "functions/deadline-exceeded"}, {code: "functions/resource-exhausted"}])("keeps uncertain failures retryable: %p", async failure => {
  /** Controlled preview transport for this invitation confirmation. */
  const challenge = jest.fn().mockResolvedValue(preview);
  await expect(confirmUnavailableLiveInvitation(failure, challengeId, {challenge})).resolves.toBe(false);
  expect(challenge).not.toHaveBeenCalled();
});

it.each([{}, {...preview, challengeId: `live_${"b".repeat(64)}`}, {...preview, expiresAtMs: -1}])("rejects malformed or unrelated confirmation: %p", async value => {
  await expect(confirmUnavailableLiveInvitation({code: "failed-precondition"}, challengeId,
    {challenge: jest.fn().mockResolvedValue(value)})).resolves.toBe(false);
});

it("keeps a failed confirmation retryable", async () => {
  await expect(confirmUnavailableLiveInvitation({code: "failed-precondition"}, challengeId,
    {challenge: jest.fn().mockRejectedValue(new Error("offline"))})).resolves.toBe(false);
});

it("does not turn public searches or unsupported transports into terminal invitations", async () => {
  /** Controlled preview transport for this invitation confirmation. */
  const challenge = jest.fn().mockResolvedValue(preview);
  await expect(confirmUnavailableLiveInvitation({code: "failed-precondition"}, undefined, {challenge})).resolves.toBe(false);
  expect(challenge).not.toHaveBeenCalled();
  await expect(confirmUnavailableLiveInvitation({code: "failed-precondition"}, challengeId, {})).resolves.toBe(false);
});

it("releases a confirmation that never settles without declaring the invitation unavailable", async () => {
  jest.useFakeTimers();
  try {
    /** Pending confirmation must release its timer without inferring unavailability. */
    const result = confirmUnavailableLiveInvitation({code: "failed-precondition"}, challengeId,
      {challenge: jest.fn(() => new Promise<never>(() => {}))});
    await jest.advanceTimersByTimeAsync(LIVE_RACE_COMMAND_DEADLINE_MS);
    await expect(result).resolves.toBe(false);
    expect(jest.getTimerCount()).toBe(0);
  } finally {jest.useRealTimers();}
});

it("does not dispatch confirmation after its local owner has retired", async () => {
  /** Already retired acceptance cannot start another provider read. */
  const owner = new AbortController(), challenge = jest.fn().mockResolvedValue(preview);
  owner.abort();
  await expect(confirmUnavailableLiveInvitation({code: "failed-precondition"}, challengeId, {challenge}, owner.signal)).resolves.toBe(false);
  expect(challenge).not.toHaveBeenCalled();
});

it.each(["resolve", "reject"])("releases a retired confirmation before its adapter can %s", async settlement => {
  jest.useFakeTimers();
  try {
    /** The original provider can settle independently of the local cancellation. */
    let resolve!: (value: unknown) => void, reject!: (error: Error) => void;
    /** Held confirmation remains observed after its owning UI wait ends. */
    const request = new Promise((yes, no) => {resolve = yes; reject = no;});
    /** Exact local ownership shared with the rejected acceptance. */
    const owner = new AbortController(), challenge = jest.fn().mockReturnValue(request);
    /** Cancellation must finish without inferring authoritative unavailability. */
    const result = confirmUnavailableLiveInvitation({code: "failed-precondition"}, challengeId, {challenge}, owner.signal);
    expect(jest.getTimerCount()).toBe(1);
    owner.abort();
    await expect(result).resolves.toBe(false);
    expect(jest.getTimerCount()).toBe(0);
    if (settlement === "resolve") resolve(preview); else reject(new Error("Late provider failure"));
    await Promise.resolve();
    await expect(result).resolves.toBe(false);
    expect(challenge).toHaveBeenCalledTimes(1);
  } finally {jest.useRealTimers();}
});
