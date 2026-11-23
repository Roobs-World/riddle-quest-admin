import {describe, expect, it} from "@jest/globals";
import {catalog, fixture, harness, racing} from "./raceSession.support.ts";

describe("Race Session loader ownership", () => {
  it("keeps a newer guess loader when an observer submits the successor during response completion", async () => {
    /** A client observer can react immediately to an accepted question and released pending state. */
    const h = await racing(); h.session.input("text", "piano"); h.session.submit();
    /** Real authority confirms the first answer and its immutable successor. */
    const response = await h.authority.submitRaceGuess({runId: h.run.runId, riddleId: h.run.currentRiddle!.riddleId,
      guess: "piano", requestId: "loader-first"});
    /** Only one successor submission is triggered while the old handler is finishing. */
    let submitted = false;
    /** Observation stops after the one reentrant successor submission. */
    const unsubscribe = h.session.subscribe(() => {
      if (!submitted && h.session.getSnapshot().run?.currentRiddle?.position === 1 && h.session.getSnapshot().pending === null) {
        submitted = true; h.session.input("text", "clock"); h.session.submit();
      }
    });
    h.respond("raceGuess", response); unsubscribe();
    expect(h.session.getSnapshot()).toMatchObject({pending: "raceGuess", raceGuessLoading: true});
    h.advance(180);
    expect(h.session.getSnapshot()).toMatchObject({pending: "raceGuess", raceGuessLoading: true});
  });
  it.each(["same-run", "new-account"])("ignores a cancelled loader callback while a newer guess is pending: %s", async replacement => {
    /** Accepted wrong guess schedules its short loader tail. */
    const h = await racing(); h.session.input("text", "zzzzz"); h.session.submit();
    h.respond("raceGuess", await h.authority.submitRaceGuess({runId: h.run.runId, riddleId: h.run.currentRiddle!.riddleId,
      guess: "zzzzz", requestId: "loader-wrong"}));
    /** A browser/timer adapter can retain an already queued callback after cancellation. */
    const old = [...h.timers.values()].find(timer => timer.at === 3660)!;
    if (replacement === "new-account") {
      h.session.enter({locale: "en", ownerId: "owner-2"}); h.respond("raceCategories", await catalog()); h.session.begin("mixed");
      h.respond("raceStart", {run: await fixture()}); h.advance(3480);
    }
    h.session.input("text", "piano"); h.session.submit();
    /** The current delivery and its visible loader belong to the newer submitted attempt. */
    const before = h.session.getSnapshot(); old.callback();
    expect(h.session.getSnapshot()).toEqual(before);
    expect(h.session.getSnapshot()).toMatchObject({pending: "raceGuess", raceGuessLoading: true});
  });
  it("does not publish loader state after a cancelled callback runs following disposal", async () => {
    /** Completed wrong-guess response has one pending loader tail. */
    const h = await racing(); h.session.input("text", "zzzzz"); h.session.submit();
    h.respond("raceGuess", await h.authority.submitRaceGuess({runId: h.run.runId, riddleId: h.run.currentRiddle!.riddleId,
      guess: "zzzzz", requestId: "loader-dispose"}));
    /** Callback is captured before its handle is cancelled during unmount. */
    const old = [...h.timers.values()].find(timer => timer.at === 3660)!;
    h.session.dispose();
    /** No observer notification is allowed from the expired loader lifetime. */
    let notifications = 0;
    /** Notification counter observes only the disposed callback attempt. */
    const unsubscribe = h.session.subscribe(() => {notifications++;}); old.callback(); unsubscribe();
    expect(notifications).toBe(0); expect(h.timers.size).toBe(0);
  });
});
