import {describe, expect, it} from "@jest/globals";
import {RacePlay} from "../RacePlay";
import type {GameToHostMessage} from "@riddle-quest/core/bridge";
import {catalog, harness, racing} from "./raceSession.support";

describe("Race Session outbound journey ownership", () => {
  it.each(["begin", "send", "pending"] as const)("does not deliver an old start after account replacement during %s notification", async boundary => {
    /** Catalog is ready before the original owner initiates preparation. */
    const h = harness(); h.respond("raceCategories", await catalog());
    if (boundary === "send") h.session.reportError("original-error");
    /** Exactly one synchronous observer replaces the originating lifetime. */
    let changed = false;
    /** Capture outbound commands only after initiating this selected journey. */
    const count = h.commands.length;
    /** Each predicate isolates a different state publication before host delivery. */
    const unsubscribe = h.session.subscribe(() => {
      /** Snapshot belongs to the observed state notification. */
      const state = h.session.getSnapshot();
      if (!changed && state.stage === "countdown" && (boundary === "begin" ||
        boundary === "send" && state.error === null || boundary === "pending" && state.pending === "raceStart")) {
        changed = true; h.session.enter({locale: "en", ownerId: "owner-2"});
      }
    });
    h.session.begin("mixed"); unsubscribe();
    expect(changed).toBe(true);
    expect(h.commands.slice(count).map(command => command.type)).toEqual(["game:listRaceCategories"]);
    expect(h.session.getSnapshot()).toMatchObject({run: null, stage: "categories", pending: "raceCategories", error: null});
    expect(h.timers.size).toBe(1);
    h.respond("raceCategories", await catalog()); h.session.retry();
    expect(h.last().type).toBe("game:listRaceCategories");
  });

  it.each(["submit", "hint", "skip"] as const)("does not deliver a projected %s from the old account", async operation => {
    /** Complete deck allows immediate feedback before the authority mutation is dispatched. */
    const h = await racing(); h.session.input("text", "piano");
    /** The original public authority checkpoint identifies its provisional replacement. */
    const before = h.session.getSnapshot(), count = h.commands.length;
    /** Replacement happens once on the immediate local projection notification. */
    let changed = false;
    /** Observer can synchronously change authenticated lifetime before the old action sends. */
    const unsubscribe = h.session.subscribe(() => {
      if (!changed && h.session.getSnapshot().run !== before.run) {
        changed = true; h.session.enter({locale: "en", ownerId: "owner-2"});
      }
    });
    h.session[operation](); unsubscribe();
    expect(changed).toBe(true);
    expect(h.commands.slice(count).map(command => command.type)).toEqual(["game:listRaceCategories"]);
    expect(h.session.getSnapshot()).toMatchObject({run: null, stage: "categories", pending: "raceCategories", error: null});
    expect(h.timers.size).toBe(1);
  });

  it("stops selection effects and start delivery when the selection adapter changes account", async () => {
    /** Optional selection analytics can synchronously replace the authenticated journey. */
    let h: ReturnType<typeof harness>;
    h = harness({}, null, {effect: effect => {
      if (effect.kind === "analytics" && effect.event === "race_category_selected") h.session.enter({locale: "en", ownerId: "owner-2"});
    }});
    h.respond("raceCategories", await catalog());
    /** No old selection may continue dispatching into the replacement account. */
    const count = h.commands.length;
    h.session.begin("mixed");
    expect(h.commands.slice(count).map(command => command.type)).toEqual(["game:listRaceCategories"]);
    expect(h.session.getSnapshot()).toMatchObject({pending: "raceCategories", stage: "categories", run: null});
    expect(h.timers.size).toBe(1);
  });

  it("does not invoke provider discovery after its searching observer replaces the account", async () => {
    /** Discovery must remain owned even before calling the authenticated provider adapter. */
    const h = harness(); h.respond("raceCategories", await catalog());
    /** Count genuine adapter side effects rather than only their ignored responses. */
    let finds = 0, changed = false;
    /** Observer invalidates this search before its network request starts. */
    const unsubscribe = h.session.subscribe(() => {
      if (!changed && h.session.getSnapshot().findingOpponent) {
        changed = true; h.session.enter({locale: "en", ownerId: "owner-2"});
      }
    });
    await h.session.findOpponent({find: async () => {finds++; return {status: "cancelled" as const};}}, "mixed"); unsubscribe();
    expect(changed).toBe(true); expect(finds).toBe(0);
    expect(h.session.getSnapshot()).toMatchObject({pending: "raceCategories", findingOpponent: false});
    expect(h.timers.size).toBe(1);
  });
  it.each(["navigate", "rematch", "safety", "retry"] as const)("stops old %s continuation after account replacement", async operation => {
    /** Navigation/selection and owned mutation retry start from their real public states. */
    const h = operation === "rematch" ? await racing() : harness();
    if (operation !== "rematch") h.respond("raceCategories", await catalog());
    if (operation === "retry") {h.session.begin("mixed"); h.reject("raceStart", "lost-start");}
    /** One state notification replaces the account before the following command is sent. */
    let changed = false;
    /** Only command dispatch from this action is compared. */
    const count = h.commands.length;
    /** Each observed action publishes a distinguishing public state. */
    const unsubscribe = h.session.subscribe(() => {
      /** The observer never examines private command or retry storage. */
      const state = h.session.getSnapshot();
      if (!changed && (operation === "navigate" && state.stage === "inbox" ||
        operation === "rematch" && state.run === null || operation === "safety" && state.safetyTargetUserId === "rival" ||
        operation === "retry" && state.stage === "countdown")) {
        changed = true; h.session.enter({locale: "en", ownerId: "owner-2"});
      }
    });
    expect(() => {
      if (operation === "navigate") h.session.navigate("inbox");
      else if (operation === "rematch") h.session.rematch();
      else if (operation === "retry") h.session.retry();
      else h.session.safety("block", {itemId: "safety-item", challengeId: "safety-challenge", opponentUserId: "rival",
        opponentDisplayName: "Rival", categoryId: "history", result: "win", adjustedDeltaMs: 1000, read: false, createdAtMs: 0});
    }).not.toThrow(); unsubscribe();
    expect(changed).toBe(true);
    expect(h.commands.slice(count).map(command => command.type)).toEqual(["game:listRaceCategories"]);
    expect(h.session.getSnapshot()).toMatchObject({pending: "raceCategories", stage: "categories", run: null});
    expect(h.timers.size).toBe(1);
  });

  it("reserves the original guess before an observer tries to submit its provisional successor", async () => {
    /** Complete deck makes the next question visible before the first host reply. */
    const h = await racing(); h.session.input("text", "piano");
    /** Exactly one observer attempts a nested successor mutation. */
    let nested = false;
    /** Pure local notifications cannot issue a second mutation before the first receipt. */
    const unsubscribe = h.session.subscribe(() => {
      if (!nested && h.session.getSnapshot().run?.currentRiddle?.position === 1) {
        nested = true; h.session.input("text", "clock"); h.session.submit();
      }
    });
    h.session.submit(); unsubscribe();
    expect(nested).toBe(true);
    expect(h.commands.filter(command => command.type === "game:submitRaceGuess")).toHaveLength(1);
    expect(h.last()).toMatchObject({payload: {riddleId: h.run.currentRiddle!.riddleId, guess: "piano"}});
    expect(h.session.getSnapshot()).toMatchObject({pending: "raceGuess", run: {currentRiddle: {position: 1}}});
  });

  it.each([false, true])("does not post or retain a timer for a replaced private delivery, successor=%s", successor => {
    /** Outbound messages are captured independently of the session coordinator. */
    const commands: GameToHostMessage[] = [];
    /** Timer handles reveal leaks from a superseded send continuation. */
    const timers = new Map<number, () => void>();
    /** Unique timer and mutation identities retain each expected delivery. */
    let sequence = 0, replaced = false;
    /** Real gameplay delivery seam with observer-controlled disposal/replacement. */
    const play = new RacePlay({postToHost: command => {commands.push(command);},
      requestId: operation => `${operation}-${++sequence}`, onDeliveryFailure: () => {},
      clock: {now: () => 0, schedule: callback => {
        /** Unique owned expiry handle. */
        const id = ++sequence; timers.set(id, callback); return id;
      }, cancel: id => {timers.delete(id);}}});
    /** Pending-state publication is deliberately synchronous before host dispatch. */
    const unsubscribe = play.subscribe(() => {
      if (!replaced && play.getSnapshot().pending === "raceGuess") {
        replaced = true; play.dispose();
        if (successor) play.send("raceCategories", "game:listRaceCategories", {locale: "en"});
      }
    });
    play.send("raceGuess", "game:submitRaceGuess", {runId: "old", riddleId: "q-0", guess: "test"}); unsubscribe();
    expect(commands.map(command => command.type)).toEqual(successor ? ["game:listRaceCategories"] : []);
    expect(timers.size).toBe(successor ? 1 : 0);
    expect(play.getSnapshot()).toMatchObject({pending: successor ? "raceCategories" : null, raceGuessLoading: false});
  });

  it("stops an original start after its recovery adapter replaces the account", async () => {
    /** Recovery adapters are synchronous optional storage integrations. */
    let h: ReturnType<typeof harness>, changed = false;
    h = harness({}, null, {recovery: {read: () => null, clear: () => {}, save: record => {
      if (!changed && record.intent.kind === "start") {changed = true; h.session.enter({locale: "en", ownerId: "owner-2"});}
    }}});
    h.respond("raceCategories", await catalog());
    /** A saved intent is valid only for the account which selected it. */
    const count = h.commands.length;
    h.session.begin("mixed");
    expect(changed).toBe(true);
    expect(h.commands.slice(count).map(command => command.type)).toEqual(["game:listRaceCategories"]);
    expect(h.session.getSnapshot()).toMatchObject({pending: "raceCategories", run: null});
    expect(h.timers.size).toBe(1);
  });

  it("does not overwrite replacement search state after the recovery adapter changes account", async () => {
    /** A search hint write is another synchronous optional adapter boundary. */
    let h: ReturnType<typeof harness>, changed = false, finds = 0;
    h = harness({}, null, {recovery: {read: () => null, clear: () => {}, save: record => {
      if (!changed && record.intent.kind === "search") {changed = true; h.session.enter({locale: "en", ownerId: "owner-2"});}
    }}});
    h.respond("raceCategories", await catalog());
    await h.session.findOpponent({find: async () => {finds++; return {status: "cancelled" as const};}}, "mixed");
    expect(changed).toBe(true); expect(finds).toBe(0);
    expect(h.session.getSnapshot()).toMatchObject({pending: "raceCategories", findingOpponent: false, matchSearchStatus: "idle"});
    expect(h.timers.size).toBe(1);
  });

});
