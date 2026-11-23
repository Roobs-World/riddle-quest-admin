import {createFacebookContextChallenges} from "../contextChallenges";
import type {FacebookInstantSdk} from "../fbinstant";
import type {JoinLiveRace, LiveRaceCapability, RaceLocale} from "@riddle-quest/core/race";
import {runFacebookSdkDialog} from "../FacebookSdkDialogGate";

/** Server-issued opaque invitations never expose identities or answers. */
const challengeId = `live_${"a".repeat(64)}`;
/** Shared private selection exercises the real transport composition. */
const input: JoinLiveRace = {requestId: "context-challenge-request", locale: "en", categoryId: "history", createChallenge: true};

/** SDK and backend seams retain independently mutable native context and account lifetime. */
function fixture() {
  /** Mutable native selection simulates an external overlay action. */
  let contextId = "chosen-group";
  /** Language changes retire the immutable private journey. */
  let locale: RaceLocale = "en";
  /** Deletion retires all native work. */
  let active = true;
  /** Provider delivery settles independently of server acceptance. */
  const updateAsync = jest.fn(async (_payload: unknown) => undefined);
  /** Ordinary public join is never rewritten by the chosen transport. */
  const ordinaryJoin = jest.fn(async (_input: JoinLiveRace) => ({challengeId}));
  /** Original authority receives the immutable private inputs. */
  const join = jest.fn(async (_input: JoinLiveRace) => ({challengeId}));
  /** Normal native invitations retain their existing behavior. */
  const shareChallenge = jest.fn(async () => "success" as const);
  /** SDK state is independent of the coordinator response. */
  const sdk = {getSupportedAPIs: () => ["updateAsync"], updateAsync,
    context: {getID: () => contextId, getType: () => "GROUP"}} as unknown as FacebookInstantSdk;
  /** Native selection returns the actual immutable audience. */
  const chooseContext = jest.fn(async () => ({status: "success" as const, value: {contextId, contextType: "GROUP" as const}}));
  /** Membership reconciliation is required before a private join. */
  const ensureCurrent = jest.fn(async () => ({status: "success" as const, value: {contextId, contextType: "GROUP" as const}}));
  /** Existing public transport remains separate from the original authority seam. */
  const live = {join: ordinaryJoin, shareChallenge, update: jest.fn()} as unknown as LiveRaceCapability;
  /** Explicit configuration gates all native context challenge functionality. */
  const options = {sdk, coordinator: {chooseContext, ensureCurrent}, live, join: join as LiveRaceCapability["join"],
    template: "race_challenge_test", enabled: true, ageCategory: "13_plus" as const, getLocale: () => locale, isActive: () => active,
    renderImage: jest.fn(() => "data:image/png;base64,YQ=="), reportFailure: jest.fn()};
  return {options, join, ordinaryJoin, shareChallenge, updateAsync, chooseContext, ensureCurrent,
    context: (value: string) => {contextId = value;}, locale: (value: RaceLocale) => {locale = value;}, retire: () => {active = false;}};
}

/** Successful native selection returns an audience-bound private transport. */
async function selected(f: ReturnType<typeof fixture>) {
  /** Exercise production selection, not an invented caller context. */
  const result = await createFacebookContextChallenges(f.options)!();
  if (result.status !== "success") throw new Error("Fixture selection failed");
  return result.value;
}

it("starts only a private server lobby and explicitly sends its handle to the chosen native context", async () => {
  /** Public matching and native invitations stay independently usable. */
  const f = fixture(), bound = await selected(f);
  await bound.join({...input, createChallenge: false, facebookContextId: "forged"});
  expect(f.join).toHaveBeenCalledWith({...input, facebookContextId: "chosen-group"});
  expect(f.updateAsync).not.toHaveBeenCalled();
  await expect(bound.shareChallenge!({challengeId})).resolves.toBe("success");
  expect(f.updateAsync).toHaveBeenCalledWith({action: "CUSTOM", template: "race_challenge_test", image: "data:image/png;base64,YQ==",
    text: {default: "Race to 10 · Challenge a friend", localizations: {en_US: "Race to 10 · Challenge a friend"}},
    data: {challengeId}, strategy: "IMMEDIATE", notification: "NO_PUSH"});
  expect(f.ordinaryJoin).not.toHaveBeenCalled(); expect(f.shareChallenge).not.toHaveBeenCalled();
  await f.options.live.join(input); expect(f.ordinaryJoin).toHaveBeenCalledWith(input);
  await bound.shareChallenge!({challengeId}); expect(f.updateAsync).toHaveBeenCalledTimes(1);
});

it.each([undefined, "", "invalid template"])("requires explicit dashboard configuration (%s)", template => {
  /** No configured template means the ordinary transport alone remains available. */
  const f = fixture();
  expect(createFacebookContextChallenges({...f.options, template})).toBeUndefined();
  expect(f.chooseContext).not.toHaveBeenCalled();
});

