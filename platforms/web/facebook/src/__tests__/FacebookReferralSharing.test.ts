import {createFacebookReferralSharing} from "../FacebookReferralSharing";
import type {FacebookInstantSdk, FacebookSharePayload} from "../fbinstant";
import {createFacebookNotificationCapability} from "../FacebookNotificationCapability";
import type {FacebookReferralToken} from "../referrals";
import {setLocale} from "../../../../../src/web/play/i18n";

/** Target-local SDK boundary with no Jest platform or DOM identity involved. */
const fixture = () => {
  /** Stores shareAsync for this isolated provider verification. */
  const shareAsync = jest.fn(async (_payload: FacebookSharePayload) => undefined);
  /** Stores sdk for this isolated provider verification. */
  const sdk = {getSupportedAPIs: () => ["shareAsync"], shareAsync} as unknown as FacebookInstantSdk;
  /** Stores issueToken for this isolated provider verification. */
  const issueToken = jest.fn(async () => ({token: "a".repeat(43), expiresAtMs: Date.now() + 60_000}));
  /** Stores renderImage for this isolated provider verification. */
  const renderImage = jest.fn(() => "data:image/png;base64,YQ==");
  /** Stores reportFailure for this isolated provider verification. */
  const reportFailure = jest.fn();
  /** Stores options for this isolated provider verification. */
  const options = {sdk, enabled: true, ageCategory: "13_plus" as const, isActive: () => true, issueToken, renderImage, reportFailure};
  return {options, shareAsync, issueToken, renderImage, reportFailure};
};

it("uses Meta's native challenge dialog with an opaque token and server destination only", async () => {
  /** Stores options, shareAsync, issueToken for this isolated provider verification. */
  const {options, shareAsync, issueToken} = fixture();
  /** Stores capability for this isolated provider verification. */
  const capability = createFacebookReferralSharing(options)!;
  expect(capability.inviteLabel).toBe("Invite a friend");
  expect(capability.raceShareLabel).toBe("Challenge a friend");
  await expect(capability.shareRace({challengeId: "challenge-1", preview: {adjustedTimeToBeatMs: 9000}})).resolves.toBe("success");
  expect(issueToken).toHaveBeenCalledTimes(1);
  expect(shareAsync).toHaveBeenCalledWith({intent: "CHALLENGE", switchContext: false,
    image: "data:image/png;base64,YQ==", text: "Race to 10 · Time to beat: 9.00s",
    data: {challengeId: "challenge-1", referralToken: "a".repeat(43)}});
});

it.each(["USER_INPUT", "USER_CANCELLED"])("allows retry after Meta dismisses sharing with %s", async code => {
  /** Stores options, shareAsync, reportFailure for this isolated provider verification. */
  const {options, shareAsync, reportFailure} = fixture();
  shareAsync.mockRejectedValueOnce({code});
  /** Stores capability for this isolated provider verification. */
  const capability = createFacebookReferralSharing(options)!;
  /** Stores input for this isolated provider verification. */
  const input = {challengeId: "challenge-1", preview: {adjustedTimeToBeatMs: 9000}};
  await expect(capability.shareRace(input)).resolves.toBe("cancelled");
  expect(reportFailure).not.toHaveBeenCalled();
  await expect(capability.shareRace(input)).resolves.toBe("success");
});

it("holds the provider gate while a token request is pending and prevents subscription overlap", async () => {
  /** Stores options, issueToken, shareAsync for this isolated provider verification. */
  const {options, issueToken, shareAsync} = fixture();
  /** Stores release for this isolated provider verification. */
  let release!: (value: FacebookReferralToken) => void;
  issueToken.mockImplementationOnce(() => new Promise(resolve => {release = resolve;}));
  /** Stores capability for this isolated provider verification. */
  const capability = createFacebookReferralSharing(options)!;
  /** Stores pending for this isolated provider verification. */
  const pending = capability.shareRace({challengeId: "challenge-1", preview: {adjustedTimeToBeatMs: 1}});
  await expect(capability.shareRace({challengeId: "challenge-2", preview: {adjustedTimeToBeatMs: 2}})).resolves.toBe("error");
  options.sdk.getSupportedAPIs = () => ["shareAsync", "player.canSubscribeBotAsync", "player.isSubscribedBotAsync", "player.subscribeBotAsync"];
  /** Stores subscribe for this isolated provider verification. */
  const subscribe = jest.fn(async () => undefined);
  options.sdk.player = {canSubscribeBotAsync: async () => true, isSubscribedBotAsync: async () => false,
    subscribeBotAsync: subscribe} as unknown as FacebookInstantSdk["player"];
  await expect(createFacebookNotificationCapability(options.sdk)!.requestPermission()).resolves.toMatchObject({status: "unavailable"});
  expect(subscribe).not.toHaveBeenCalled();
  release({token: "a".repeat(43), expiresAtMs: Date.now() + 60_000});
  await expect(pending).resolves.toBe("success");
  expect(issueToken).toHaveBeenCalledTimes(1);
  expect(shareAsync).toHaveBeenCalledTimes(1);
});

it("reads native share labels in the current restored or changed locale", async () => {
  /** Stores options for this isolated provider verification. */
  const {options} = fixture();
  /** Stores capability for this isolated provider verification. */
  const capability = createFacebookReferralSharing(options)!;
  setLocale("fr");
  await new Promise(resolve => setTimeout(resolve, 0));
  expect(capability.inviteLabel).toBe("Inviter un ami");
  expect(capability.raceShareLabel).toBe("Défier un ami");
  setLocale("en");
  expect(capability.inviteLabel).toBe("Invite a friend");
});

