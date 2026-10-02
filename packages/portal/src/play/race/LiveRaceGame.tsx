import {RankedAvatar} from "../RankedAvatar";
import {LiveRaceInviteShare} from "./components/LiveRaceInviteShare";
import {estimatedRaceServerNow} from "./logic/raceCountdown";
import {liveRaceDeliveryDeadline, liveRaceCommandRejected} from "./logic/liveRaceDeliveryDeadline";
import {useCallback, useEffect, useRef, useState} from "react";
import {LiveRaceViewSchema, type LiveRaceCapability, type LiveRaceView, type RaceCategoryId, type RaceLocale, type UpdateLiveRace} from "@qwordly/core/race";
import {tr} from "../i18n";
import {createRequestId} from "../requestIds";
import {RaceTopbar} from "./components/RaceHeader";
import {RaceGameplay} from "./components/RaceGameplay";
import {useRaceDialogFocus} from "./hooks/useRaceDialogFocus";
import {useRaceGameplayFit} from "./hooks/useRaceGameplayFit";
import {useAnswerKeyboard} from "../game/hooks/useAnswerKeyboard";
import {editRaceInput} from "./logic/raceInput";
import {createRaceAttempt, findFirstEditableRaceSlot, getRaceLetterStates} from "./logic/racePresentation";

