import {useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore} from "react";
import "../../styles.race-lobby.css";
import "../../styles.race-gameplay.css";
import type {PublishRaceChallengeResponse, RaceAnalyticsEventName, RaceInboxItem} from "@qwordly/core/race";
import {tr} from "../i18n";
import {useReferralSharing} from "../sharing/ReferralSharingCapability";
import {createRaceAnalyticsMessage} from "./logic/raceAnalytics";
import {getGhostCorrectCount} from "./logic/racePlayback";
import {getRaceLetterStates} from "./logic/racePresentation";
import {useRaceDialogFocus, useRaceGameplayFit, useRaceGameplayKeyboard} from "./hooks";
import {useRaceSession} from "./hooks/useRaceSession";
import {useRaceEntryTracking} from "./hooks/useRaceRuntimeEffects";
import {RaceTo10View} from "./RaceTo10View";
import {EMPTY_RACE_CATEGORIES, type RaceTo10GameProps} from "./RaceTo10Game.types";
import type {RaceSessionEffect} from "./RaceSession.types";
import {RaceProviderViews} from "./RaceProviderViews";

/** Replaces the whole rendered journey before a changed entry can display preceding authority. */
export function RaceTo10Game(props: RaceTo10GameProps) {
  /** Catalog and balance updates preserve the journey; account and entry intent changes replace it. */
  const entryKey = JSON.stringify([props.ownerId ?? null, props.locale, props.challengeId ?? null,
    props.openInbox ?? false, props.tournaments ? props.tournamentLocale ?? null : null]);
  return <RaceJourneyGame key={entryKey} {...props} />;
}

