import {createFacebookLiveRaceSharing} from "../FacebookLiveRaceSharing";
import type {FacebookInstantSdk} from "../fbinstant";
import {facebookLaunchFromEntryData} from "../referrals";

/** Isolated native invitation challengeId fixture. */
const challengeId = `live_${"a".repeat(64)}`;
/** Isolated native invitation fixture fixture. */
const fixture = (supported = ["inviteAsync", "shareAsync"]) => {
  /** Isolated native invitation inviteAsync fixture. */
  const inviteAsync = jest.fn(async (_input: unknown) => undefined);
  /** Isolated native invitation shareAsync fixture. */
  const shareAsync = jest.fn(async (_input: unknown) => undefined);
  /** Isolated native invitation sdk fixture. */
  const sdk = {getSupportedAPIs: () => supported, inviteAsync, shareAsync} as unknown as FacebookInstantSdk;
  /** Isolated native invitation options fixture. */
  const options = {sdk, enabled: true, ageCategory: "13_plus" as const, isActive: () => true,
    renderImage: jest.fn(() => "data:image/png;base64,YQ=="), reportFailure: jest.fn()};
  return {options, inviteAsync, shareAsync};
};

it("uses the native friend picker with no referral token dependency and preserves the incoming lobby", async () => {
  /** Isolated native invitation {options, inviteAsync, shareAsync} fixture. */
  const {options, inviteAsync, shareAsync} = fixture();
  await expect(createFacebookLiveRaceSharing(options)!({challengeId})).resolves.toBe("success");
  expect(shareAsync).not.toHaveBeenCalled();
  /** Isolated native invitation payload fixture. */
  const payload = inviteAsync.mock.calls[0][0] as {
    /** Opaque invitation entry data. */
    data: Record<string, string>;
  };
  expect(payload).toMatchObject({image: "data:image/png;base64,YQ==", dialogTitle: "Challenge a friend"});
  expect(payload.data).toEqual({challengeId});
  expect(facebookLaunchFromEntryData(payload.data).initialRaceChallengeId).toBe(challengeId);
});

it("falls back to the supported challenge share dialog without switching context", async () => {
  /** Isolated native invitation {options, inviteAsync, shareAsync} fixture. */
  const {options, inviteAsync, shareAsync} = fixture(["shareAsync"]);
  await expect(createFacebookLiveRaceSharing(options)!({challengeId})).resolves.toBe("success");
  expect(inviteAsync).not.toHaveBeenCalled();
  expect(shareAsync).toHaveBeenCalledWith(expect.objectContaining({intent: "CHALLENGE", switchContext: false, data: {challengeId}}));
});

it.each(["USER_INPUT", "USER_CANCELLED"])("leaves the existing challenge retryable after %s", async code => {
  /** Isolated native invitation {options, inviteAsync} fixture. */
  const {options, inviteAsync} = fixture();
  inviteAsync.mockRejectedValueOnce({code});
  /** Isolated native invitation invite fixture. */
  const invite = createFacebookLiveRaceSharing(options)!;
  await expect(invite({challengeId})).resolves.toBe("cancelled");
  expect(options.reportFailure).not.toHaveBeenCalled();
  await expect(invite({challengeId})).resolves.toBe("success");
});

it("rejects unsupported hosts, disabled multiplayer, and unknown audiences", () => {
  /** Isolated native invitation {options} fixture. */
  const {options} = fixture([]);
  expect(createFacebookLiveRaceSharing(options)).toBeUndefined();
  expect(createFacebookLiveRaceSharing({...fixture().options, enabled: false})).toBeUndefined();
  expect(createFacebookLiveRaceSharing({...fixture().options, ageCategory: "unknown"})).toBeUndefined();
  /** Isolated native invitation missing fixture. */
  const missing = fixture(["inviteAsync"]);
  delete missing.options.sdk.inviteAsync;
  expect(createFacebookLiveRaceSharing(missing.options)).toBeUndefined();
});

it("rejects malformed handles, invalid images and retired accounts before opening Meta UI", async () => {
  /** Isolated native invitation {options, inviteAsync} fixture. */
  const {options, inviteAsync} = fixture();
  /** Isolated native invitation invite fixture. */
  const invite = createFacebookLiveRaceSharing(options)!;
  await expect(invite({challengeId: "not-a-live-lobby"})).resolves.toBe("error");
  options.renderImage.mockReturnValueOnce("not-an-image");
  await expect(invite({challengeId})).resolves.toBe("error");
  options.isActive = () => false;
  await expect(createFacebookLiveRaceSharing(options)!({challengeId})).resolves.toBe("error");
  expect(inviteAsync).not.toHaveBeenCalled();
});

it("blocks overlapping native dialogs and releases the gate after bounded failures", async () => {
  /** Isolated native invitation {options, inviteAsync} fixture. */
  const {options, inviteAsync} = fixture();
  /** Isolated native invitation release fixture. */
  let release!: () => void;
  inviteAsync.mockImplementationOnce(() => new Promise<void>(resolve => {release = resolve;}));
  /** Isolated native invitation invite fixture. */
  const invite = createFacebookLiveRaceSharing(options)!;
  /** Isolated native invitation pending fixture. */
  const pending = invite({challengeId});
  await expect(invite({challengeId})).resolves.toBe("error");
  expect(inviteAsync).toHaveBeenCalledTimes(1);
  release();
  await expect(pending).resolves.toBe("success");
  inviteAsync.mockRejectedValueOnce(new Error("private diagnostics"));
  await expect(invite({challengeId})).resolves.toBe("error");
  expect(options.reportFailure).toHaveBeenCalledWith(new Error("facebook-native-challenge-failed"));
  await expect(invite({challengeId})).resolves.toBe("success");
});