it("fails closed for unsupported APIs, server gates and unknown audiences", () => {
  /** Stores options for this isolated provider verification. */
  const {options} = fixture();
  expect(createFacebookReferralSharing({...options, enabled: false})).toBeUndefined();
  expect(createFacebookReferralSharing({...options, ageCategory: "unknown"})).toBeUndefined();
  options.sdk.getSupportedAPIs = () => [];
  expect(createFacebookReferralSharing(options)).toBeUndefined();
  options.sdk.getSupportedAPIs = () => ["shareAsync"];
  delete options.sdk.shareAsync;
  expect(createFacebookReferralSharing(options)).toBeUndefined();
});

it("does not open Meta UI after an expired token, transport failure, or account deletion", async () => {
  /** Stores options, issueToken, shareAsync, reportFailure for this isolated provider verification. */
  const {options, issueToken, shareAsync, reportFailure} = fixture();
  /** Stores input for this isolated provider verification. */
  const input = {challengeId: "challenge-1", preview: {adjustedTimeToBeatMs: 1}};
  /** Stores capability for this isolated provider verification. */
  const capability = createFacebookReferralSharing(options)!;
  issueToken.mockResolvedValueOnce({token: "a".repeat(43), expiresAtMs: 1});
  await expect(capability.shareRace(input)).resolves.toBe("error");
  issueToken.mockRejectedValueOnce(new Error("private-provider-diagnostics"));
  await expect(capability.shareRace(input)).resolves.toBe("error");
  /** Stores active for this isolated provider verification. */
  let active = true;
  options.isActive = () => active;
  issueToken.mockImplementationOnce(async () => {active = false; return {token: "a".repeat(43), expiresAtMs: Date.now() + 60_000};});
  await expect(createFacebookReferralSharing(options)!.shareRace(input)).resolves.toBe("error");
  expect(shareAsync).not.toHaveBeenCalled();
  expect(reportFailure.mock.calls.map(([error]) => error.message)).toEqual(["facebook-native-share-failed", "facebook-native-share-failed"]);
});

it("rejects invalid destinations and failed image rendering before issuing a token", async () => {
  /** Stores options, issueToken, renderImage for this isolated provider verification. */
  const {options, issueToken, renderImage} = fixture();
  /** Stores capability for this isolated provider verification. */
  const capability = createFacebookReferralSharing(options)!;
  await expect(capability.shareRace({challengeId: "../unsafe", preview: {adjustedTimeToBeatMs: 1}})).resolves.toBe("error");
  await expect(capability.shareRace({challengeId: "valid", preview: {adjustedTimeToBeatMs: NaN}})).resolves.toBe("error");
  renderImage.mockReturnValueOnce("https://example.com/external-profile.png");
  await expect(capability.shareRace({challengeId: "valid", preview: {adjustedTimeToBeatMs: 1}})).resolves.toBe("error");
  expect(issueToken).not.toHaveBeenCalled();
});

it("shares results and profile invitations without promising a share-time reward or exposing identity", async () => {
  /** Stores options, shareAsync for this isolated provider verification. */
  const {options, shareAsync} = fixture();
  /** Stores done for this isolated provider verification. */
  let done!: () => void;
  shareAsync.mockImplementationOnce(async () => {done();});
  /** Stores shared for this isolated provider verification. */
  const shared = new Promise<void>(resolve => {done = resolve;});
  /** Stores capability for this isolated provider verification. */
  const capability = createFacebookReferralSharing(options)!;
  capability.shareResult({gameMode: "challenge", riddleId: "private-riddle-id", attempts: 2, emojiGrid: "🟩"});
  await shared;
  expect(shareAsync.mock.calls[0][0].data).toEqual({gameMode: "challenge", referralToken: "a".repeat(43)});
  expect(shareAsync.mock.calls[0][0].text).not.toMatch(/coins|register/i);
  await Promise.resolve();
  await Promise.resolve();
  /** Stores invited for this isolated provider verification. */
  let invited!: () => void;
  shareAsync.mockImplementationOnce(async () => {invited();});
  /** Stores invitation for this isolated provider verification. */
  const invitation = new Promise<void>(resolve => {invited = resolve;});
  capability.shareInvite();
  await invitation;
  expect(shareAsync.mock.calls[1][0]).toMatchObject({intent: "INVITE", data: {referralToken: "a".repeat(43)}});
});

it("shares a private PvP lobby through Meta's native friend challenge dialog", async () => {
  /** Isolated provider dialog records its opaque invitation entry data. */
  const {options, shareAsync, issueToken} = fixture();
  /** Server lobby handle carries no player identity or client-scored result. */
  const challengeId = `live_${"a".repeat(64)}`;
  await expect(createFacebookReferralSharing(options)!.shareLiveRace!({challengeId})).resolves.toBe("success");
  expect(shareAsync).toHaveBeenCalledWith(expect.objectContaining({intent: "CHALLENGE", switchContext: false,
    data: {challengeId}}));
  expect(issueToken).not.toHaveBeenCalled();
  expect(shareAsync.mock.calls[0][0].text).not.toContain("Time to beat");
});

it("rejects malformed live lobby handles before opening Meta UI", async () => {
  /** Invalid launch destinations must not reach the native provider dialog. */
  const {options, shareAsync} = fixture();
  await expect(createFacebookReferralSharing(options)!.shareLiveRace!({challengeId: "live_../ticket"})).resolves.toBe("error");
  expect(shareAsync).not.toHaveBeenCalled();
});
