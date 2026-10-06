import {useLiveRaceSignals} from "./hooks/useLiveRaceSignals";
import {LiveRaceSafety} from "./components/LiveRaceSafety";
import {LiveRaceIdentity} from "./components/LiveRaceIdentity";
import {LIVE_RACE_POLL_TICK_MS} from "./logic/liveRacePolling";
import {LiveRaceInviteShare} from "./components/LiveRaceInviteShare";
import {LiveRaceSearchWheel} from "./components/LiveRaceSearchWheel";
import {estimatedRaceServerNow} from "./logic/raceCountdown";
import {liveRaceDeliveryDeadline, liveRaceCommandRejected, confirmUnavailableLiveInvitation} from "./logic/liveRaceDeliveryDeadline";
import {createLiveRaceRetirement} from "./logic/liveRaceRetirement";
import {liveRacePollInterval} from "./logic/liveRacePolling";
import {useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState} from "react";
import {LiveRaceViewSchema, type LiveRaceCapability, type LiveRaceView, type RaceCategoryId, type RaceLocale, type UpdateLiveRace} from "@qwordly/core/race";
import {tr} from "../i18n";
import {createRequestId} from "../requestIds";
import {RaceTopbar} from "./components/RaceHeader";
import {RaceGameplay} from "./components/RaceGameplay";
import {useRaceDialogFocus} from "./hooks/useRaceDialogFocus";
import {useRaceGameplayFit} from "./hooks/useRaceGameplayFit";
import {useAnswerKeyboard} from "../game/hooks/useAnswerKeyboard";
import {createLiveRaceDraft, editLiveRaceDraft, reconcileLiveRaceDraft, rejectLiveRaceDraft, type LiveRaceDraft} from "./logic/liveRaceDraft";
import {useLiveRaceDraft} from "./hooks/useLiveRaceDraft";
import {getRaceLetterStates} from "./logic/racePresentation";

