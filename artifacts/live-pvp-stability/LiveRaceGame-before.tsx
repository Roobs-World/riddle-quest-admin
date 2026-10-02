import {estimatedRaceServerNow} from "./logic/raceCountdown";
import {liveRaceDeliveryDeadline} from "./logic/liveRaceDeliveryDeadline";
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
export function LiveRaceGame({transport, locale, categoryId, coins, ownerId, onClose}: {
  /** Approved target transport. */ transport: LiveRaceCapability;
  /** Exact content language. */ locale: RaceLocale;
  /** Selected shared riddle category. */ categoryId: RaceCategoryId;
  /** Current profile balance. */ coins: number;
  /** Account lifetime owning result refresh. */ ownerId?: string;
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
  /** Serializes polling and commands on this transport. */
  const inFlight = useRef(false);
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
    clockAnchor.current = {serverNowMs: next.serverNowMs, receivedAtMs: performance.now()};
    setNow(next.serverNowMs);
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
      window.dispatchEvent(new CustomEvent("riddle-quest:live-race-completed", {detail: {ownerId}}));
    }
  }, [ownerId]);
  /** Sends one owned join, progress poll or idempotent player command. */
  const deliver = useCallback(async () => {
    if (inFlight.current || closed.current) return;
    inFlight.current = true;
    /** Stable command selected before starting an asynchronous delivery. */
    const command = pending.current;
    if (command || !viewRef.current) setBusy(true);
    try {
      /** Viewer-specific result returned by the selected platform adapter. */
      const result = await liveRaceDeliveryDeadline(!viewRef.current ? transport.join({locale, categoryId, requestId: requestId.current}) :
        transport.update(command ?? {ticketId: viewRef.current.ticketId, action: "poll", requestId: createRequestId("live-poll")}),
        Boolean(viewRef.current && !command), late => {
          // A timed-out join may still establish a seat after the player has closed the lobby.
          if ((closed.current || !active.current) && !["result", "cancelled"].includes(late.phase))
            void transport.update({ticketId: late.ticketId, action: "leave", requestId: leaveId.current}).catch(() => {});
        });
      if (closed.current || !active.current) {
        if (!["result", "cancelled"].includes(result.phase)) void transport.update({ticketId: result.ticketId, action: "leave", requestId: leaveId.current}).catch(() => {});
        return;
      }
      apply(result);
      if (pending.current === command) pending.current = null;
      setError(false);
    } catch {if (active.current && !closed.current) setError(true);}
    finally {
      inFlight.current = false;
      if (active.current) {
        setBusy(false);
        if (pending.current && pending.current !== command && !closed.current) queueMicrotask(() => void deliver());
      }
    }
  }, [transport, locale, categoryId, apply]);
  useEffect(() => {
    active.current = true;
    void deliver();
    /** One-second live progress polling interval. */
    const timer = window.setInterval(() => {
      if (!pending.current && !["result", "cancelled"].includes(viewRef.current?.phase ?? "")) void deliver();
    }, 1000);
    /** Short animation interval for the five-second countdown. */
    const clock = window.setInterval(() => setNow(serverNow()), 100);
    dialogRef.current?.focus();
    return () => {
      active.current = false;
      window.clearInterval(timer);
      window.clearInterval(clock);
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
    if (!current?.run?.currentRiddle || pending.current || !(current.phase === "racing" || current.phase === "countdown" && serverNow() >= (current.startsAtMs ?? Infinity))) return;
    if (action === "guess" && draft.letters.some(letter => !letter)) return;
    pending.current = {ticketId: current.ticketId, action, requestId: createRequestId(`live-${action}`),
      riddleId: current.run.currentRiddle.riddleId, ...(action === "guess" ? {guess: draft.letters.join("")} : {})};
    void deliver();
  };
  useAnswerKeyboard({active: phase === "racing" && !busy && !error,
    onLetter: letter => input("letter", letter), onBackspace: () => input("backspace"), onSubmit: () => command("guess")});
  useRaceGameplayFit({active: phase === "racing", screenRef: dialogRef, viewportRef, gameplayRef});
  /** Server-confirmed guesses shown in the existing answer board. */
  const guesses = view?.run?.currentRiddle?.confirmedGuesses ?? [];
  /** Whole seconds remaining until the authoritative shared start. */
  const countdown = Math.max(0, Math.ceil(((view?.startsAtMs ?? now) - now) / 1000));
  /** Centered avatar and username displayed in the lobby. */
  const identity = (player: LiveRaceView["player"]) => <div className="live-race-player">
    {player.avatarUrl ? <img src={player.avatarUrl} alt="" /> : <span className="live-race-avatar" aria-hidden="true">{player.bot ? "🤖" : "👤"}</span>}
    <strong>{player.bot ? tr("RaceTo10.LIVE_BOT") : player.displayName}</strong>
  </div>;
  return <section ref={dialogRef} className={`race-screen${phase === "racing" ? " race-screen-gameplay" : !view || phase === "searching" || phase === "countdown" ? " race-screen-live-lobby" : ""}`}
    role="dialog" aria-modal="true" aria-labelledby="race-title" tabIndex={-1} data-analytics-screen={`multiplayer_live_${phase ?? "searching"}`}>
    {phase !== "racing" && <RaceTopbar live coins={view?.newCoins ?? coins} onClose={close} />}
    {error && <div className="race-error" role="alert">{tr("RaceTo10.ERROR_GENERIC")} <button disabled={busy} onClick={() => void deliver()}>{tr("RaceTo10.RETRY")}</button></div>}
    {(!view || phase === "searching" || phase === "countdown") && <div className="live-race-lobby">
      <div className="live-race-self">{view ? identity(view.player) : <p role="status">{tr("Accessibility.LOADING")}</p>}</div>
      <div className="live-race-status" role="status" aria-live="polite">
        <h2>{tr(view?.phase === "countdown" ? "RaceTo10.LIVE_STARTING" : "RaceTo10.LIVE_FINDING")}</h2>
        {view?.phase === "countdown" ? <strong className="live-race-countdown">{countdown}</strong> : <p>{tr("RaceTo10.LIVE_WAIT")}</p>}
      </div>
      <div className="live-race-rival">{view?.opponent && identity(view.opponent)}</div>
    </div>}
    {phase === "racing" && view?.run && <RaceGameplay live viewportRef={viewportRef} gameplayRef={gameplayRef}
      run={view.opponent?.bot && view.run.opponent ? {...view.run, opponent: {...view.run.opponent, displayName: tr("RaceTo10.LIVE_BOT")}} : view.run} adjustedNow={Math.max(0, now - (view.startsAtMs ?? now)) + view.run.totalPenaltyMs}
      ghostCorrect={view.opponent?.correctCount ?? 0} feedback={null} coins={coins} currentLetters={draft.letters}
      activeSlotIndex={draft.activeSlotIndex} guesses={guesses} letterStates={getRaceLetterStates(guesses)}
      pending={busy || Boolean(pending.current)} requiresRunRefresh={error} allowTypingWhilePending={false}
      onClose={close} onSelectSlot={index => input("slot", index)} onLetter={letter => input("letter", letter)}
      onText={text => input("text", text)} onBackspace={() => input("backspace")} onSubmit={() => command("guess")}
      onHint={() => command("hint")} onSkip={() => command("skip")} />}
    {phase === "racing" && view?.run && !view.run.currentRiddle && <p role="status">{tr("RaceTo10.LIVE_WAITING_FINISH")}</p>}
    {view?.phase === "result" && <div className="race-panel race-result live-race-victory" role="status">
      <h2>{tr(view.result === "win" ? "RaceTo10.RESULT_PLAYER_WIN" : view.result === "loss" ? "RaceTo10.RESULT_GHOST_WIN" : "RaceTo10.RESULT_TIE")}</h2>
      <div className="race-result-score"><span>{view.player.displayName}<strong>{view.player.correctCount}/10</strong></span>
        <span>{view.opponent?.bot ? tr("RaceTo10.LIVE_BOT") : view.opponent?.displayName}<strong>{view.opponent?.correctCount ?? 0}/10</strong></span></div>
      {view.rewardCoins === 50 && <p className="live-race-reward">{tr("RaceTo10.LIVE_REWARD", {coins: view.rewardCoins})}</p>}
      <button className="race-primary" onClick={close}>{tr("RaceTo10.CLOSE")}</button>
    </div>}
    {view?.phase === "cancelled" && <button onClick={close}>{tr("RaceTo10.CLOSE")}</button>}
  </section>;
}