it("independently requires SDK advertisement, a callable API, multiplayer and a known audience", () => {
  /** Each gate excludes the native chooser before a private seat can exist. */
  const f = fixture();
  expect(createFacebookContextChallenges({...f.options, enabled: false})).toBeUndefined();
  expect(createFacebookContextChallenges({...f.options, ageCategory: "unknown"})).toBeUndefined();
  f.options.sdk.getSupportedAPIs = () => [];
  expect(createFacebookContextChallenges(f.options)).toBeUndefined();
  f.options.sdk.getSupportedAPIs = () => ["updateAsync"]; delete f.options.sdk.updateAsync;
  expect(createFacebookContextChallenges(f.options)).toBeUndefined();
});

it("dismisses a native choice without creating or sharing a seat", async () => {
  /** Cancellation is a normal provider outcome. */
  const f = fixture();
  f.chooseContext.mockResolvedValueOnce({status: "cancelled"} as never);
  await expect(createFacebookContextChallenges(f.options)!()).resolves.toEqual({status: "cancelled"});
  expect(f.join).not.toHaveBeenCalled(); expect(f.updateAsync).not.toHaveBeenCalled();
});

it.each(["context", "locale", "account"])("retires private join and sharing after %s changes", async change => {
  /** The successful server handle cannot be redirected into a newly selected audience. */
  const f = fixture(), bound = await selected(f);
  await bound.join(input);
  if (change === "context") f.context("another-group");
  else if (change === "locale") f.locale("fr"); else f.retire();
  await expect(bound.join(input)).rejects.toThrow("private-context-changed");
  await expect(bound.shareChallenge!({challengeId})).resolves.toBe("error");
  expect(f.join).toHaveBeenCalledTimes(1); expect(f.updateAsync).not.toHaveBeenCalled();
});

it("rechecks native state after membership delivery and before native dispatch", async () => {
  /** A native switch during reconciliation must not start the wrong private seat. */
  const f = fixture(), bound = await selected(f);
  f.ensureCurrent.mockImplementationOnce(async () => {f.context("changed-during-membership");
    return {status: "success", value: {contextId: "chosen-group", contextType: "GROUP"}};});
  await expect(bound.join(input)).rejects.toThrow("private-context-changed");
  expect(f.join).not.toHaveBeenCalled();
  f.context("chosen-group"); await bound.join(input);
  f.options.renderImage.mockImplementationOnce(() => {f.context("changed-during-render"); return "data:image/png;base64,YQ==";});
  await expect(bound.shareChallenge!({challengeId})).resolves.toBe("error");
  expect(f.updateAsync).not.toHaveBeenCalled();
});

it("rejects foreign handles, incoming/rematch joins and failed authority deliveries", async () => {
  /** Only a successful owned private creation registers a handle for native delivery. */
  const f = fixture(), bound = await selected(f);
  await expect(bound.shareChallenge!({challengeId})).resolves.toBe("error");
  await expect(bound.join({...input, challengeId})).rejects.toThrow("private-context-changed");
  await expect(bound.join({...input, rematchOfTicketId: "b".repeat(64)})).rejects.toThrow("private-context-changed");
  f.join.mockRejectedValueOnce(new Error("private server diagnostic"));
  await expect(bound.join(input)).rejects.toThrow("private server diagnostic");
  await expect(bound.shareChallenge!({challengeId})).resolves.toBe("error");
  expect(f.updateAsync).not.toHaveBeenCalled();
});

it("shares native dialog exclusion and never automatically retries an uncertain update", async () => {
  /** A held provider surface blocks context delivery without falling back to another audience. */
  const f = fixture(), bound = await selected(f);
  await bound.join(input);
  /** Only native settlement releases shared SDK occupancy. */
  let release!: () => void;
  /** Occupied native UI owns the same SDK instance. */
  const held = runFacebookSdkDialog(f.options.sdk, () => new Promise(resolve => {release = () => resolve({status: "success", value: undefined});}));
  await expect(bound.shareChallenge!({challengeId})).resolves.toBe("error");
  expect(f.updateAsync).not.toHaveBeenCalled(); release(); await held;
  f.updateAsync.mockRejectedValueOnce(new Error("private native diagnostic"));
  await expect(bound.shareChallenge!({challengeId})).resolves.toBe("error");
  expect(f.updateAsync).toHaveBeenCalledTimes(1);
  expect(f.options.reportFailure).toHaveBeenCalledWith(new Error("facebook-private-context-delivery-failed"));
  // A further explicit player action can retry the same handle; SDK completion is not delivery proof.
  await expect(bound.shareChallenge!({challengeId})).resolves.toBe("success");
  expect(f.updateAsync).toHaveBeenCalledTimes(2);
});