/** Lobby and live race presentation use one target-owned authenticated transport. */
export function LiveRaceGame({transport, locale, categoryId, createChallenge, challengeId, coins, ownerId, onCompleted, onClose}: {
  /** Approved target transport. */ transport: LiveRaceCapability;
  /** Exact content language. */ locale: RaceLocale;
  /** Selected shared riddle category. */ categoryId: RaceCategoryId;
  /** Reserves a private lobby for a platform invitation. */ createChallenge?: boolean;
  /** Accepts the existing private lobby after the recipient confirms. */ challengeId?: string;
  /** Current profile balance. */ coins: number;
  /** Account lifetime owning result refresh. */ ownerId?: string;
  /** Optional target-owned terminal effect; transport and scoring stay server authoritative. */
  onCompleted?: (view: LiveRaceView) => void;
  /** Return to the multiplayer intro. */ onClose: () => void;
}) {
  /** Viewer-specific snapshot from the authoritative match. */
  const [view, setView] = useState<LiveRaceView | null>(null);
  /** Latest accepted snapshot available to asynchronous transport callbacks. */
  const viewRef = useRef<LiveRaceView | null>(null);
  /** Editable answer draft, preserved across rival progress polls. */
  const [draft, setDraft] = useState({letters: [] as string[], activeSlotIndex: 0});
  /** Initial join or player command currently awaiting confirmation. */
  const [busy, setBusy] = useState(false);
  /** A failed delivery that the player can retry with the same request id. */
  const [error, setError] = useState(false);
  /** Local animation clock adjusted to the latest server observation. */
  const [now, setNow] = useState(Date.now());
  /** Starts gameplay when the shared authoritative countdown reaches zero. */
  const phase = view?.phase === "countdown" && view.startsAtMs !== null && now >= view.startsAtMs ? "racing" : view?.phase;
  /** Server-owned help waits disable actions while preserving answer drafting. */
  /** Receipt anchor advances server time independently of device wall-clock changes. */
  const clockAnchor = useRef({serverNowMs: Date.now(), receivedAtMs: performance.now()});
  /** Current server-time estimate shared by countdown, typing and command admission. */
  const serverNow = () => estimatedRaceServerNow(clockAnchor.current.serverNowMs, clockAnchor.current.receivedAtMs, performance.now());
  /** Stable join id preserved across retries and development effect replay. */
  const requestId = useRef(createRequestId("live-join"));
  /** Repeated retirement deliveries retain one idempotency key for this seat. */
  const leaveId = useRef(createRequestId("live-leave"));
  /** Exact player command retained until its delivery is confirmed. */
  const pending = useRef<UpdateLiveRace | null>(null);
  /** A rejected stale command requires fresh server state before another mutation. */
  const refreshRequired = useRef(false);
  /** Player commands can supersede a background poll without accepting its late response. */
  const inFlight = useRef<{
    /** Background observations may be superseded by an owned player command. */
    poll: boolean;
  } | null>(null);
  /** A timed-out receipt may recover only while no newer delivery has taken ownership. */
  const latestDelivery = useRef<object | null>(null);
  /** Consecutive delivery failures determine a bounded reconnect delay. */
  const deliveryFailures = useRef(0);
  /** Monotonic deadline prevents repeated requests during an outage. */
  const nextDeliveryAt = useRef(0);
  /** Prevents updates after the mounted journey is retired. */
  const active = useRef(true);
  /** Retires the lobby immediately when the player closes it. */
  const closed = useRef(false);
  /** Delivers one profile refresh notification per completed match. */
  const notified = useRef(false);
  /** Dialog surface owning focus and viewport fitting. */
  const dialogRef = useRef<HTMLElement | null>(null);
  /** Available viewport for the existing riddle gameplay. */
  const viewportRef = useRef<HTMLDivElement | null>(null);
  /** Natural gameplay layout used for responsive fitting. */
  const gameplayRef = useRef<HTMLDivElement | null>(null);
  /** Unused nested-dialog anchor required by the shared focus controller. */
  const quitDialogRef = useRef<HTMLDivElement | null>(null);
  /** Accepts a validated snapshot without erasing in-progress answer input. */
  const apply = useCallback((value: LiveRaceView) => {
    /** Provides next behavior. */
    const next = LiveRaceViewSchema.parse(value);
    if (!active.current || closed.current) return;
    /** Read-only server observations must not rewind the already advanced presentation clock. */
    const observedNow = viewRef.current ? Math.max(next.serverNowMs, serverNow()) : next.serverNowMs;
    clockAnchor.current = {serverNowMs: observedNow, receivedAtMs: performance.now()};
    setNow(observedNow);
    /** Previous prompt used to distinguish progress polls from answer transitions. */
    const before = viewRef.current?.run?.currentRiddle;
    /** Current server-owned prompt and revealed letters. */
    const riddle = next.run?.currentRiddle;
    if (riddle?.riddleId !== before?.riddleId || riddle?.guessesUsed !== before?.guessesUsed)
      setDraft({letters: createRaceAttempt(riddle ?? null), activeSlotIndex: findFirstEditableRaceSlot(riddle ?? null)});
    else if (riddle) setDraft(current => ({...current,
      activeSlotIndex: riddle.revealedLetters.some(reveal => reveal.index === current.activeSlotIndex) ? findFirstEditableRaceSlot(riddle) : current.activeSlotIndex,
      letters: current.letters.map((letter, index) =>
      riddle.revealedLetters.find(reveal => reveal.index === index)?.letter ?? letter)}));
    viewRef.current = next;
    setView(next);
    if (next.phase === "result" && !notified.current) {
      notified.current = true;
      onCompleted?.(next);
      window.dispatchEvent(new CustomEvent("riddle-quest:live-race-completed", {detail: {ownerId}}));
    }
  }, [ownerId, onCompleted]);
  /** Sends one owned join, progress poll or idempotent player command. */
  const deliver = useCallback(async () => {
    /** Stable command selected before starting an asynchronous delivery. */
    const command = pending.current;
    if (!active.current || closed.current || ["result", "cancelled"].includes(viewRef.current?.phase ?? "") ||
      inFlight.current && (!inFlight.current.poll || !command)) return;
    /** Receipt ownership prevents a superseded poll from replacing an accepted answer. */
    const delivery = {poll: Boolean(viewRef.current && !command)};
    /** Definitively rejected commands reconcile against the current authoritative question. */
    let reconcile = false;
    inFlight.current = delivery;
    latestDelivery.current = delivery;
    if (command || !viewRef.current) setBusy(true);
    /** Accepts an owned receipt; late superseded deliveries cannot rewind gameplay. */
    const accept = (result: LiveRaceView) => {
      if (closed.current || !active.current) {
        if (!["result", "cancelled"].includes(result.phase)) void transport.update({ticketId: result.ticketId, action: "leave", requestId: leaveId.current}).catch(() => {});
        return;
      }
      if (latestDelivery.current !== delivery) return;
      apply(result);
      if (pending.current === command) pending.current = null;
      refreshRequired.current = false;
      deliveryFailures.current = 0;
      nextDeliveryAt.current = 0;
      setError(false);
    };
    try {
      /** Viewer-specific result returned by the selected platform adapter. */
      const result = await liveRaceDeliveryDeadline(!viewRef.current ? transport.join({locale, categoryId, requestId: requestId.current, ...(createChallenge ? {createChallenge: true} : {}), ...(challengeId ? {challengeId} : {})}) :
        transport.update(command ?? {ticketId: viewRef.current.ticketId, action: "poll", requestId: createRequestId("live-poll")}),
        Boolean(viewRef.current && !command), late => {
          // Owned late commands can recover before retry; polls remain superseded observations.
          if (closed.current || !active.current || !delivery.poll && pending.current === command) accept(late);
        });
      accept(result);
    } catch (failure) {
      if (inFlight.current === delivery && active.current && !closed.current) {
        if (command && liveRaceCommandRejected(failure)) {
          pending.current = null;
          refreshRequired.current = true;
          reconcile = true;
        }
        deliveryFailures.current += 1;
        nextDeliveryAt.current = performance.now() + Math.min(8000, 1000 * 2 ** Math.min(deliveryFailures.current, 3));
        setError(true);
      }
    }
    finally {
      if (inFlight.current === delivery) {
        inFlight.current = null;
        if (active.current) {
          setBusy(false);
          if ((reconcile || pending.current && pending.current !== command) && !closed.current) queueMicrotask(() => void deliver());
        }
      }
    }
  }, [transport, locale, categoryId, createChallenge, challengeId, apply]);
  useEffect(() => {
    active.current = true;
    void deliver();
    /** Periodic server observations also retry retained commands after their backoff. */
    const timer = window.setInterval(() => {
      if (performance.now() >= nextDeliveryAt.current && !["result", "cancelled"].includes(viewRef.current?.phase ?? "")) void deliver();
    }, 1000);
    /** Reconnect and foreground transitions promptly reconcile the original owned command. */
    const resume = () => {
      if (document.visibilityState !== "hidden") {nextDeliveryAt.current = 0; void deliver();}
    };
    window.addEventListener("online", resume);
    document.addEventListener("visibilitychange", resume);
    dialogRef.current?.focus();
    return () => {
      active.current = false;
      window.clearInterval(timer);
      window.removeEventListener("online", resume);
      document.removeEventListener("visibilitychange", resume);
      // Strict Mode reactivates this lifetime synchronously; only a real unmount retires its seat.
      queueMicrotask(() => {
        if (active.current || closed.current) return;
        /** Last accepted ticket remains owned by this retired account journey. */
        const current = viewRef.current;
        if (current && !["result", "cancelled"].includes(current.phase))
          void transport.update({ticketId: current.ticketId, action: "leave", requestId: leaveId.current}).catch(() => {});
      });
    };
  }, [deliver]);
  useEffect(() => {
    if (view?.phase !== "countdown" || view.startsAtMs === null) return;
    /** The lobby clock stops updating the gameplay owner as soon as racing begins. */
    const startsAtMs = view.startsAtMs;
    /** Countdown transitions remain independent of delayed progress polls. */
    const timer = window.setInterval(() => {
      /** Monotonic countdown sampling stays independent of the device wall clock. */
      const sampledNow = serverNow();
      setNow(sampledNow);
      if (sampledNow >= startsAtMs) {
        window.clearInterval(timer);
        // The authority releases the first prompt at zero; request it without a full poll delay.
        if (!inFlight.current && performance.now() >= nextDeliveryAt.current) void deliver();
      }
    }, 100);
    return () => window.clearInterval(timer);
  }, [view?.phase, view?.startsAtMs, deliver]);
  /** Leaves the owned seat and returns to the multiplayer intro. */
  const close = () => {
    if (closed.current) return;
    closed.current = true;
    /** Snapshot whose ticket and prompt own the current interaction. */
    const current = viewRef.current;
    if (current && !["result", "cancelled"].includes(current.phase))
      void transport.update({ticketId: current.ticketId, action: "leave", requestId: leaveId.current}).catch(() => {});
    onClose();
  };
  useRaceDialogFocus({dialogRef, quitDialogRef, quitConfirmationOpen: false, dismissQuitConfirmation: () => {}, requestClose: close});
  /** Edits the current prompt while preserving confirmed hint letters. */
  const input = (kind: "letter" | "text" | "backspace" | "slot", value: string | number = "") => {
    /** Current server-owned prompt and revealed letters. */
    const riddle = viewRef.current?.run?.currentRiddle;
    if (riddle && !pending.current && (viewRef.current?.phase === "racing" || viewRef.current?.phase === "countdown" && serverNow() >= (viewRef.current.startsAtMs ?? Infinity)))
      setDraft(current => editRaceInput(riddle, current, kind, value));
  };
  /** Stable command selected before starting an asynchronous delivery. */
  const command = (action: "guess" | "hint" | "skip") => {
    /** Snapshot whose ticket and prompt own the current interaction. */
    const current = viewRef.current;
    if (!current?.run?.currentRiddle || pending.current || refreshRequired.current || !(current.phase === "racing" || current.phase === "countdown" && serverNow() >= (current.startsAtMs ?? Infinity))) return;
    if (action === "guess" && draft.letters.some(letter => !letter)) return;
    pending.current = {ticketId: current.ticketId, action, requestId: createRequestId(`live-${action}`),
      riddleId: current.run.currentRiddle.riddleId, ...(action === "guess" ? {guess: draft.letters.join("")} : {})};
    void deliver();
  };
  useAnswerKeyboard({active: phase === "racing" && !busy && !pending.current,
    onLetter: letter => input("letter", letter), onBackspace: () => input("backspace"), onSubmit: () => command("guess")});
  useRaceGameplayFit({active: phase === "racing", screenRef: dialogRef, viewportRef, gameplayRef});
  /** Server-confirmed guesses shown in the existing answer board. */
  const guesses = view?.run?.currentRiddle?.confirmedGuesses ?? [];
  /** Whole seconds remaining until the authoritative shared start. */
  const countdown = Math.max(0, Math.ceil(((view?.startsAtMs ?? now) - now) / 1000));
  /** Centered avatar and username displayed in the lobby. */
  const identity = (player: LiveRaceView["player"]) => {
    return <div className="live-race-player">
      <RankedAvatar avatarUrl={player.avatarUrl} level={player.level} size={100}
        fallback={player.bot ? "🤖" : "👤"} fallbackClassName="live-race-avatar" />
      <strong>{player.bot ? tr("RaceTo10.LIVE_BOT") : player.displayName}</strong>
    </div>;
  };
  return <section ref={dialogRef} className={`race-screen${phase === "racing" ? " race-screen-gameplay" : !view || phase === "searching" || phase === "countdown" ? " race-screen-live-lobby" : ""}`}
    role="dialog" aria-modal="true" aria-labelledby="race-title" tabIndex={-1} data-analytics-screen={`multiplayer_live_${phase ?? "searching"}`}>
    {phase !== "racing" && <RaceTopbar live coins={view?.newCoins ?? coins} onClose={close} />}
    {error && <div className="race-error" role="alert">{tr("RaceTo10.ERROR_GENERIC")} <button disabled={busy} onClick={() => void deliver()}>{tr("RaceTo10.RETRY")}</button></div>}
    {(!view || phase === "searching" || phase === "countdown") && <div className="live-race-lobby">
      <div className="live-race-self">{view ? identity(view.player) : <p role="status">{tr("Accessibility.LOADING")}</p>}</div>
      <div className="live-race-status" role="status" aria-live="polite">
        <h2>{tr(view?.phase === "countdown" ? "RaceTo10.LIVE_STARTING" : view?.challengeId ? "RaceTo10.CHALLENGE_FRIEND" : "RaceTo10.LIVE_FINDING")}</h2>
        {view?.phase === "countdown" ? <strong className="live-race-countdown">{countdown}</strong> : <p>{tr(view?.challengeId ? "RaceTo10.LIVE_FRIEND_WAIT" : "RaceTo10.LIVE_WAIT")}</p>}
      {view?.phase === "searching" && view.challengeId && <LiveRaceInviteShare challengeId={view.challengeId} transport={transport} />}
      </div>
      <div className="live-race-rival">{view?.opponent && identity(view.opponent)}</div>
    </div>}
    {phase === "racing" && view?.run && <RaceGameplay live viewportRef={viewportRef} gameplayRef={gameplayRef}
      run={view.opponent?.bot && view.run.opponent ? {...view.run, opponent: {...view.run.opponent, displayName: tr("RaceTo10.LIVE_BOT")}} : view.run} adjustedNow={Math.max(0, now - (view.startsAtMs ?? now)) + view.run.totalPenaltyMs}
      liveClock={{...clockAnchor.current, startsAtMs: view.startsAtMs ?? now}}
      opponentCorrect={view.opponent?.correctCount ?? 0} feedback={null} coins={coins} currentLetters={draft.letters}
      activeSlotIndex={draft.activeSlotIndex} guesses={guesses} letterStates={getRaceLetterStates(guesses)}
      pending={busy || Boolean(pending.current)} requiresRunRefresh={Boolean(pending.current) || refreshRequired.current} allowTypingWhilePending={false}
      onClose={close} onSelectSlot={index => input("slot", index)} onLetter={letter => input("letter", letter)}
      onText={text => input("text", text)} onBackspace={() => input("backspace")} onSubmit={() => command("guess")}
      onHint={() => command("hint")} onSkip={() => command("skip")} />}
    {view?.phase === "result" && <div className="race-panel race-result live-race-victory" role="status">
      <h2>{tr(view.result === "win" ? "RaceTo10.RESULT_PLAYER_WIN" : view.result === "loss" ? "RaceTo10.RESULT_OPPONENT_WIN" : "RaceTo10.RESULT_TIE")}</h2>
      <div className="race-result-score"><span>{view.player.displayName}<strong>{view.player.correctCount}/10</strong></span>
        <span>{view.opponent?.bot ? tr("RaceTo10.LIVE_BOT") : view.opponent?.displayName}<strong>{view.opponent?.correctCount ?? 0}/10</strong></span></div>
      {view.rewardCoins === 50 && <p className="live-race-reward">{tr("RaceTo10.LIVE_REWARD", {coins: view.rewardCoins})}</p>}
      <button className="race-primary" onClick={close}>{tr("RaceTo10.CLOSE")}</button>
    </div>}
    {view?.phase === "cancelled" && <button onClick={close}>{tr("RaceTo10.CLOSE")}</button>}
  </section>;
}
