import {expect, it} from "@jest/globals";
import type {GameToHostMessage} from "@riddle-quest/core/bridge";
import {RacePlay, type RacePlayClock} from "../RacePlay";

/** A timer adapter may deliver expiry before returning its resource handle. */
it.each(["handled", "replacement", "unhandled", "asynchronous"])("does not revive delivery after %s expiry", mode => {
  /** Timer resources are independent of mutation receipt identities. */
  let sequence = 0;
  /** Only the initial command uses immediate expiry; replacement scheduling remains normal. */
  let immediate = mode !== "asynchronous";
  /** Scheduled callbacks are observable through the real clock contract. */
  const timers = new Map<number, () => void>();
  /** Cancellation must not touch handles whose expiry already completed. */
  const cancelled: number[] = [];
  /** Host delivery counts distinguish rejected-before-dispatch from an accepted asynchronous send. */
  const commands: GameToHostMessage[] = [];
  /** Expiry must notify the recovery adapter exactly once. */
  const failures: string[] = [];
  /** Immediate completion removes its native resource before returning. */
  const clock: RacePlayClock = {now: () => 0, schedule: callback => {
    /** Unique resource handle belongs to this one expiry callback. */
    const id = ++sequence;
    timers.set(id, callback);
    if (immediate) {immediate = false; timers.delete(id); callback();}
    return id;
  }, cancel: id => {cancelled.push(id); timers.delete(id);}};
  /** Real delivery owner lets recovery consume the expired receipt or replace its lifetime. */
  const play = new RacePlay({clock, postToHost: command => {commands.push(command);},
    requestId: operation => `${operation}-${++sequence}`, onDeliveryFailure: (id, operation) => {
      failures.push(id);
      if (mode === "replacement") {play.dispose(); play.send("raceEntry", "game:getRaceEntry", {challengeId: "replacement", locale: "en"});}
      else if (mode !== "unhandled") {expect(play.acceptResponse(id, operation)).toBe(true); play.finish(operation);}
    }});
  play.send("raceInbox", "game:listRaceInbox", {limit: 20});
  if (mode === "asynchronous") {
    expect(commands).toHaveLength(1);
    expect(timers.size).toBe(1);
    expect(failures).toHaveLength(0);
    for (const [id, callback] of timers) {timers.delete(id); callback();}
  } else if (mode === "replacement") {
    expect(commands.map(command => command.type)).toEqual(["game:getRaceEntry"]);
    expect(play.getSnapshot().pending).toBe("raceEntry");
    expect(timers.size).toBe(1);
    expect(cancelled).toHaveLength(0);
    expect(play.acceptResponse(commands[0].requestId, "raceEntry")).toBe(true);
    play.finish("raceEntry");
  } else expect(commands).toHaveLength(0);
  expect(failures).toHaveLength(1);
  expect(timers.size).toBe(0);
  expect(cancelled).toHaveLength(mode === "replacement" ? 1 : 0);
  play.dispose();
  expect(cancelled).toHaveLength(mode === "replacement" ? 1 : 0);
});