/** Lobby and live race presentation use one target-owned authenticated transport. */
export function LiveRaceGame({transport, locale, categoryId, createChallenge, challengeId, rematchOfTicketId, coins, ownerId, onCompleted, onRematch, onClose}: {
  /** Approved target transport. */ transport: LiveRaceCapability;
  /** Exact content language. */ locale: RaceLocale;
  /** Selected shared riddle category. */ categoryId: RaceCategoryId;
  /** Reserves a private lobby for a platform invitation. */ createChallenge?: boolean;
  /** Accepts the existing private lobby after the recipient confirms. */ challengeId?: string;
  /** Own terminal source reserves its actual human opponent through the target adapter. */ rematchOfTicketId?: string;
  /** Current profile balance. */ coins: number;
  /** Account lifetime owning result refresh. */ ownerId?: string;
  /** Optional target-owned terminal effect; transport and scoring stay server authoritative. */
  onCompleted?: (view: LiveRaceView) => void;
  /** Retires the completed view before opening a new private rematch journey. */ onRematch?: (ticketId: string) => void;
  /** Return to the multiplayer intro. */ onClose: () => void;
}) {
  /** Viewer-specific snapshot from the authoritative match. */
  const [view, setView] = useState<LiveRaceView | null>(null);
  /** Confirmed blocks immediately mask the retired rival on every visible surface. */
  const [blocked, setBlocked] = useState(false);
  /** Latest accepted snapshot available to asynchronous transport callbacks. */
  const viewRef = useRef<LiveRaceView | null>(null);
  /** Editable answer draft, preserved across rival progress polls. */
  const {draft, getDraft, updateDraft} = useLiveRaceDraft();
  /** Original submitted word stays separate from letters composed while its receipt is pending. */
  const submittedDraft = useRef<{
    /** Original idempotent operation awaiting its owned receipt. */
    command: UpdateLiveRace;
    /** Immutable input checkpoint for definitive rejection recovery. */
    draft: LiveRaceDraft;
  } | null>(null);
  /** Initial join or player command currently awaiting confirmation. */
  const [busy, setBusy] = useState(false);
  /** A failed delivery that the player can retry with the same request id. */
  const [error, setError] = useState(false);
  /** Definitively unavailable invitations do not own a seat or a retry loop. */
  const [invitationUnavailable, setInvitationUnavailable] = useState(false);
  /** Stops timer, reconnect and late delivery paths immediately after authoritative confirmation. */
  const invitationUnavailableRef = useRef(false);
  /** Local animation clock adjusted to the latest server observation. */
  const [now, setNow] = useState(() => Date.now());
  /** Starts gameplay when the shared authoritative countdown reaches zero. */
  const phase = view?.phase === "countdown" && view.startsAtMs !== null && now >= view.startsAtMs ? "racing" : view?.phase;
  /** Server-owned help waits disable actions while preserving answer drafting. */
  /** Receipt anchor advances server time independently of device wall-clock changes. */
  const [clockAnchor] = useState(() => ({current: {serverNowMs: Date.now(), receivedAtMs: performance.now()}}));
  /** Current server-time estimate shared by countdown, typing and command admission. */
  const serverNow = () => estimatedRaceServerNow(clockAnchor.current.serverNowMs, clockAnchor.current.receivedAtMs, performance.now());
  /** Stable join id preserved across retries and development effect replay. */
  const [requestId] = useState(() => ({current: createRequestId("live-join")}));
  /** Repeated retirement deliveries retain one idempotency key for this seat. */
  const [leaveId] = useState(() => ({current: createRequestId("live-leave")}));
  /** Retired receipts keep bounded cleanup under this journey's original transport and leave key. */
  const [retireSeat] = useState(() => createLiveRaceRetirement(transport, leaveId.current));
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
  /** Last admitted read or action anchors reconciliation without delaying pushed changes. */
  const lastDeliveryAt = useRef(0);
  /** Coalesces notifications received while a command or observation owns delivery. */
  const refreshQueued = useRef(false);
  /** Consecutive delivery failures determine a bounded reconnect delay. */
  const deliveryFailures = useRef(0);
  /** Monotonic deadline prevents repeated requests during an outage. */
  const nextDeliveryAt = useRef(0);
  /** Accepted state, connectivity and delivery completion can rearm one owned polling deadline. */
  const pollSchedule = useRef<(() => void) | null>(null);
  /** Signal adapters change cadence without restarting the mounted seat lifetime. */
  const reschedulePoll = useCallback(() => {pollSchedule.current?.();}, []);
  /** Prevents updates after the mounted journey is retired. */
  const active = useRef(true);
  /** Retirement releases local waits for commands and superseded polls while their adapter receipts remain observed. */
  const waitOwner = useRef<AbortController | null>(null);
  useLayoutEffect(() => {
    active.current = true;
    // A receipt microtask can run before passive cleanup after a replacement commits.
    return () => {active.current = false;};
  }, []);
  /** Closing retains the owned seat until the authority confirms its retirement. */
  const closeRequested = useRef(false);
  /** Closing immediately disables local editing even while an earlier command still owns delivery. */
  const [closing, setClosing] = useState(false);
  /** Prevents a confirmed retirement from accepting another delivery. */
  const closed = useRef(false);
  /** Delivers one profile refresh notification per completed match. */
  const notified = useRef(false);
  /** Pending receipts use the latest committed completion effect without replacing delivery ownership. */
  const completedCallback = useRef(onCompleted);
  /** Ordinary parent updates must not restart polling, subscriptions or dialog focus. */
  const closeCallback = useRef(onClose);
  useLayoutEffect(() => {
    completedCallback.current = onCompleted;
    closeCallback.current = onClose;
  }, [onCompleted, onClose]);
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
    /** Capture the prior authority identity before queued React draft reconciliation runs. */
    const previous = viewRef.current;
    updateDraft(current => reconcileLiveRaceDraft(current, previous, next));
    viewRef.current = next;
    setView(next);
    reschedulePoll();
    if (next.phase === "result" && !notified.current) {
      notified.current = true;
      completedCallback.current?.(next);
      window.dispatchEvent(new CustomEvent("riddle-quest:live-race-completed", {detail: {ownerId}}));
    }
  }, [ownerId, updateDraft, reschedulePoll]);
  /** Sends one owned join, progress poll or idempotent player command. */
  const deliver = useCallback(async () => {
    /** Stable command selected before starting an asynchronous delivery. */
    const command = pending.current;
    if (!active.current || closed.current || invitationUnavailableRef.current || ["result", "cancelled"].includes(viewRef.current?.phase ?? "") ||
      inFlight.current && (!inFlight.current.poll || !command)) return;
    /** Receipt ownership prevents a superseded poll from replacing an accepted answer. */
    const delivery = {poll: Boolean(viewRef.current && !command)};
    /** All deliveries share the mounted journey's local cancellation boundary. */
    const lifetime = waitOwner.current ??= new AbortController();
    /** Definitively rejected commands reconcile against the current authoritative question. */
    let reconcile = false;
    lastDeliveryAt.current = performance.now();
    refreshQueued.current = false;
    inFlight.current = delivery;
    latestDelivery.current = delivery;
    reschedulePoll();
    if (command || !viewRef.current) setBusy(true);
    /** Accepts an owned receipt; late superseded deliveries cannot rewind gameplay. */
    const accept = (result: LiveRaceView) => {
      if (closed.current || !active.current) {
        retireSeat(result);
        return;
      }
      if (latestDelivery.current !== delivery || invitationUnavailableRef.current) return;
      apply(result);
      if (submittedDraft.current?.command === command) submittedDraft.current = null;
      if (pending.current === command) pending.current = null;
      refreshRequired.current = false;
      deliveryFailures.current = 0;
      nextDeliveryAt.current = 0;
      setError(false);
      if (closeRequested.current && (command?.action === "leave" || ["result", "cancelled"].includes(result.phase))) {
        closed.current = true;
        pending.current = null;
        closeCallback.current();
      }
    };
    try {
      /** Viewer-specific result returned by the selected platform adapter. */
      const result = await liveRaceDeliveryDeadline(!viewRef.current ? rematchOfTicketId
        ? transport.rematch!({locale, categoryId, requestId: requestId.current, rematchOfTicketId})
        : transport.join({locale, categoryId, requestId: requestId.current, ...(createChallenge ? {createChallenge: true} : {}), ...(challengeId ? {challengeId} : {})}) :
        transport.update(command ?? {ticketId: viewRef.current.ticketId, action: "poll", requestId: createRequestId("live-poll")}),
        Boolean(viewRef.current && !command), late => {
          // Owned late commands can recover before retry; polls remain superseded observations.
          if (closed.current || !active.current || !delivery.poll && pending.current === command) accept(late);
        }, lifetime.signal);
      accept(result);
    } catch (failure) {
      if (inFlight.current === delivery && active.current && !closed.current) {
        if (!viewRef.current && !command && challengeId &&
          await confirmUnavailableLiveInvitation(failure, challengeId, transport, lifetime.signal)) {
          // A close, account retirement or newer receipt may have superseded this read.
          if (inFlight.current !== delivery || latestDelivery.current !== delivery || !active.current || closed.current || viewRef.current) return;
          invitationUnavailableRef.current = true;
          setInvitationUnavailable(true);
          setError(false);
          return;
        }
        if (inFlight.current !== delivery || !active.current || closed.current) return;
        if (command && liveRaceCommandRejected(failure)) {
          /** Definitive rejection can restore the submitted word without overwriting later input. */
          const submitted = submittedDraft.current?.command === command ? submittedDraft.current : null;
          if (submitted) {updateDraft(current => rejectLiveRaceDraft(current, submitted.draft)); submittedDraft.current = null;}
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
          reschedulePoll();
          setBusy(false);
          if ((reconcile || pending.current && pending.current !== command || refreshQueued.current && performance.now() >= nextDeliveryAt.current) && !closed.current) queueMicrotask(() => void deliver());
        }
      }
    }
  }, [transport, locale, categoryId, createChallenge, challengeId, rematchOfTicketId, apply, updateDraft, reschedulePoll, retireSeat]);
  /** Signals never bypass delivery ownership or outage backoff. */
  const refresh = useCallback(() => {
    refreshQueued.current = true;
    if (performance.now() >= nextDeliveryAt.current) void deliver();
    else reschedulePoll();
  }, [deliver, reschedulePoll]);
  /** The platform owns the private authenticated listener. */
  const pushConnected = useLiveRaceSignals(transport, view, refresh, reschedulePoll);
  useEffect(() => {
    active.current = true;
    void deliver();
    /** Periodic server observations also retry retained commands after their backoff. */
    let timer: number | undefined;
    /** A retired effect cannot reschedule after a reentrant transport removes its game. */
    let polling = true;
    /** One timer adapts to accepted state; the delivery lock prevents overlapping observations. */
    const schedulePoll = () => {
      if (timer !== undefined) window.clearTimeout(timer);
      timer = undefined;
      if (!polling || !active.current || closed.current || invitationUnavailableRef.current || inFlight.current || ["result", "cancelled"].includes(viewRef.current?.phase ?? "")) return;
      /** Retained commands and queued recovery reads retry as soon as their outage backoff expires. */
      const interval = pending.current || refreshQueued.current ? LIVE_RACE_POLL_TICK_MS :
        liveRacePollInterval(viewRef.current, document.visibilityState !== "hidden", pushConnected.current);
      /** Receipt time and outage backoff determine the next useful observation. */
      const dueAt = Math.max(nextDeliveryAt.current, lastDeliveryAt.current + interval);
      timer = window.setTimeout(() => {
        timer = undefined;
        if (!polling || !active.current || closed.current) return;
        if (performance.now() >= dueAt) void deliver();
        schedulePoll();
      }, Math.max(1, Math.ceil(dueAt - performance.now())));
    };
    pollSchedule.current = schedulePoll;
    schedulePoll();
    /** Reconnect and foreground transitions promptly reconcile the original owned command. */
    const resume = () => {
      if (document.visibilityState !== "hidden") {nextDeliveryAt.current = 0; refresh();}
      schedulePoll();
    };
    window.addEventListener("online", resume);
    document.addEventListener("visibilitychange", resume);
    dialogRef.current?.focus();
    return () => {
      polling = false;
      if (pollSchedule.current === schedulePoll) pollSchedule.current = null;
      active.current = false;
      window.clearTimeout(timer);
      window.removeEventListener("online", resume);
      document.removeEventListener("visibilitychange", resume);
      // Strict Mode reactivates this lifetime synchronously; only a real unmount retires its seat.
      queueMicrotask(() => {
        if (active.current) return;
        waitOwner.current?.abort();
        if (closed.current) return;
        /** Last accepted ticket remains owned by this retired account journey. */
        const current = viewRef.current;
        if (current) retireSeat(current);
      });
    };
  }, [deliver, refresh, retireSeat]);
  useEffect(() => {
    if (view?.phase !== "countdown" || view.startsAtMs === null) return;
    /** The lobby clock stops updating the gameplay owner as soon as racing begins. */
    const startsAtMs = view.startsAtMs;
    /** Retired effects and cancelled timer generations cannot sample or request state. */
    let disposed = false, generation = 0;
    /** Hidden countdowns retain their authoritative anchor without animating. */
    let timer: number | null = null;
    /** Invalidates queued callbacks before releasing their browser interval. */
    const stop = () => {
      generation++;
      if (timer !== null) window.clearInterval(timer);
      timer = null;
    };
    /** Foreground sampling transitions at the server boundary without waiting for another poll. */
    const sampleCountdown = (ownedGeneration: number): boolean => {
      if (disposed || !active.current || generation !== ownedGeneration || document.hidden) return false;
      /** Monotonic countdown sampling stays independent of the device wall clock. */
      const sampledNow = serverNow();
      setNow(sampledNow);
      if (sampledNow >= startsAtMs) {
        stop();
        // The authority releases the first prompt at zero; request it without a full poll delay.
        if (performance.now() >= nextDeliveryAt.current) refresh();
        return false;
      }
      return true;
    };
    /** Returning to the foreground immediately catches up and owns one current interval. */
    const refreshCountdown = () => {
      if (disposed || !active.current) return;
      stop();
      if (document.hidden) return;
      /** This generation owns both the immediate sample and subsequent native callbacks. */
      const ownedGeneration = generation;
      if (!sampleCountdown(ownedGeneration)) return;
      timer = window.setInterval(() => sampleCountdown(ownedGeneration), 100);
    };
    document.addEventListener("visibilitychange", refreshCountdown);
    refreshCountdown();
    return () => {
      disposed = true;
      stop();
      document.removeEventListener("visibilitychange", refreshCountdown);
    };
  }, [view?.phase, view?.startsAtMs, refresh]);
  /** Leaves the owned seat and returns to the multiplayer intro. */
  const close = () => {
    if (closed.current || closeRequested.current) return;
    /** Snapshot whose ticket and prompt own the current interaction. */
    const current = viewRef.current;
    if (current && !["result", "cancelled"].includes(current.phase)) {
      closeRequested.current = true;
      setClosing(true);
      pending.current = {ticketId: current.ticketId, action: "leave", requestId: leaveId.current};
      refreshRequired.current = false;
      nextDeliveryAt.current = 0;
      void deliver();
      return;
    }
    closed.current = true;
    onClose();
  };
  useRaceDialogFocus({dialogRef, quitDialogRef, quitConfirmationOpen: false, dismissQuitConfirmation: () => {}, requestClose: close});
  /** Local composition can continue while server mutations and their exact receipts remain locked. */
  const canDraft = phase === "racing" && Boolean(view?.run?.currentRiddle) && !closing && !closed.current && !closeRequested.current && pending.current?.action !== "leave";
  /** Edits the current prompt while preserving confirmed hint letters. */
  const input = (kind: "letter" | "text" | "backspace" | "slot", value: string | number = "") => {
    /** Current server-owned prompt and revealed letters. */
    const riddle = viewRef.current?.run?.currentRiddle;
    if (riddle && canDraft && active.current && !closed.current && !closeRequested.current && pending.current?.action !== "leave" &&
      (viewRef.current?.phase === "racing" || viewRef.current?.phase === "countdown" && serverNow() >= (viewRef.current.startsAtMs ?? Infinity)))
      updateDraft(current => editLiveRaceDraft(riddle, current, kind, value));
  };
  /** Stable command selected before starting an asynchronous delivery. */
  const command = (action: "guess" | "hint" | "skip") => {
    /** Snapshot whose ticket and prompt own the current interaction. */
    const current = viewRef.current;
    /** Exact accepted prompt owns this command and the subsequent editable attempt. */
    const riddle = current?.run?.currentRiddle;
    if (!current || !riddle || pending.current || refreshRequired.current || !(current.phase === "racing" || current.phase === "countdown" && serverNow() >= (current.startsAtMs ?? Infinity))) return;
    /** Every admitted input transition precedes the explicit submit, independently of rendering. */
    const latestDraft = getDraft();
    if (action === "guess" && latestDraft.letters.some(letter => !letter)) return;
    pending.current = {ticketId: current.ticketId, action, requestId: createRequestId(`live-${action}`),
      riddleId: riddle.riddleId, ...(action === "guess" ? {guess: latestDraft.letters.join("")} : {})};
    if (action === "guess") {
      submittedDraft.current = {command: pending.current, draft: {...latestDraft, letters: [...latestDraft.letters]}};
      updateDraft(() => createLiveRaceDraft(riddle, latestDraft.revision));
    }
    void deliver();
  };
  useAnswerKeyboard({active: canDraft,
    onLetter: letter => input("letter", letter), onBackspace: () => input("backspace"), onSubmit: () => command("guess")});
  useRaceGameplayFit({active: phase === "racing", screenRef: dialogRef, viewportRef, gameplayRef});
  /** Server-confirmed guesses shown in the existing answer board. */
  const guesses = view?.run?.currentRiddle?.confirmedGuesses;
  /** Draft edits retain keyboard feedback until a new authoritative guess history arrives. */
  const letterStates = useMemo(() => getRaceLetterStates(guesses ?? []), [guesses]);
  /** Local privacy masking cannot change private scoring or the server winner. */
  const shownView = blocked && view ? {...view, opponent: view.opponent ? {...view.opponent,
    displayName: tr("RaceTo10.BLOCK_SUCCESS"), avatarUrl: null, level: 1} : null,
    run: view.run ? {...view.run, opponent: undefined} : null} : view;
  /** Only adapters with both safety operations expose human-opponent controls. */
  const hasSafety = shownView?.opponent?.bot === false && Boolean(transport.blockOpponent && transport.reportOpponent);
  return <section ref={dialogRef} className={`race-screen${hasSafety ? " race-screen-live-safety" : ""}${phase === "racing" ? " race-screen-gameplay" : !view || phase === "searching" || phase === "countdown" ? " race-screen-live-lobby" : ""}`}
    role="dialog" aria-modal="true" aria-labelledby="race-title" tabIndex={-1} data-analytics-screen={`multiplayer_live_${invitationUnavailable ? "invitation_unavailable" : phase ?? "searching"}`}>
    {phase !== "racing" && <RaceTopbar live coins={shownView?.newCoins ?? coins} onClose={close} />}
    {error && <div className="race-error" role="alert">{tr("RaceTo10.ERROR_GENERIC")} <button disabled={busy} onClick={() => void deliver()}>{tr("RaceTo10.RETRY")}</button></div>}
    {!invitationUnavailable && (!view || phase === "searching" || phase === "countdown") && <div className="live-race-lobby">
      <div className="live-race-self">{shownView ? <LiveRaceIdentity player={shownView.player} /> : <p role="status">{tr("Accessibility.LOADING")}</p>}</div>
      <div className="live-race-status" role="status" aria-live="polite">
        <h2>{tr(shownView?.phase === "countdown" ? "RaceTo10.LIVE_STARTING" : shownView?.challengeId ? "RaceTo10.CHALLENGE_FRIEND" : "RaceTo10.LIVE_FINDING")}</h2>
        {shownView?.phase === "countdown" ? <LiveRaceSearchWheel endsAtMs={shownView.startsAtMs ?? undefined} now={now} starting /> :
          shownView?.challengeId || createChallenge || challengeId ? <p>{tr("RaceTo10.LIVE_FRIEND_WAIT")}</p> :
          <LiveRaceSearchWheel endsAtMs={shownView?.searchEndsAtMs} now={now} />}
      {shownView?.phase === "searching" && shownView.challengeId && !rematchOfTicketId && <LiveRaceInviteShare challengeId={shownView.challengeId} transport={transport} />}
      </div>
      <div className="live-race-rival">{shownView?.opponent && <LiveRaceIdentity player={shownView.opponent} />}</div>
    </div>}
    {invitationUnavailable && <div className="race-panel race-result">
      <p role="status">{tr("RaceTo10.INVITATION_EXPIRED")}</p>
      <button className="race-primary" onClick={close}>{tr("RaceTo10.CLOSE")}</button>
    </div>}
    {phase === "racing" && shownView?.run && <RaceGameplay live viewportRef={viewportRef} gameplayRef={gameplayRef}
      run={shownView.opponent?.bot && shownView.run.opponent ? {...shownView.run, opponent: {...shownView.run.opponent, displayName: tr("RaceTo10.LIVE_OPPONENT")}} : shownView.run} adjustedNow={Math.max(0, now - (shownView.startsAtMs ?? now)) + shownView.run.totalPenaltyMs}
      liveClock={{...clockAnchor.current, startsAtMs: shownView.startsAtMs ?? now}}
      opponentCorrect={shownView.opponent?.correctCount ?? 0} feedback={null} coins={coins} currentLetters={draft.letters}
      activeSlotIndex={draft.activeSlotIndex} guesses={guesses ?? []} letterStates={letterStates}
      pending={busy || Boolean(pending.current)} requiresRunRefresh={Boolean(pending.current) || refreshRequired.current} allowTypingWhilePending={canDraft}
      onClose={close} onSelectSlot={index => input("slot", index)} onLetter={letter => input("letter", letter)}
      onText={text => input("text", text)} onBackspace={() => input("backspace")} onSubmit={() => command("guess")}
      onHint={() => command("hint")} onSkip={() => command("skip")} />}
    {shownView?.phase === "result" && <div className="race-panel race-result live-race-victory" role="status">
      <h2>{tr(shownView.result === "win" ? "RaceTo10.RESULT_PLAYER_WIN" : shownView.result === "loss" ? "RaceTo10.RESULT_OPPONENT_WIN" : "RaceTo10.RESULT_TIE")}</h2>
      <div className="race-result-score"><span>{shownView.player.displayName}<strong>{shownView.player.correctCount}/10</strong></span>
        <span>{shownView.opponent?.bot ? tr("RaceTo10.LIVE_OPPONENT") : shownView.opponent?.displayName}<strong>{shownView.opponent?.correctCount ?? 0}/10</strong></span></div>
      {shownView.rewardCoins === 50 && <p className="live-race-reward">{tr("RaceTo10.LIVE_REWARD", {coins: shownView.rewardCoins})}</p>}
      {!blocked && shownView.opponent?.bot === false && transport.rematch && onRematch &&
        <button className="race-secondary live-race-rematch" onClick={() => onRematch(shownView.ticketId)}>{tr("RaceTo10.REMATCH")}</button>}
      <button className="race-primary" onClick={close}>{tr("RaceTo10.CLOSE")}</button>
    </div>}
    {hasSafety && shownView &&
      <LiveRaceSafety key={shownView.ticketId} transport={transport} ticketId={shownView.ticketId} onBlocked={() => setBlocked(true)} />}
    {shownView?.phase === "cancelled" && <button onClick={close}>{tr("RaceTo10.CLOSE")}</button>}
  </section>;
}
