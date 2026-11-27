import {createFacebookTournamentPresentation} from "../FacebookTournamentPresentation";
import {createFacebookAdsCapability} from "../FacebookAdsCapability";
import type {FacebookInstantSdk, FacebookInstantTournament} from "../fbinstant";
import type {ListFacebookTournamentResponse} from "../../../../../src/races/contracts/index";

/** Both production adapters share the same SDK instance and native dialog gate. */
const fixture = () => {
  /** Exact official UTC window and opaque native metadata. */
  const startsAtMs = Date.parse("2026-10-01T00:00:00Z"), endsAtMs = startsAtMs + 86400000;
  /** Server-owned current-player best. */
  const currentPlayer = {rank: 1, adjustedTimeMs: 9000, isCurrentPlayer: true};
  /** Official standings never originate from native SDK scores. */
  const board: ListFacebookTournamentResponse = {tournamentId: "facebook-race10-en-2026-10-01", locale: "en", startsAtMs,
    endsAtMs, sortOrder: "LOWER_IS_BETTER", rewardsEnabled: false, currentPlayer, standings: [currentPlayer]};
  /** Native metadata matches only the exact official scope. */
  const native: FacebookInstantTournament = {getID: () => "native-1", getContextID: () => "context-1", getEndTime: () => endsAtMs / 1000,
    getPayload: () => ({kind: "rq-race10-tournament-v1", locale: "en", tournamentId: board.tournamentId, startsAtMs, endsAtMs})};
  /** Only advertised callable SDK APIs can admit either production dialog. */
  const sdk = {getSupportedAPIs: () => ["getTournamentAsync", "tournament.createAsync", "tournament.shareAsync", "tournament.postScoreAsync",
    "getRewardedVideoAsync"],
    context: {getID: () => "context-1"}, getTournamentAsync: jest.fn(async () => native),
    tournament: {shareAsync: jest.fn(async () => undefined), createAsync: jest.fn(async () => native), postScoreAsync: jest.fn(async () => undefined)},
    getRewardedVideoAsync: jest.fn(async () => ({loadAsync: async () => undefined, showAsync: async () => undefined}))} as unknown as FacebookInstantSdk;
  /** Standings, optional diagnostics and native image rendering remain independently controllable. */
  const options = {sdk, enabled: true, ageCategory: "13_plus" as const, isActive: () => true, getLocale: () => "en" as const,
    list: jest.fn(async () => board), now: () => startsAtMs + 1000, renderImage: jest.fn(() => "data:image/png;base64,YQ=="), reportFailure: jest.fn()};
  return {options, sdk, board, native};
};

it.each(["standings", "metadata"])("releases the shared native dialog gate after stalled %s preparation", async stage => {
  jest.useFakeTimers();
  /** The two real adapters own one SDK instance. */
  const {options, sdk, board, native} = fixture();
  /** Explicit admission identifies the original stalled read. */
  let admit!: () => void;
  /** Original read is released only after local expiry and second-adapter recovery. */
  let release!: () => void;
  /** No fixed promise depth chooses the preparation phase. */
  const ready = new Promise<void>(resolve => {admit = resolve;});
  if (stage === "standings") options.list.mockImplementationOnce(() => new Promise(resolve => {release = () => resolve(board); admit();}));
  else jest.mocked(sdk.getTournamentAsync!).mockImplementationOnce(() => new Promise(resolve => {release = () => resolve(native); admit();}));
  /** Tournament sharing acquires the original native slot. */
  const tournaments = createFacebookTournamentPresentation(options)!;
  /** Rewarded ads exercise the actual independent adapter and gate. */
  const ads = createFacebookAdsCapability({sdk, placementId: "", rewardedPlacementId: "continue", rewardedEnabled: true, adFree: false})!;
  /** Retain the original local share completion. */
  const original = tournaments.share("en");
  try {
    await ready;
    await expect(ads.showRewarded("continue")).resolves.toMatchObject({status: "unavailable"});
    await jest.advanceTimersByTimeAsync(7999);
    await expect(ads.showRewarded("continue")).resolves.toMatchObject({status: "unavailable"});
    await jest.advanceTimersByTimeAsync(1);
    await expect(ads.showRewarded("continue")).resolves.toMatchObject({status: "success"});
    await expect(original).resolves.toMatchObject({status: "retryable-failure"});
    expect(sdk.getRewardedVideoAsync).toHaveBeenCalledTimes(1);
    release(); await jest.advanceTimersByTimeAsync(0);
    expect(sdk.tournament!.shareAsync).not.toHaveBeenCalled();
    expect(sdk.tournament!.createAsync).not.toHaveBeenCalled();
    expect(sdk.getTournamentAsync).toHaveBeenCalledTimes(stage === "metadata" ? 1 : 0);
    expect(jest.getTimerCount()).toBe(0);
  } finally {
    release(); await original; jest.useRealTimers();
  }
});

