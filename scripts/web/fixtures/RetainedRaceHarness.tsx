/** Test-only recorded-race integration from 6ee7da15e, adapted to the current retained controller and view.
 * The public RaceTo10Game entry remains live PvP; this fixture never enters a platform artifact. */
import {raceEntryView} from "../../../src/races/matchmaking/raceEntrySelection";
import {needsRaceCatalog} from "../../../src/races/matchmaking/raceDiscoveryRecovery";
import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import "../../../src/races/styles/lobby.css";
import "../../../src/races/styles/gameplay.css";
import type {PublishRaceChallengeResponse, RaceAnalyticsEventName, RaceInboxItem} from "../../../src/races/contracts/index";
import {tr} from "../../../src/localization/browser/i18n";
import {useReferralSharing} from "../../../src/sharing/components/ReferralSharingCapability";
import {createRaceAnalyticsMessage} from "../../../src/races/raceAnalytics";
import {getGhostCorrectCount} from "../../../src/races/presentation/racePlayback";
import {getRaceLetterStates} from "../../../src/races/presentation/racePresentation";
import {useRaceDialogFocus} from "../../../src/races/hooks/useRaceDialogFocus";
import {useRaceGameplayFit} from "../../../src/races/hooks/useRaceGameplayFit";
import {useAnswerKeyboard} from "../../../src/gameplay/hooks/browser/useAnswerKeyboard";
import {useRaceSession} from "../../../src/races/hooks/useRaceSession";
import {useRaceEntryTracking} from "../../../src/races/hooks/useRaceRuntimeEffects";
import {RaceTo10View} from "../../../src/races/components/recorded/RaceTo10View";
import {EMPTY_RACE_CATEGORIES, type RaceTo10GameProps} from "../../../src/races/components/recorded/RaceTo10Game.types.ts";
import {type RaceSessionEffect} from "../../../src/races/controllers/RaceSession.types.ts";

/** Replaces the whole rendered journey before a changed entry can display preceding authority. */
export function RetainedRaceHarness(props: RaceTo10GameProps) {
  /** Catalog and balance updates preserve the journey; account and entry intent changes replace it. */
  const entryKey = JSON.stringify([props.ownerId ?? null, props.locale, props.challengeId ?? null,
    props.openInbox ?? false]);
  return <RaceJourneyGame key={entryKey} {...props} />;
}