/** Rendering and optional provider adapters owned by one mounted Race Session journey. */
function RaceJourneyGame({locale, challengeId, openInbox = false, tournamentLocale, coins, ownerId, postToHost, onClose,
  initialCategories = EMPTY_RACE_CATEGORIES, nativeSocial, matchmaking, playerOverlay, platformPlayerId,
  tournaments, contextBoard}: RaceTo10GameProps) {
  /** Sharing remains a target capability, independent of competitive scoring. */
  const referralSharing = useReferralSharing();
  /** Native context dialog lifetime. */
  const [socialPending, setSocialPending] = useState<"context" | "match" | null>(null);
  /** Native calls are guarded synchronously before React can render disabled buttons. */
  const socialPendingRef = useRef(false);
  /** Outbound share dialog loading state. */
  const [sharing, setSharing] = useState(false);
  /** Synchronous duplicate-dialog guard. */
  const sharingRef = useRef(false);
  /** Provider dialogs and views belong to the current account/language/entry. */
  const adapterGeneration = useRef(0);
  /** Root dialog focus and sizing adapter. */
  const dialogRef = useRef<HTMLElement | null>(null);
  /** Scaled gameplay viewport. */
  const gameplayViewportRef = useRef<HTMLDivElement | null>(null);
  /** Natural gameplay sizing surface. */
  const gameplayRef = useRef<HTMLDivElement | null>(null);
  /** Active abandonment dialog focus adapter. */
  const quitDialogRef = useRef<HTMLDivElement | null>(null);
  /** Current effect implementation used by the session adapter. */
  const effectRef = useRef<(effect: RaceSessionEffect) => void>(() => undefined);
  /** Only a configured target can select the incoming tournament surface. */
  const incomingTournamentLocale = tournaments ? tournamentLocale : undefined;
  /** The session owns every protocol and competitive presentation transition. */
  const {session, state} = useRaceSession({ownerId, locale, challengeId, openInbox, tournamentLocale: incomingTournamentLocale, initialCategories}, {
    postToHost, effect: effect => effectRef.current(effect), getMatchmaking: () => matchmaking,
  });
  /** Replaced provider adapters receive a fresh cache before the next frame commits. */
  const providerViews = useMemo(() => new RaceProviderViews({reportError: session.reportError}), [session, tournaments, contextBoard]);
  /** Rendering consumes whole provider cache transitions. */
  const providerState = useSyncExternalStore(providerViews.subscribe, providerViews.getSnapshot, providerViews.getSnapshot);
  useEffect(() => {
    providerViews.enter({locale, tournaments, contextBoard});
    /** A synchronous resume can confirm the outcome before provider ownership is installed. */
    const completedRunId = session.getConfirmedOutcomeRunId();
    if (completedRunId) providerViews.record(completedRunId);
    /** A removed optional target screen returns to supported navigation without a race mutation. */
    if (!tournaments && session.getSnapshot().stage === "tournaments") session.navigate("categories");
    /** Session notifications invalidate old reads before a late provider can settle. */
    const select = () => providerViews.selectStage(session.getSnapshot().stage);
    select();
    /** Subscription follows navigation, rematch and authority transitions synchronously. */
    const unsubscribe = session.subscribe(select);
    return () => {unsubscribe(); providerViews.dispose();};
  }, [providerViews, session, ownerId, locale, challengeId, openInbox, incomingTournamentLocale, tournaments, contextBoard]);
  /** Optional analytics transport cannot interrupt a share dialog or rematch action. */
  const trackAnalytics = useCallback((event: RaceAnalyticsEventName, params: Record<string, string | number | boolean> = {}) => {
    try {
      /** Telemetry delivery is optional whether the host fails now or after returning. */
      const delivery = postToHost(createRaceAnalyticsMessage(event, params));
      if (delivery) void Promise.resolve(delivery).catch(() => {});
    } catch {
      // Analytics delivery is independent of player actions and canonical scoring.
    }
  }, [postToHost]);
  /** Starts a provider share dialog only for a confirmed published challenge. */
  const sharePublishedChallenge = useCallback(async (publication: PublishRaceChallengeResponse) => {
    if (!referralSharing || sharingRef.current) return;
    /** Dialog completion belongs to this adapter lifetime. */
    const generation = adapterGeneration.current;
    /** Navigation away and back cannot reclaim an earlier share dialog's error. */
    const current = session.captureJourney();
    sharingRef.current = true;
    setSharing(true);
    trackAnalytics("race_share_dialog_opened", {categoryId: publication.preview.categoryId});
    try {
      /** Public score challenges remain reusable; dialog cancellation never cancels the challenge. */
      const result = await referralSharing.shareRace({challengeId: publication.challengeId, preview: publication.preview});
      if (generation === adapterGeneration.current && current() && result === "error") session.reportError("RaceTo10.ERROR_GENERIC");
    } catch {if (generation === adapterGeneration.current && current()) session.reportError("RaceTo10.ERROR_GENERIC");}
    finally {if (generation === adapterGeneration.current) {sharingRef.current = false; setSharing(false);}}
  }, [referralSharing, trackAnalytics, session]);
  effectRef.current = effect => {
    if (effect.kind === "close") onClose();
    else if (effect.kind === "analytics") trackAnalytics(effect.event, effect.params);
    else if (effect.kind === "publication") {
      window.dispatchEvent(new CustomEvent("riddle-quest:race-challenge-published", {detail: effect.publication}));
      if (effect.share) void sharePublishedChallenge(effect.publication);
    } else if (effect.kind === "outcome") {
      providerViews.record(effect.outcome.runId);
    }
  };
  useEffect(() => {
    adapterGeneration.current++;
    sharingRef.current = false;
    socialPendingRef.current = false;
    setSharing(false);
    setSocialPending(null);
    return () => {adapterGeneration.current++;};
  }, [ownerId, locale, challengeId, openInbox, incomingTournamentLocale]);
  useRaceEntryTracking(state.stage, challengeId);
  useRaceDialogFocus({dialogRef, quitDialogRef, quitConfirmationOpen: state.quitConfirmationOpen,
    dismissQuitConfirmation: session.dismissQuit, requestClose: session.requestClose});
  useRaceGameplayFit({active: state.stage === "racing", screenRef: dialogRef, viewportRef: gameplayViewportRef, gameplayRef});
  useRaceGameplayKeyboard({active: state.stage === "racing" && !state.quitConfirmationOpen && (!state.pending || state.allowTypingWhilePending),
    onLetter: letter => session.input("letter", letter), onBackspace: () => session.input("backspace"), onSubmit: session.submit});
  /** Optional context view refresh does not own session navigation. */
  const showInbox = () => {
    session.navigate("inbox");
    providerViews.refresh("inbox");
  };
  /** Optional tournament discovery uses the platform's own adapter. */
  const showTournaments = () => {
    if (!tournaments) return;
    session.navigate("tournaments");
    providerViews.refresh("tournaments");
  };
  /** Player-requested native presentation cannot alter official scoring or session navigation. */
  const shareTournament = async () => {
    if (!tournaments?.share || sharingRef.current || session.getSnapshot().stage !== "tournaments") return;
    /** UI results belong to the exact account/locale adapter lifetime. */
    const generation = adapterGeneration.current;
    /** Navigation invalidates an old dialog's errors. */
    const current = session.captureJourney();
    sharingRef.current = true;
    setSharing(true);
    session.reportError(null);
    try {
      /** The target rereads authority and owns the native dialog contract. */
      const result = await tournaments.share(locale);
      if (generation === adapterGeneration.current && current()) {
        if (result.status === "success") {providerViews.contextChanged(); providerViews.refresh("tournaments");}
        else if (result.status !== "cancelled") session.reportError(result.status === "unavailable" &&
          result.message === "RaceTo10.ERROR_LOCALE_MISMATCH" ? "RaceTo10.ERROR_LOCALE_MISMATCH" : "RaceTo10.ERROR_GENERIC");
      }
    } catch {if (generation === adapterGeneration.current && current()) session.reportError("RaceTo10.ERROR_GENERIC");}
    finally {if (generation === adapterGeneration.current) {sharingRef.current = false; setSharing(false);}}
  };
  /** Native social effects have no ownership over competitive state. */
  const runNativeSocial = async (kind: "context" | "match") => {
    if (!nativeSocial || socialPendingRef.current || session.getSnapshot().findingOpponent || session.getSnapshot().pending) return;
    /** Dialog receipt must still belong to the visible player journey. */
    const generation = adapterGeneration.current;
    /** Native dialog errors belong to the screen and run that opened the dialog. */
    const current = session.captureJourney();
    socialPendingRef.current = true;
    setSocialPending(kind);
    try {
      /** Target capability owns native context selection. */
      const result = kind === "context" ? await nativeSocial.chooseContext() : await nativeSocial.matchPlayer(`race10_v1_${locale}`);
      if (generation === adapterGeneration.current) {
        if (result.status === "success") providerViews.contextChanged();
        else if (current() && result.status !== "cancelled") session.reportError("RaceTo10.ERROR_GENERIC");
      }
    } catch {if (generation === adapterGeneration.current && current()) session.reportError("RaceTo10.ERROR_GENERIC");}
    finally {if (generation === adapterGeneration.current) {socialPendingRef.current = false; setSocialPending(null);}}
  };
  /** Confirmed opponent events replay against the owned adjusted clock. */
  const ghostCorrect = useMemo(() => getGhostCorrectCount(state.run?.opponent, state.adjustedNow), [state.run?.opponent, state.adjustedNow]);
  /** Keyboard coloring follows the owned scored history. */
  const letterStates = useMemo(() => getRaceLetterStates(state.raceGuesses), [state.raceGuesses]);
  /** Records rematch intent before starting the new attempt. */
  const inboxRematch = (item: RaceInboxItem) => {
    trackAnalytics("race_rematch_started", {categoryId: item.categoryId, result: item.result});
    session.rematch(item.categoryId, item.challengeId);
  };
  return <RaceTo10View {...state} coins={coins}
    error={state.error ? tr(state.error) : null} penaltyFlash={state.penaltyFlash ? tr(state.penaltyFlash) : null}
    safetyNotice={state.safetyNotice ? tr(state.safetyNotice) : null}
    tournament={providerState.tournament} tournamentLoading={providerState.tournamentLoading} contextBoard={providerState.contextBoard} contextBoardLoading={providerState.contextBoardLoading}
    ghostCorrect={ghostCorrect} letterStates={letterStates} dialogRef={dialogRef} gameplayViewportRef={gameplayViewportRef} gameplayRef={gameplayRef} quitDialogRef={quitDialogRef}
    socialPending={state.findingOpponent || state.pending ? "match" : socialPending} playerOverlay={playerOverlay} platformPlayerId={platformPlayerId}
    sharingRewardCoins={referralSharing?.rewardCoins} sharing={sharing}
    sharingLabel={referralSharing?.raceShareLabel} sharingReadyText={referralSharing?.raceReadyText}
    onClose={session.requestClose} onRetry={() => {
      if (providerState.failed) {
        providerViews.refresh(state.stage);
        if (state.stage === "inbox") session.retry();
      }
      else if (state.stage === "tournaments" && !["failed", "empty"].includes(state.matchSearchStatus)) showTournaments();
      else session.retry();
    }} onRequestClose={session.requestClose}
    requiresRunRefresh={state.requiresRunRefresh}
    retryDisabled={state.findingOpponent || Boolean(state.pending) || state.matchSearchStatus === "failed" && !state.matchRetryReady}
    onShowInbox={showInbox} onShowTournaments={tournaments ? showTournaments : undefined}
    onShareTournament={tournaments?.share ? () => void shareTournament() : undefined} onChooseCategory={() => session.navigate("categories")}
    onSelectCategory={session.begin} onInboxRematch={inboxRematch} onBlockRival={item => session.safety("block", item)} onReportRival={(item, category) => session.safety("report", item, category)}
    onSelectSlot={index => session.input("slot", index)} onLetter={letter => session.input("letter", letter)} onText={text => session.input("text", text)} onBackspace={() => session.input("backspace")}
    onHint={session.hint} onSubmit={session.submit} onSkip={session.skip} onPublish={referralSharing ? session.publish : () => undefined}
    onShare={() => {if (state.published) void sharePublishedChallenge(state.published);}} onRematch={session.rematch} onDismissQuit={session.dismissQuit}
    onChooseNativeContext={nativeSocial ? () => void runNativeSocial("context") : undefined}
    onMatchNativePlayer={matchmaking ? () => void session.findOpponent(matchmaking) : nativeSocial ? () => void runNativeSocial("match") : undefined}
    onCancelInvitation={session.cancelInvitation} onAbandon={session.abandon} />;
}