it("shares one eight-second budget across standings and native metadata", async () => {
  jest.useFakeTimers();
  /** Original standings and metadata consume one shared preparation budget. */
  const {options, sdk, board, native} = fixture();
  /** Release the first read halfway through the budget. */
  let releaseStandings!: () => void;
  /** Release metadata only after the original share has expired. */
  let releaseMetadata!: () => void;
  /** The first read signals actual admission. */
  let admitStandings!: () => void;
  /** The second read signals actual admission. */
  let admitMetadata!: () => void;
  /** Exact first-stage admission avoids scheduling guesses. */
  const standingsReady = new Promise<void>(resolve => {admitStandings = resolve;});
  /** Exact second-stage admission preserves the original budget anchor. */
  const metadataReady = new Promise<void>(resolve => {admitMetadata = resolve;});
  options.list.mockImplementationOnce(() => new Promise(resolve => {releaseStandings = () => resolve(board); admitStandings();}));
  jest.mocked(sdk.getTournamentAsync!).mockImplementationOnce(() => new Promise(resolve => {releaseMetadata = () => resolve(native); admitMetadata();}));
  /** The original shared slot belongs to tournament preparation. */
  const original = createFacebookTournamentPresentation(options)!.share("en");
  /** Another real SDK adapter can retry once that original slot is released. */
  const ads = createFacebookAdsCapability({sdk, placementId: "", rewardedPlacementId: "continue", rewardedEnabled: true, adFree: false})!;
  try {
    await standingsReady; await jest.advanceTimersByTimeAsync(4000); releaseStandings(); await metadataReady;
    await jest.advanceTimersByTimeAsync(3999);
    await expect(ads.showRewarded("continue")).resolves.toMatchObject({status: "unavailable"});
    await jest.advanceTimersByTimeAsync(1);
    await expect(ads.showRewarded("continue")).resolves.toMatchObject({status: "success"});
    await expect(original).resolves.toMatchObject({status: "retryable-failure"});
    releaseMetadata(); await jest.advanceTimersByTimeAsync(0);
    expect(sdk.tournament!.shareAsync).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(0);
  } finally {
    releaseStandings(); releaseMetadata(); await original; jest.useRealTimers();
  }
});

it.each(["share", "create", "cancelled", "failure"])("retains admitted native %s dialog occupancy past preparation expiry", async kind => {
  jest.useFakeTimers();
  /** Native dialogs have their own provider-defined completion. */
  const {options, sdk, native} = fixture();
  if (kind === "create") jest.mocked(sdk.getTournamentAsync!).mockRejectedValueOnce({code: "TOURNAMENT_NOT_FOUND"});
  /** Confirm actual native dialog admission before advancing clocks. */
  let admit!: () => void;
  /** Complete the original native dialog with its exact provider result. */
  let release!: () => void;
  /** The active dialog boundary is independent of the read deadline. */
  const ready = new Promise<void>(resolve => {admit = resolve;});
  if (kind === "create") jest.mocked(sdk.tournament!.createAsync).mockImplementationOnce(() => new Promise(resolve => {release = () => resolve(native); admit();}));
  else jest.mocked(sdk.tournament!.shareAsync).mockImplementationOnce(() => new Promise((resolve,reject) => {
    release = () => kind === "cancelled" ? reject({code: "USER_CANCELLED"}) : kind === "failure" ? reject(new Error("Native share failure")) : resolve(); admit();
  }));
  /** Original sharing occupies one native SDK dialog slot. */
  const controller = new AbortController();
  /** Retirement after native admission cannot free the occupied SDK slot. */
  const original = createFacebookTournamentPresentation(options)!.share("en", controller.signal);
  /** Independent rewarded ads must remain excluded while the dialog is open. */
  const ads = createFacebookAdsCapability({sdk, placementId: "", rewardedPlacementId: "continue", rewardedEnabled: true, adFree: false})!;
  try {
    await ready; controller.abort();
    expect(jest.getTimerCount()).toBe(0);
    await jest.advanceTimersByTimeAsync(16000);
    await expect(ads.showRewarded("continue")).resolves.toMatchObject({status: "unavailable"});
    release();
    await expect(original).resolves.toMatchObject({status: kind === "cancelled" ? "cancelled" : kind === "failure" ? "retryable-failure" : "success"});
    await expect(ads.showRewarded("continue")).resolves.toMatchObject({status: "success"});
    expect(jest.getTimerCount()).toBe(0);
  } finally {
    release(); await original; jest.useRealTimers();
  }
});