/** Rendering and optional provider adapters owned by one mounted Race Session journey. */
function RaceJourneyGame({locale, challengeId, openInbox = false, coins, ownerId, postToHost, onClose,
  initialCategories = EMPTY_RACE_CATEGORIES, matchmaking}: RaceTo10GameProps) {
  /** Sharing remains a target capability, independent of competitive scoring. */
  const referralSharing = useReferralSharing();
  /** Replacing a sharing provider retires its dialogs without replacing competitive state. */
  const referralOwner = useMemo(() => ({}), [referralSharing]);
  /** Render-time selection retires callbacks from replaced sharing providers. */
  const dialogOwners = useRef({referral: referralOwner});
  dialogOwners.current = {referral: referralOwner};
  /** Outbound share dialog loading state. */
  const [sharingReceipt, setSharingReceipt] = useState<object | null>(null);
  /** A retired provider's unresolved dialog does not disable a replacement share control. */
  const sharing = sharingReceipt === referralOwner;
  /** Synchronous duplicate-dialog guard. */
  const sharingRef = useRef<{
    /** Exact sharing provider selection for this delivery. */ owner: object;
  } | null>(null);
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
  /** The session owns every protocol and competitive presentation transition. */
  const {session, state} = useRaceSession({ownerId, locale, challengeId, openInbox, initialCategories}, {
    postToHost, effect: effect => effectRef.current(effect), getMatchmaking: () => matchmaking,
  });
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
    if (!referralSharing || sharingRef.current?.owner === referralOwner) return;
    /** Dialog completion belongs to this adapter lifetime. */
    const generation = adapterGeneration.current;
    /** Navigation away and back cannot reclaim an earlier share dialog's error. */
    const current = session.captureJourney();
    /** Exact delivery distinguishes old completion from a newer dialog under the same journey. */
    const receipt = {owner: referralOwner};
    sharingRef.current = receipt;
    /** Both current provider selection and delivery identity must survive asynchronous completion. */
    const owned = () => generation === adapterGeneration.current && dialogOwners.current.referral === referralOwner && sharingRef.current === receipt;
    setSharingReceipt(referralOwner);
    trackAnalytics("race_share_dialog_opened", {categoryId: publication.preview.categoryId});
    try {
      if (!owned()) return;
      /** Public score challenges remain reusable; dialog cancellation never cancels the challenge. */
      const result = await referralSharing.shareRace({challengeId: publication.challengeId, preview: publication.preview});
      if (owned() && current() && result === "error") session.reportError("RaceTo10.ERROR_GENERIC");
    } catch {if (owned() && current()) session.reportError("RaceTo10.ERROR_GENERIC");}
    finally {if (owned()) {sharingRef.current = null; setSharingReceipt(null);}}
  }, [referralSharing, referralOwner, trackAnalytics, session]);
  effectRef.current = effect => {
    if (effect.kind === "close") onClose();
    else if (effect.kind === "analytics") trackAnalytics(effect.event, effect.params);
    else if (effect.kind === "publication") {
      window.dispatchEvent(new CustomEvent("riddle-quest:race-challenge-published", {detail: effect.publication}));
      if (effect.share) void sharePublishedChallenge(effect.publication);
    }
  };
  useEffect(() => {
    adapterGeneration.current++;
    sharingRef.current = null;
    setSharingReceipt(null);
    return () => {adapterGeneration.current++;};
  }, [ownerId, locale, challengeId, openInbox]);
  useRaceEntryTracking(state.stage, challengeId);
  useRaceDialogFocus({dialogRef, quitDialogRef, quitConfirmationOpen: state.quitConfirmationOpen,
    dismissQuitConfirmation: session.dismissQuit, requestClose: session.requestClose});
  useRaceGameplayFit({active: state.stage === "racing", screenRef: dialogRef, viewportRef: gameplayViewportRef, gameplayRef});
  useAnswerKeyboard({active: state.stage === "racing" && !state.quitConfirmationOpen && (!state.pending || state.allowTypingWhilePending),
    onLetter: letter => session.input("letter", letter), onBackspace: () => session.input("backspace"), onSubmit: session.submit});
  /** Activity navigation is owned by the retained recorded-race session. */
  const showInbox = () => session.navigate("inbox");
  /** Confirmed opponent events replay against the owned adjusted clock. */
  const ghostCorrect = useMemo(() => getGhostCorrectCount(state.run?.opponent, state.adjustedNow), [state.run?.opponent, state.adjustedNow]);
  /** Keyboard coloring follows the owned scored history. */
  const letterStates = useMemo(() => getRaceLetterStates(state.raceGuesses), [state.raceGuesses]);
  /** Records rematch intent before starting the new attempt. */
  const inboxRematch = (item: RaceInboxItem) => {
    trackAnalytics("race_rematch_started", {categoryId: item.categoryId, result: item.result});
    session.rematch(item.categoryId, item.challengeId);
  };
  /** Exposed UI entry objects cannot alter the accepted role or recording rendered here. */
  const acceptedEntry = raceEntryView(state);
  return <RaceTo10View {...state} entryStatus={acceptedEntry}
    challenge={acceptedEntry?.status === "ready" ? acceptedEntry.challenge : state.challenge} coins={coins}
    error={state.error ? tr(state.error) : null} penaltyFlash={state.penaltyFlash ? tr(state.penaltyFlash) : null}
    safetyNotice={state.safetyNotice ? tr(state.safetyNotice) : null}
    opponentCorrect={ghostCorrect} letterStates={letterStates} dialogRef={dialogRef} gameplayViewportRef={gameplayViewportRef} gameplayRef={gameplayRef} quitDialogRef={quitDialogRef}
    matchPending={state.findingOpponent || Boolean(state.pending)}
    sharingRewardCoins={referralSharing?.rewardCoins} sharing={sharing}
    sharingLabel={referralSharing?.raceShareLabel} sharingReadyText={referralSharing?.raceReadyText}
    onClose={session.requestClose} onRetry={session.retry} onRequestClose={session.requestClose}
    requiresRunRefresh={state.requiresRunRefresh}
    retryDisabled={state.findingOpponent || Boolean(state.pending) || state.matchSearchStatus === "failed" && !state.matchRetryReady && !needsRaceCatalog(state)}
    onShowInbox={showInbox}
    onChooseCategory={() => session.navigate("categories")}
    onSelectCategory={session.begin} onInboxRematch={inboxRematch} onBlockRival={item => session.safety("block", item)} onReportRival={(item, category) => session.safety("report", item, category)}
    onSelectSlot={index => session.input("slot", index)} onLetter={letter => session.input("letter", letter)} onText={text => session.input("text", text)} onBackspace={() => session.input("backspace")}
    onHint={session.hint} onSubmit={session.submit} onSkip={session.skip} onPublish={referralSharing ? session.publish : () => undefined}
    onShare={() => {if (state.published) void sharePublishedChallenge(state.published);}} onRematch={session.rematch} onDismissQuit={session.dismissQuit}
    onFindOpponent={matchmaking ? () => void session.findOpponent(matchmaking) : undefined}
    onCancelInvitation={session.cancelInvitation} onAbandon={session.abandon} />;
}
