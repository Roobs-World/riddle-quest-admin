import {describe, expect, it, jest} from "@jest/globals";
import {LiveRaceViewSchema, RACE_RULES, type ListRaceCategoriesResponse, type LiveRaceCapability, type LiveRaceView, type JoinLiveRace, type UpdateLiveRace} from "../../contracts/index";
import {LiveRaceController, type LiveRaceStorage} from "../LiveRaceController";
import {liveRaceInvitationUrl, parseLiveRaceInvitationUrl} from "../../../../platforms/native/android/src/entries/invitations";

/** Stable account lifetime distinct from opaque live ticket identities. */
const ownerId = "android-user";
/** Creates a schema-valid answer-free authoritative racing projection. */
const view = (): LiveRaceView => LiveRaceViewSchema.parse({ticketId: "a".repeat(64), phase: "racing", serverNowMs: 1000,
  searchEndsAtMs: 60000, startsAtMs: 0, player: {displayName: "Alice", avatarUrl: null, bot: false, correctCount: 0},
  opponent: {displayName: "Bob", avatarUrl: null, bot: false, correctCount: 0}, result: null, rewardCoins: 0,
  run: {runId: "run-1", role: "creator", status: "active", categoryId: "mixed", locale: "en", rules: RACE_RULES,
    correctCount: 0, wallElapsedMs: 1000, totalPenaltyMs: 0, adjustedElapsedMs: 1000, events: [],
    currentRiddle: {riddleId: "question-1", text: "Clue", answerLength: 4, position: 0, guessesUsed: 0,
      guessesRemaining: 5, hintAvailable: true, revealedLetters: [], confirmedGuesses: []}}});
/** Schema-valid reviewed category catalog with the immutable race rules. */
const catalog: ListRaceCategoriesResponse = {categories: [{categoryId: "mixed", nameKey: "RaceTo10.CATEGORY_MIXED_NAME",
  descriptionKey: "RaceTo10.CATEGORY_MIXED_DESCRIPTION", icon: "shuffle", colorToken: "#663399", availableRiddleCount: 20}], rules: RACE_RULES};
/** Builds isolated controller ports with explicit transport and storage behavior. */
function setup(options: {
  /** Scripted join behavior exposing stable retries and seat ownership. */
  join?: LiveRaceCapability["join"];
  /** Scripted authoritative command and poll behavior. */
  update?: LiveRaceCapability["update"];
  /** Optional private checkpoint port used by recovery scenarios. */
  storage?: LiveRaceStorage;
  /** Incoming opaque invitation to preview before joining. */
  challengeId?: string;
} = {}) {
  /** Scripted join behavior exposing stable retries and seat ownership. */
  const join = jest.fn<LiveRaceCapability["join"]>(options.join ?? (async () => view()));
  /** Scripted authoritative command and poll behavior. */
  const update = jest.fn<LiveRaceCapability["update"]>(options.update ?? (async () => view()));
  /** Records the original intent whose retirement permits navigation. */
  const retireJoin = jest.fn<NonNullable<LiveRaceCapability["retireJoin"]>>(async () => ({status: "retired"}));
  /** Returns a strict read-only invitation preview. */
  const challenge = jest.fn<NonNullable<LiveRaceCapability["challenge"]>>(async input => ({challengeId: input.challengeId, locale: "en", categoryId: "mixed",
    creator: view().player, expiresAtMs: Date.now() + 60_000, status: "available"}));
  /** Shared live controller under the account lifetime exercised here. */
  const controller = new LiveRaceController({ownerId, locale: "en", transport: {join, update, retireJoin, challenge},
    categories: async () => catalog, storage: options.storage, challengeId: options.challengeId});
  return {controller, join, update, retireJoin, challenge};
}
/** Drains receipt and optional storage microtasks without advancing server time. */
async function settle() {for (let i = 0; i < 20; i++) await Promise.resolve();}

