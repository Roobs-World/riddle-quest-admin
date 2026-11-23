import type {RaceCategoryId, LiveRaceView, LiveRaceCapability, ListRaceCategoriesResponse, RaceLocale, SocialReportCategory} from "../../../../../src/races/contracts/index";
import {createFirebaseLiveTransport} from "../../../../../src/races/transport/firebaseLiveTransport";
import type {HostServices} from "../../../../../src/platform/contracts/hostServices";
import {formatRaceTime} from "../../../../../src/races/presentation/racePresentation";
import {canShowLatinShortcut} from "../../../../../src/gameplay/input/localInput";
import {type YouTubeLocale} from "../../../../../src/gameplay/local/types";
import {useEffect, useLayoutEffect, useMemo, useRef, useState} from "react";
import {BackHandler, Image, Pressable, StyleSheet, Text, TextInput, View} from "react-native";
import {ActionButton, Eyebrow, Heading, Notice, Panel, Screen} from "../components/Primitives";
import type {HostedFirebaseClient} from "../hosted/firebaseClient";
import {shareAndroidRaceChallenge} from "../hosted/raceLinks";
import {useHostedRace} from "../hosted/useHostedRace";
import {raceText, type RaceCopyKey} from "../i18n/raceCopy";
import {palette, radius, spacing} from "../theme";
import {AnswerInput, type AnswerEditor} from "./AnswerInput";

