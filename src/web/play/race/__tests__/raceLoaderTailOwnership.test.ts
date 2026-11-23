import {expect, it} from "@jest/globals";
import type {GameToHostMessage} from "../../../../core/bridge";
import {RacePlay, type RacePlayClock} from "../RacePlay";

/** Loader completion adapters can replace delivery before returning their timer handle. */
it.each(["cancel", "now", "schedule", "immediate", "valid"])("retains loader-tail ownership through %s", mode => {
  /** Distinct resource handles reveal leaked or overwritten loader ownership. */
  let sequence = 0;
  /** A one-shot observation enters a replacement without recursively triggering itself. */
  let armed = false;
  /** Actual scheduled callbacks remain observable through the public clock contract. */
  const timers = new Map<number, () => void>();
  /** Cancellation calls must never retain a handle whose callback already completed. */
  const cancelled: number[] = [];
  /** Correlated commands prove the replacement remains independently acknowledgeable. */
  const commands: GameToHostMessage[] = [];
  /** Optional adapter observation replaces the completed guess with a new account journey. */
  const observe = (phase: string) => {
    if (!armed || phase !== mode) return;
    armed = false;
    play.dispose();
    play.send("raceEntry", "game:getRaceEntry", {challengeId: "replacement", locale: "en"});
  };
  /** Immediate callbacks model an adapter returning after its timer has already fired. */
  const clock: RacePlayClock = {
    now: () => {observe("now"); return 0;},
    schedule: callback => {
      /** Each callback owns a unique resource even when scheduling reenters. */
      const id = ++sequence;
      timers.set(id, callback);
      if (armed && mode === "immediate") {armed = false; timers.delete(id); callback();}
      observe("schedule");
      return id;
    },
    cancel: id => {cancelled.push(id); timers.delete(id); observe("cancel");},
  };
  /** Real delivery module provides loading state and response correlation. */
  const play = new RacePlay({clock, postToHost: command => {commands.push(command);},
    requestId: operation => `${operation}-${++sequence}`, onDeliveryFailure: () => undefined});
  play.send("raceGuess", "game:submitRaceGuess", {runId: "old", riddleId: "old", guess: "wrong"});
  expect(play.acceptResponse(commands[0].requestId, "raceGuess")).toBe(true);
  if (mode === "cancel") play.finish("raceGuess");
  armed = true;
  play.finish("raceGuess");
  if (["cancel", "now", "schedule"].includes(mode)) {
    expect(play.getSnapshot()).toEqual({pending: "raceEntry", raceGuessLoading: false});
    expect(timers.size).toBe(1);
    expect(play.acceptResponse(commands.at(-1)?.requestId, "raceEntry")).toBe(true);
    play.finish("raceEntry");
    expect(timers.size).toBe(0);
  } else if (mode === "immediate") {
    expect(play.getSnapshot()).toEqual({pending: null, raceGuessLoading: false});
    expect(timers.size).toBe(0);
  } else {
    expect(play.getSnapshot()).toEqual({pending: null, raceGuessLoading: true});
    expect(timers.size).toBe(1);
    for (const [id, callback] of timers) {timers.delete(id); callback();}
    expect(play.getSnapshot()).toEqual({pending: null, raceGuessLoading: false});
    expect(timers.size).toBe(0);
  }
  /** Settled completion leaves nothing for a subsequent disposal to cancel. */
  const cancellationCount = cancelled.length;
  play.dispose();
  expect(cancelled).toHaveLength(cancellationCount);
  expect(timers.size).toBe(0);
});