describe("native-independent live multiplayer", () => {
  it("previews a shared invitation without occupying a seat until acceptance", async () => {
    /** Isolated controller and recorded transport ports for this scenario. */
    const fixture = setup({challengeId: `live_${"b".repeat(64)}`});
    await fixture.controller.start();
    expect(fixture.join).not.toHaveBeenCalled();
    /** Validated preview whose acceptance alone may occupy a seat. */
    const invitation = fixture.controller.getSnapshot().invitations[0]!;
    await fixture.controller.play(false, invitation);
    expect(fixture.join).toHaveBeenCalledWith(expect.objectContaining({challengeId: invitation.challengeId, expectedOwnerId: ownerId, retirementAware: true}));
    fixture.controller.dispose();
  });
  it("retries an interrupted join with the original request rather than creating another seat", async () => {
    /** Captured join selectors used to compare idempotent retries. */
    const joins: JoinLiveRace[] = [];
    /** Isolated controller and recorded transport ports for this scenario. */
    const fixture = setup({join: async input => {joins.push(input); if (joins.length === 1) throw new Error("offline"); return view();}});
    await fixture.controller.start(); await fixture.controller.play();
    expect(fixture.controller.getSnapshot().error).toBe(true);
    fixture.controller.retry(); await settle();
    expect(joins).toHaveLength(2); expect(joins[0]?.requestId).toBe(joins[1]?.requestId);
    expect(fixture.controller.getSnapshot().view?.ticketId).toBe("a".repeat(64));
    fixture.controller.dispose();
  });
  it("retries an uncertain guess exactly once by id while displaying only server-confirmed progress", async () => {
    /** Captured mutations used to detect accidental replay with a new identity. */
    const commands: UpdateLiveRace[] = [];
    /** Isolated controller and recorded transport ports for this scenario. */
    const fixture = setup({update: async input => {commands.push(input); if (commands.length === 1) throw new Error("offline");
      /** Changed server projection used to distinguish authority from local intent. */
      const next = view(); next.run!.currentRiddle!.guessesUsed = 1; next.run!.currentRiddle!.guessesRemaining = 4;
      next.run!.currentRiddle!.confirmedGuesses = [{guess: ["t", "e", "s", "t"], feedback: ["red", "red", "red", "red"]}]; return next;}});
    await fixture.controller.start(); await fixture.controller.play();
    fixture.controller.edit("text", "test"); fixture.controller.action("guess"); await settle();
    expect(fixture.controller.getSnapshot().view?.player.correctCount).toBe(0);
    fixture.controller.retry(); await settle();
    expect(commands).toHaveLength(2); expect(commands[0]).toEqual(commands[1]);
    expect(fixture.controller.getSnapshot().view?.run?.currentRiddle?.guessesUsed).toBe(1);
    expect(fixture.controller.getSnapshot().draft.letters).toEqual(["", "", "", ""]);
    fixture.controller.dispose();
  });
  it("requires explicit confirmation and original-intent retirement before leaving an active match", async () => {
    /** Isolated controller and recorded transport ports for this scenario. */
    const fixture = setup(); await fixture.controller.start(); await fixture.controller.play();
    fixture.controller.requestClose();
    expect(fixture.controller.getSnapshot().quitConfirmation).toBe(true);
    expect(fixture.retireJoin).not.toHaveBeenCalled();
    fixture.controller.cancelClose(); expect(fixture.controller.getSnapshot().quitConfirmation).toBe(false);
    await fixture.controller.close();
    expect(fixture.retireJoin).toHaveBeenCalledWith({requestId: fixture.join.mock.calls[0]![0].requestId, expectedOwnerId: ownerId});
    expect(fixture.controller.getSnapshot().closed).toBe(true); fixture.controller.dispose();
  });
  it("recovers the exact public ticket after process loss without replaying a guessed word", async () => {
    /** Device-private serialized bytes retained across controller lifetimes. */
    const values = new Map<string, string>();
    /** Optional private checkpoint port used by recovery scenarios. */
    const storage: LiveRaceStorage = {getItem: async key => values.get(key) ?? null,
      setItem: async (key, value) => {values.set(key, value);}, removeItem: async key => {values.delete(key);}};
    /** Original controller lifetime before simulated process loss. */
    const first = setup({storage}); await first.controller.start(); await first.controller.play(); await settle(); first.controller.dispose();
    /** Successor controller restoring the original owned join. */
    const second = setup({storage}); await second.controller.start();
    expect(second.join).toHaveBeenCalledWith(first.join.mock.calls[0]![0]);
    expect(second.controller.getSnapshot().view?.ticketId).toBe(first.controller.getSnapshot().view?.ticketId);
    expect(second.update).not.toHaveBeenCalled(); second.controller.dispose();
  });
  it("does not delete another owned race checkpoint when an untouched invitation preview closes", async () => {
    /** Shared private records retained across independently mounted race journeys. */
    const values = new Map<string, string>();
    /** Whole-record storage used by actual controller recovery. */
    const storage: LiveRaceStorage = {getItem: async key => values.get(key) ?? null,
      setItem: async (key, value) => {values.set(key, value);}, removeItem: async key => {values.delete(key);}};
    /** Existing acknowledged race and unsent draft before process loss. */
    const active = setup({storage}); await active.controller.start(); await active.controller.play();
    active.controller.edit("text", "te"); await settle(); active.controller.dispose();
    /** Exact retained bytes must survive viewing and dismissing another invitation. */
    const before = [...values.entries()];
    /** Different incoming preview never owns the existing race's retirement or checkpoint. */
    const preview = setup({storage, challengeId: `live_${"b".repeat(64)}`});
    await preview.controller.start(); await preview.controller.close();
    expect(preview.join).not.toHaveBeenCalled(); expect(preview.retireJoin).not.toHaveBeenCalled();
    expect([...values.entries()]).toEqual(before); preview.controller.dispose();
    /** Ordinary lobby recovery still restores the exact previous join and unsent input. */
    const recovered = setup({storage}); await recovered.controller.start();
    expect(recovered.join).toHaveBeenCalledWith(active.join.mock.calls[0]?.[0]);
    expect(recovered.controller.getSnapshot().draft.letters.join("")).toBe("te"); recovered.controller.dispose();
  });
  it("recovers a previously accepted matching invitation with its exact original join", async () => {
    /** Storage remains available after the accepted native view is lost. */
    const values = new Map<string, string>();
    /** Controller recovery reads and writes the same real serialized envelope. */
    const storage: LiveRaceStorage = {getItem: async key => values.get(key) ?? null,
      setItem: async (key, value) => {values.set(key, value);}, removeItem: async key => {values.delete(key);}};
    /** Exact incoming invitation previously accepted by an explicit press. */
    const challengeId = `live_${"c".repeat(64)}`;
    /** First view creates a join only after explicit invitation acceptance. */
    const first = setup({storage, challengeId}); await first.controller.start();
    await first.controller.play(false, first.controller.getSnapshot().invitations[0]); await settle(); first.controller.dispose();
    /** Cold view recovers that accepted intent, not a replacement invitation join. */
    const recovered = setup({storage, challengeId}); await recovered.controller.start();
    expect(recovered.join).toHaveBeenCalledWith(first.join.mock.calls[0]?.[0]); recovered.controller.dispose();
  });
  it("protects a matching accepted join while its cold checkpoint is still loading", async () => {
    /** Exact acknowledged join from a previous explicit acceptance. */
    const challengeId = `live_${"e".repeat(64)}`;
    /** Releases the delayed local lobby read after navigation checks its ownership. */
    let release: (raw: string | null) => void = () => {};
    /** Local checkpoint can be slower than a newly delivered direct link. */
    const read = new Promise<string | null>(resolve => {release = resolve;});
    /** Recovery stays protected without inventing a replacement server request. */
    const fixture = setup({challengeId, storage: {getItem: async key => key.endsWith(":draft") ? null : read,
      setItem: async () => {}, removeItem: async () => {}}});
    /** Pending startup has not yet established whether an accepted seat exists. */
    const startup = fixture.controller.start(); await settle();
    expect(fixture.controller.requiresRetirement()).toBe(true);
    fixture.controller.requestClose(); await fixture.controller.close();
    expect(fixture.controller.getSnapshot().closed).toBe(false);
    expect(fixture.retireJoin).not.toHaveBeenCalled();
    release(JSON.stringify({savedAtMs: Date.now(), join: {locale: "en", categoryId: "mixed", requestId: "accepted-before-process-loss",
      retirementAware: true, expectedOwnerId: ownerId, challengeId}}));
    await startup;
    expect(fixture.join).toHaveBeenCalledWith(expect.objectContaining({requestId: "accepted-before-process-loss", challengeId}));
    expect(fixture.controller.requiresRetirement()).toBe(true);
    await fixture.controller.close();
    expect(fixture.retireJoin).toHaveBeenCalledWith({requestId: "accepted-before-process-loss", expectedOwnerId: ownerId});
    expect(fixture.controller.getSnapshot().closed).toBe(true); fixture.controller.dispose();
  });
  it("never accepts arbitrary links or unvalidated challenge handles", () => {
    /** Valid opaque invitation handle used by URL boundary checks. */
    const id = `live_${"d".repeat(64)}`;
    expect(parseLiveRaceInvitationUrl(liveRaceInvitationUrl(id))).toBe(id);
    for (const url of ["https://attacker.test/race", `riddlequest://race?challengeId=${id}&uid=other`, "riddlequest://daily", "riddlequest://race?challengeId=bogus"])
      expect(parseLiveRaceInvitationUrl(url)).toBeNull();
  });
  it("does not let a retired startup recover a seat after the same controller is reactivated", async () => {
    /** Explicitly releases a held transport or storage observation. */
    let release: (value: string | null) => void = () => undefined;
    /** Storage result still owned by the retired startup. */
    const oldHint = new Promise<string | null>(resolve => {release = resolve;});
    /** Distinguishes the old delayed hint from the replacement mount's read. */
    let lobbyReads = 0;
    /** Isolated controller and recorded transport ports for this scenario. */
    const fixture = setup({storage: {getItem: async key => key.endsWith(":draft") ? null : ++lobbyReads === 1 ? oldHint : null,
      setItem: async () => undefined, removeItem: async () => undefined}});
    /** Pending startup whose late hint must not revive an old journey. */
    const oldStart = fixture.controller.start(); await settle();
    fixture.controller.dispose(); await fixture.controller.start();
    release(JSON.stringify({savedAtMs: Date.now(), join: {locale: "en", categoryId: "mixed", requestId: "retired-start-join",
      retirementAware: true, expectedOwnerId: ownerId, waitForPlayer: true, resumeTicketId: "a".repeat(64)}}));
    await oldStart;
    expect(fixture.join).not.toHaveBeenCalled();
    expect(fixture.controller.getSnapshot().categories).toHaveLength(1); fixture.controller.dispose();
  });
  it("keeps text composed while an earlier wrong guess awaits its receipt", async () => {
    /** Explicitly releases a held transport or storage observation. */
    let release: (value: LiveRaceView) => void = () => undefined;
    /** Held authority receipt used to compose newer input in flight. */
    const response = new Promise<LiveRaceView>(resolve => {release = resolve;});
    /** Isolated controller and recorded transport ports for this scenario. */
    const fixture = setup({update: async () => response});
    await fixture.controller.start(); await fixture.controller.play();
    fixture.controller.edit("text", "test"); fixture.controller.action("guess"); await settle();
    fixture.controller.edit("text", "ab");
    /** Changed server projection used to distinguish authority from local intent. */
    const next = view(); next.run!.currentRiddle!.guessesUsed = 1; next.run!.currentRiddle!.guessesRemaining = 4;
    release(next); await settle();
    expect(fixture.controller.getSnapshot().draft.letters).toEqual(["a", "b", "", ""]);
    fixture.controller.dispose();
  });
  it("requires a successful canonical refresh after the authority rejects a command", async () => {
    /** Counts admitted mutations and the required canonical refresh. */
    let updates = 0;
    /** Isolated controller and recorded transport ports for this scenario. */
    const fixture = setup({update: async () => {if (++updates === 1) throw {code: "functions/failed-precondition"}; return view();}});
    await fixture.controller.start(); await fixture.controller.play();
    fixture.controller.edit("text", "test"); fixture.controller.action("guess"); await settle();
    expect(fixture.controller.getSnapshot().requiresRefresh).toBe(true);
    expect(fixture.controller.getSnapshot().draft.letters.join("")).toBe("test");
    fixture.controller.action("guess"); await settle(); expect(updates).toBe(1);
    fixture.controller.retry(); await settle(); expect(fixture.controller.getSnapshot().requiresRefresh).toBe(false);
    fixture.controller.dispose();
  });

  it("throttles clock presentation without rounding authoritative action admission", async () => {
    /** Controllable monotonic clock independent of the device wall clock. */
    let now = 0;
    /** Canonical seat with a server-owned action availability deadline. */
    const current = view(); current.actionAvailableAtMs = 1500;
    /** Scripted authoritative command and poll behavior. */
    const update = jest.fn<LiveRaceCapability["update"]>(async () => current);
    /** Shared live controller under the account lifetime exercised here. */
    const controller = new LiveRaceController({ownerId, locale: "en", clock: () => now, clockPresentationIntervalMs: 1000,
      categories: async () => catalog, transport: {join: async () => current, update}});
    await controller.start(); await controller.play();
    /** Records externally published snapshots rather than private clock changes. */
    const listener = jest.fn();
    /** Removes the observer before retiring the test controller. */
    const unsubscribe = controller.subscribe(listener);
    controller.edit("text", "test"); listener.mockClear();
    now = 250; controller.tick();
    expect(listener).not.toHaveBeenCalled(); expect(controller.getSnapshot().now).toBe(1000);
    controller.action("guess"); await settle(); expect(update).not.toHaveBeenCalled();
    now = 501; controller.action("guess"); await settle();
    expect(update).toHaveBeenCalledWith(expect.objectContaining({action: "guess"}));
    unsubscribe(); controller.dispose();
  });

  it("advances private poll clocks without republishing unchanged native presentation", async () => {
    /** Controllable monotonic clock independent of the device wall clock. */
    let now = 0;
    /** Scripted authoritative command and poll behavior. */
    const update = jest.fn<LiveRaceCapability["update"]>(async () => {
      /** Changed server projection used to distinguish authority from local intent. */
      const next = view(); next.serverNowMs = 1500; next.run!.wallElapsedMs = 1500; next.run!.adjustedElapsedMs = 1500;
      return next;
    });
    /** Shared live controller under the account lifetime exercised here. */
    const controller = new LiveRaceController({ownerId, locale: "en", clock: () => now, clockPresentationIntervalMs: 1000,
      categories: async () => catalog, transport: {join: async () => view(), update}});
    await controller.start(); await controller.play(); await settle();
    /** Records externally published snapshots rather than private clock changes. */
    const listener = jest.fn();
    /** Removes the observer before retiring the test controller. */
    const unsubscribe = controller.subscribe(listener);
    now = 500; controller.tick(); await settle();
    expect(update).toHaveBeenCalledTimes(1); expect(listener).not.toHaveBeenCalled();
    now = 1100; controller.tick(); await settle();
    expect(controller.getSnapshot().now).toBe(2100); expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe(); controller.dispose();
  });

  it("shows a confirmed result when an outstanding guess finishes during quit confirmation", async () => {
    /** Releases the authoritative terminal receipt after the quit panel opens. */
    let release: (value: LiveRaceView) => void = () => undefined;
    /** Original command remains owned while the player considers leaving. */
    const response = new Promise<LiveRaceView>(resolve => {release = resolve;});
    /** Shared native presentation with an intentionally delayed accepted guess. */
    const fixture = setup({update: async () => response});
    await fixture.controller.start(); await fixture.controller.play();
    fixture.controller.edit("text", "test"); fixture.controller.action("guess"); await settle();
    fixture.controller.requestClose(); expect(fixture.controller.getSnapshot().quitConfirmation).toBe(true);
    /** Only the server's terminal projection may dismiss the obsolete quit question. */
    const result = view(); result.phase = "result"; result.result = "win"; result.rewardCoins = 50; result.run = null;
    release(result); await settle();
    expect(fixture.controller.getSnapshot().view?.result).toBe("win");
    expect(fixture.controller.getSnapshot().quitConfirmation).toBe(false);
    fixture.controller.dispose();
  });

});