/** Native views for the shared authoritative lobby, countdown, live match and result. */
export type HostedRaceScreenProps = Readonly<{
  /** App language. */ locale: YouTubeLocale;
  /** Current authenticated account. */ accountUid: string;
  /** Typed authenticated Firebase callables. */ client: HostedFirebaseClient;
  /** Shared profile refresh after authoritative completion. */ services: HostServices;
  /** Optional server invitation delivered by an app link or notification. */ challengeId?: string;
  /** Reports whether a join or owned seat requires confirmed retirement before navigation. */ onActivityChange?: (active: boolean) => void;
  /** Clears only this preview after server acceptance or terminal unavailability. */ onEntryHandled?: () => void;
  /** Returns to the online home after confirmed retirement. */ onBack: () => void;
}>;
/** Existing localized category-name keys, without dynamic unchecked string indexing. */
const categoryKeys: Record<RaceCategoryId, RaceCopyKey> = {
  history: "CATEGORY_HISTORY_NAME", geography: "CATEGORY_GEOGRAPHY_NAME", music: "CATEGORY_MUSIC_NAME",
  film: "CATEGORY_FILM_NAME", science: "CATEGORY_SCIENCE_NAME", mixed: "CATEGORY_MIXED_NAME",
};
/** Opens one immutable account, locale and invitation journey. */
export function HostedRaceScreen(props: HostedRaceScreenProps) {
  /** Target-authenticated live port kept stable across native renders. */
  const transport = useMemo(() => createFirebaseLiveTransport(props.client.functions), [props.client]);
  return <HostedRaceView key={JSON.stringify([props.accountUid, props.locale, props.challengeId ?? null])} {...props} transport={transport}
    categories={async language => (await props.client.functions.listRaceCategories({locale: language})).data} />;
}
/** A native race view accepts only provider-neutral authenticated ports. */
export type HostedRaceViewProps = Omit<HostedRaceScreenProps, "client"> & {
  /** Account-owned target transport. */ transport: LiveRaceCapability;
  /** Approved category catalog. */ categories: (locale: RaceLocale) => Promise<ListRaceCategoriesResponse>;
};
/** Keeps the target transport and native controller stable while the race polls. */
export function HostedRaceView({locale, accountUid, transport, categories, services, challengeId, onBack, onEntryHandled, onActivityChange}: HostedRaceViewProps) {
  /** Resolves existing translated race keys for the device locale. */
  const text = (key: RaceCopyKey, params?: Readonly<Record<string, string | number>>) => raceText(locale, key, params);
  /** Shared authority and input state with native lifecycle adapters. */
  const {state, controller} = useHostedRace({ownerId: accountUid, locale, transport, challengeId,
    categories,
    onCompleted: () => {void services.loadProfile(accountUid).catch(() => undefined);}});
  useLayoutEffect(() => {
    onActivityChange?.(state.busy || controller.requiresRetirement());
    return () => onActivityChange?.(false);
  }, [controller, state.recovering, state.busy, state.error, state.view?.phase, onActivityChange]);
  useEffect(() => {
    /** Hardware-back listener delegates to the race's confirmed quit flow. */
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {controller.requestClose(); return true;});
    return () => subscription.remove();
  }, [controller]);
  /** Native editor focused after selecting an answer slot. */
  const answerRef = useRef<AnswerEditor | null>(null);
  /** Player-selected server-supported report reason. */
  const [reportCategory, setReportCategory] = useState<SocialReportCategory>("other");
  /** Native share failure shown independently of server race state. */
  const [shareFailed, setShareFailed] = useState(false);
  /** Game username resolved by the server for a direct invitation. */
  const [recipient, setRecipient] = useState("");
  /** Tracks durable invitation queue acknowledgement separately from delivery. */
  const [inviteState, setInviteState] = useState<"idle" | "sending" | "queued" | "failed">("idle");
  /** Confirmed safety action masks the blocked rival's presentation. */
  const [safetyState, setSafetyState] = useState<"idle" | "busy" | "blocked" | "reported" | "failed">("idle");
  useEffect(() => {if (state.closed) onBack();}, [state.closed, onBack]);
  /** Answer-free canonical projection displayed for this owned seat. */
  const view = state.view;
  /** A successful join or authoritative expired preview finishes the pending entry only. */
  const entryHandled = useRef(false);
  useEffect(() => {
    if (!challengeId || entryHandled.current) return;
    if (view?.challengeId === challengeId || state.invitations.some(invitation => invitation.challengeId === challengeId && invitation.status === "unavailable")) {
      entryHandled.current = true;
      onEntryHandled?.();
    }
  }, [challengeId, view?.challengeId, state.invitations, onEntryHandled]);
  useEffect(() => {setSafetyState("idle"); setInviteState("idle"); setShareFailed(false);}, [view?.ticketId]);
  /** Current server-issued question, absent while waiting or finished. */
  const prompt = view?.run?.currentRiddle;
  /** Selects result presentation only after authoritative completion or cancellation. */
  const terminal = view?.phase === "result" || view?.phase === "cancelled";
  /** Whole seconds remaining before the fixed server start. */
  const countdown = view?.phase === "countdown" && view.startsAtMs !== null
    ? Math.max(0, Math.ceil((view.startsAtMs - state.now) / 1000)) : 0;
  /** Race identity and close action remain reachable on every stage. */
  const header = <View style={styles.header}>
    <Heading>{text("TITLE")}</Heading>
    <ActionButton label={text("CLOSE")} disabled={state.busy || state.recovering} onPress={() => controller.requestClose()} testID="race-close" />
  </View>;
  /** Opens Android's native share sheet for the existing private lobby. */
  const share = async () => {
    if (!view?.challengeId) return;
    setShareFailed(false);
    /** Native share outcome does not imply invitation acceptance. */
    const result = await shareAndroidRaceChallenge(view.challengeId, text("CHALLENGE_FRIEND"), text("LIVE_INVITE_MESSAGE", {name: view.player.displayName}), locale);
    setShareFailed(result === "error");
  };
  /** Queues an addressed invitation without claiming push delivery. */
  const sendChallenge = async () => {
    if (!view?.challengeId || !transport.sendChallenge || inviteState === "sending") return;
    setInviteState("sending");
    try {await transport.sendChallenge({challengeId: view.challengeId, recipientUsername: recipient}); setInviteState("queued");}
    catch {setInviteState("failed");}
  };
  /** Submits a ticket-bound block or categorized report to authority. */
  const safetyAction = async (kind: "block" | "report") => {
    if (!view || safetyState === "busy") return;
    setSafetyState("busy");
    try {
      if (kind === "block" && transport.blockOpponent) {await transport.blockOpponent({liveTicketId: view.ticketId}); setSafetyState("blocked");}
      else if (transport.reportOpponent) {
        await transport.reportOpponent({liveTicketId: view.ticketId, category: reportCategory, requestId: `native-report-${reportCategory}-${view.ticketId}`});
        setSafetyState("reported");
      }
    } catch {setSafetyState("failed");}
  };
  return <Screen testID="screen-hosted-race">
    {header}
    {(state.error || shareFailed || inviteState === "failed" || safetyState === "failed") && <Panel>
      <Notice error testID="race-error">{text("ERROR_GENERIC")}</Notice>
      {state.error && <ActionButton label={text("RETRY")} disabled={state.busy} onPress={controller.retry} testID="race-retry" />}
    </Panel>}
    {state.quitConfirmation ? <Panel>
      <Heading level={2}>{text("QUIT_TITLE")}</Heading>
      <Text style={styles.body}>{text("QUIT_MESSAGE")}</Text>
      <ActionButton label={text("KEEP_PLAYING")} onPress={() => controller.cancelClose()} testID="race-keep-playing" />
      <ActionButton tone="danger" label={text("QUIT_RACE")} disabled={state.busy} onPress={() => {void controller.close();}} testID="race-quit-confirm" />
    </Panel> : !view ? <>
      <Panel>
        <Heading level={2}>{text("CHOOSE_CATEGORY")}</Heading>
        <Text style={styles.body}>{text("FIRST_TO_TEN")}</Text>
        {state.loading && <Notice testID="race-loading">{text("LOADING_CATEGORIES")}</Notice>}
        <View style={styles.categories}>
          {state.categories.map(category => <Pressable key={category.categoryId} accessibilityRole="button"
            accessibilityState={{selected: state.selected === category.categoryId, disabled: state.busy}}
            disabled={state.busy} onPress={() => controller.select(category.categoryId)}
            style={[styles.category, state.selected === category.categoryId && styles.selected]} testID={`race-category-${category.categoryId}`}>
            <Text style={styles.body}>{text(categoryKeys[category.categoryId])}</Text>
          </Pressable>)}
        </View>
        <ActionButton tone="primary" label={text("LIVE_START")} disabled={state.loading || state.busy || !state.categories.length}
          onPress={() => {void controller.play();}} testID="race-start" />
        <ActionButton label={text("CHALLENGE_FRIEND")} disabled={state.loading || state.busy || !state.categories.length}
          onPress={() => {void controller.play(true);}} testID="race-create-challenge" />
      </Panel>
      {state.invitations.map(invitation => <Panel key={invitation.challengeId}>
        <Heading level={2}>{text("CHALLENGED_BY", {name: invitation.creator.displayName})}</Heading>
        <Text style={styles.body}>{text(categoryKeys[invitation.categoryId])}</Text>
        {invitation.status === "unavailable" ? <Notice>{text("INVITATION_EXPIRED")}</Notice> :
          <ActionButton label={text("ACCEPT_CHALLENGE")} disabled={state.busy} onPress={() => {void controller.play(false, invitation);}}
            testID={`race-accept-${invitation.challengeId}`} />}
      </Panel>)}
    </> : terminal ? <Panel>
      <Heading testID="race-result-title">{text(view.result === "win" ? "RESULT_PLAYER_WIN" : view.result === "loss" ? "RESULT_OPPONENT_WIN" :
        view.result === "tie" ? "RESULT_TIE" : "INVITATION_CANCELLED")}</Heading>
      <RacePlayers view={view} locale={locale} hideOpponent={safetyState === "blocked"} />
      <Text style={styles.time}>{text("FINAL_TIME")}: {formatRaceTime(view.run?.adjustedElapsedMs ?? 0)}</Text>
      {view.rewardCoins > 0 && <Notice testID="race-reward">{text("LIVE_REWARD", {coins: view.rewardCoins})}</Notice>}
      {view.opponent?.bot === false && transport.rematch && <ActionButton label={text("REMATCH")} onPress={() => {void controller.rematch();}} testID="race-rematch" />}
      <ActionButton tone="primary" label={text("LIVE_START")} onPress={() => controller.returnToLobby()} testID="race-play-again" />
      <ActionButton label={text("BACK_TO_GAME")} onPress={() => controller.requestClose()} testID="race-result-back" />
    </Panel> : view.phase === "searching" ? <Panel>
      <Heading testID="race-searching">{text(view.challengeId ? "LOBBY" : "LIVE_FINDING")}</Heading>
      <RacePlayers view={view} locale={locale} hideOpponent={false} />
      {view.challengeId && <>
        <Text style={styles.body}>{text("LIVE_FRIEND_WAIT")}</Text>
        <ActionButton tone="primary" label={text("CHALLENGE_FRIEND")} onPress={() => {void share();}} testID="race-share" />
        <TextInput accessibilityLabel={text("PLAYER_USERNAME")} placeholder={text("PLAYER_USERNAME")} placeholderTextColor={palette.muted}
          value={recipient} maxLength={80} autoCapitalize="none" onChangeText={setRecipient} style={styles.recipient} testID="race-recipient" />
        <ActionButton label={text("NOTIFY_PLAYER")} disabled={recipient.trim().length < 3 || inviteState === "sending"}
          onPress={() => {void sendChallenge();}} testID="race-send-invite" />
        {inviteState === "queued" && <Notice testID="race-invite-queued">{text("INVITE_QUEUED")}</Notice>}
      </>}
    </Panel> : countdown > 0 ? <Panel>
      <Heading>{text("LIVE_STARTING")}</Heading>
      <Text accessibilityLiveRegion="polite" style={styles.countdown} testID="race-countdown">{countdown}</Text>
      <RacePlayers view={view} locale={locale} hideOpponent={false} />
    </Panel> : <>
      <RacePlayers view={view} locale={locale} hideOpponent={safetyState === "blocked"} />
      <Text style={styles.time} testID="race-clock">{text("ADJUSTED_TIME")}: {formatRaceTime(view.run ?
        Math.floor((view.run.adjustedElapsedMs + Math.max(0, state.now - view.serverNowMs)) / 1000) * 1000 : 0).slice(0, -2)}</Text>
      {prompt ? <>
        <Eyebrow>{text("PROGRESS_LABEL") + ` ${view.player.correctCount}/10`}</Eyebrow>
        <Heading testID="race-riddle">{prompt.text}</Heading>
        <View style={styles.attempts} testID="race-guesses">
          {(prompt.confirmedGuesses ?? []).map((row, rowIndex) => <View key={rowIndex} style={styles.cells}>
            {row.guess.map((letter, index) => <View key={index} style={[styles.cell, row.feedback[index] === "green" ? styles.green :
              row.feedback[index] === "yellow" ? styles.yellow : styles.red]}><Text style={styles.letter}>{letter}</Text></View>)}
          </View>)}
          <View style={styles.cells}>
            {state.draft.letters.map((letter, index) => <Pressable key={index} accessibilityRole="button"
              accessibilityLabel={`${text("ANSWER_LABEL")}: ${index + 1}${letter ? `: ${letter}` : ""}`}
              disabled={prompt.revealedLetters.some(hint => hint.index === index)} onPress={() => {controller.edit("slot", index); answerRef.current?.focus();}}
              style={[styles.cell, state.draft.activeSlotIndex === index && styles.selected,
                prompt.revealedLetters.some(hint => hint.index === index) && styles.hinted]} testID={`race-slot-${index}`}>
              <Text style={styles.letter}>{letter}</Text>
            </Pressable>)}
          </View>
        </View>
        <AnswerInput inputRef={answerRef} locale={locale} disabled={false} label={text("ANSWER_LABEL")}
          latinShortcut={prompt.evaluation ? canShowLatinShortcut(prompt.evaluation.answer) : !["ja", "ko", "hi", "ru", "ar"].includes(locale)}
          onText={value => controller.edit("text", value)} onBackspace={() => controller.edit("backspace", "")} onSubmit={() => controller.action("guess")} />
        <ActionButton tone="primary" label={text("SUBMIT")} disabled={state.busy || state.requiresRefresh || state.draft.letters.some(letter => !letter)}
          onPress={() => controller.action("guess")} testID="race-submit" />
        <View style={styles.actions}>
          <ActionButton label={`${text("HINT_BUTTON")} · ${text("HINT_PENALTY")}`} disabled={state.busy || state.requiresRefresh || !prompt.hintAvailable}
            onPress={() => controller.action("hint")} style={styles.action} testID="race-hint" />
          <ActionButton label={`${text("SKIP_BUTTON")} · ${text("SKIP_PENALTY")}`} disabled={state.busy || state.requiresRefresh}
            onPress={() => controller.action("skip")} style={styles.action} testID="race-skip" />
        </View>
      </> : <Notice>{text("LIVE_WAITING_FINISH")}</Notice>}
    </>}
    {view?.opponent && !view.opponent.bot && <Panel>
      <Heading level={2}>{text("SAFETY_ACTIONS")}</Heading>
      {safetyState === "blocked" || safetyState === "reported" ? <Notice>{text(safetyState === "blocked" ? "BLOCK_SUCCESS" : "REPORT_SUCCESS")}</Notice> : <>
        <ActionButton label={text("BLOCK_RIVAL")} disabled={safetyState === "busy"} onPress={() => {void safetyAction("block");}} testID="race-block" />
        <Text style={styles.body}>{text("REPORT_REASON")}</Text>
        <View style={styles.categories}>{([
          ["harassment", "REPORT_HARASSMENT"], ["cheating", "REPORT_CHEATING"], ["inappropriate_identity", "REPORT_IDENTITY"],
          ["spam", "REPORT_SPAM"], ["other", "REPORT_OTHER"],
        ] satisfies [SocialReportCategory, RaceCopyKey][]).map(([category, key]) => <Pressable key={category} accessibilityRole="button"
          accessibilityState={{selected: reportCategory === category}} disabled={safetyState === "busy"} onPress={() => setReportCategory(category)}
          style={[styles.category, reportCategory === category && styles.selected]}><Text style={styles.body}>{text(key)}</Text></Pressable>)}</View>
        <ActionButton label={text("REPORT_RIVAL")} disabled={safetyState === "busy"} onPress={() => {void safetyAction("report");}} testID="race-report" />
      </>}
    </Panel>}
  </Screen>;
}
/** Viewer-specific identity and server-confirmed progress. */
function RacePlayers({view, locale, hideOpponent}: {
  /** Viewer-specific identity and confirmed progress for the scoreboard. */
  view: LiveRaceView;
  /** Device language for existing translated identity labels. */
  locale: YouTubeLocale;
  /** Masks an opponent immediately after a confirmed block. */
  hideOpponent: boolean;
}) {
  /** Viewer and optional rival presented without exposing account identifiers. */
  const players = [view.player, hideOpponent ? null : view.opponent];
  return <View style={styles.players}>{players.map((player, index) => <View key={index} style={styles.player}>
    {player?.avatarUrl && <Image source={{uri: player.avatarUrl}} style={styles.avatar} accessibilityIgnoresInvertColors />}
    <Text style={styles.body}>{index === 0 ? raceText(locale, "YOU") : player?.displayName ?? raceText(locale, "LIVE_OPPONENT")}</Text>
    <Text style={styles.score} testID={index === 0 ? "race-player-score" : "race-opponent-score"}>{player?.correctCount ?? 0}/10</Text>
  </View>)}</View>;
}
/** Native answer tiles wrap for longer translated answers. */
const styles = StyleSheet.create({
  header: {gap: spacing.sm}, body: {color: palette.text, fontSize: 16}, categories: {flexDirection: "row", flexWrap: "wrap", gap: spacing.sm},
  category: {padding: spacing.md, borderWidth: 2, borderColor: palette.border, borderRadius: radius.control, minHeight: 48},
  selected: {borderColor: palette.accent}, players: {flexDirection: "row", justifyContent: "space-around", gap: spacing.sm},
  player: {flex: 1, alignItems: "center", gap: spacing.xs}, score: {color: palette.text, fontSize: 26, fontWeight: "700"},
  avatar: {width: 40, height: 40, borderRadius: 20}, time: {color: palette.text, fontSize: 18, fontWeight: "600", textAlign: "center"},
  countdown: {color: palette.accent, fontSize: 72, textAlign: "center", fontWeight: "700"}, attempts: {gap: spacing.xs},
  cells: {flexDirection: "row", flexWrap: "wrap", gap: 4}, cell: {height: 44, minWidth: 30, paddingHorizontal: 6, borderWidth: 2,
    borderColor: palette.border, borderRadius: 8, backgroundColor: palette.tile, justifyContent: "center", alignItems: "center"},
  letter: {color: palette.text, fontSize: 22, fontWeight: "700", textTransform: "uppercase"},
  green: {backgroundColor: palette.tileGreen}, yellow: {backgroundColor: palette.tileYellow}, red: {backgroundColor: palette.tileRed},
  hinted: {backgroundColor: palette.tileHinted}, actions: {flexDirection: "row", gap: spacing.sm}, action: {flex: 1},
  recipient: {color: palette.text, borderWidth: 1, borderColor: palette.border, borderRadius: radius.control, padding: spacing.sm, minHeight: 48},
});