it("contains an optional reporter fault while completing expired preparation", async () => {
  jest.useFakeTimers();
  /** Optional diagnostics cannot change the provider result or native slot recovery. */
  const {options, sdk, board} = fixture();
  /** Observe the exact read admission. */
  let admit!: () => void;
  /** Complete the original read only after its local preparation ends. */
  let release!: () => void;
  /** No promise-depth assumptions choose this phase. */
  const ready = new Promise<void>(resolve => {admit = resolve;});
  options.list.mockImplementationOnce(() => new Promise(resolve => {release = () => resolve(board); admit();}));
  options.reportFailure.mockImplementationOnce(() => {throw new Error("Optional reporter unavailable");});
  /** Both possible outcomes are observed before the injected callback fault occurs. */
  const observed = createFacebookTournamentPresentation(options)!.share("en").then(value => ({value}), error => ({error}));
  try {
    await ready; await jest.advanceTimersByTimeAsync(8000);
    await expect(observed).resolves.toEqual({value: {status: "retryable-failure", message: "facebook-tournament-share-failed"}});
    await expect(createFacebookAdsCapability({sdk, placementId: "", rewardedPlacementId: "continue", rewardedEnabled: true, adFree: false})!.showRewarded("continue")).resolves.toMatchObject({status: "success"});
    expect(jest.getTimerCount()).toBe(0);
  } finally {
    release(); await observed; jest.useRealTimers();
  }
});


it.each(["standings", "metadata"])("retires %s preparation immediately without admitting a late dialog", async stage => {
  jest.useFakeTimers();
  /** Retiring presentation must not cancel a remotely executing SDK read. */
  const {options, sdk, board, native} = fixture();
  /** Admission signals distinguish real preparation from a scheduling guess. */
  let admit!: () => void;
  /** The original promise settles only after its local owner has retired. */
  let release!: () => void;
  /** Explicitly observed original read admission. */
  const ready = new Promise<void>(resolve => {admit = resolve;});
  if (stage === "standings") options.list.mockImplementationOnce(() => new Promise(resolve => {release = () => resolve(board); admit();}));
  else jest.mocked(sdk.getTournamentAsync!).mockImplementationOnce(() => new Promise(resolve => {release = () => resolve(native); admit();}));
  /** Board-owned cancellation applies only before native UI admission. */
  const controller = new AbortController();
  /** Target adapter owns the optional preparation-cancellation contract. */
  const share = createFacebookTournamentPresentation(options)!.share;
  /** Original operation and rewarded ad adapter share the real SDK gate. */
  const original = share("en", controller.signal), ads = createFacebookAdsCapability({sdk, placementId: "", rewardedPlacementId: "continue", rewardedEnabled: true, adFree: false})!;
  try {
    await ready; controller.abort(); await jest.advanceTimersByTimeAsync(0);
    await expect(ads.showRewarded("continue")).resolves.toMatchObject({status: "success"});
    await expect(original).resolves.toMatchObject({status: "cancelled"});
    expect(jest.getTimerCount()).toBe(0);
    release(); await jest.advanceTimersByTimeAsync(0);
    expect(sdk.tournament!.shareAsync).not.toHaveBeenCalled();
    expect(sdk.tournament!.createAsync).not.toHaveBeenCalled();
    expect(sdk.getTournamentAsync).toHaveBeenCalledTimes(stage === "metadata" ? 1 : 0);
    expect(options.reportFailure).not.toHaveBeenCalled();
  } finally {release(); await jest.advanceTimersByTimeAsync(8000); await original; jest.useRealTimers();}
});


it("does not admit preparation for an already retired board", async () => {
  /** No provider read or deadline is needed after explicit retirement. */
  const {options, sdk} = fixture();
  /** The original owner has already committed retirement. */
  const controller = new AbortController(); controller.abort();
  await expect(createFacebookTournamentPresentation(options)!.share("en", controller.signal)).resolves.toMatchObject({status: "cancelled"});
  expect(options.list).not.toHaveBeenCalled();
  expect(sdk.getTournamentAsync).not.toHaveBeenCalled();
  await expect(createFacebookAdsCapability({sdk, placementId: "", rewardedPlacementId: "continue", rewardedEnabled: true, adFree: false})!.showRewarded("continue")).resolves.toMatchObject({status: "success"});
});
