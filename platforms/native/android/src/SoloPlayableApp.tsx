import {trackEvent, trackScreen} from "../../../../src/observability/analytics/eventsRuntime";
import {youtubeText, type YouTubeCopyKey} from "../../../../src/localization/copy/localGameCopy";
import {type YouTubeContentSource} from "../../../../src/content/catalog/bundledContent";
import {type YouTubeSdkPort} from "../../../../src/gameplay/local/types";
import {useYouTubePlayableBoot, useYouTubeReadySession, type YouTubeRuntime} from "../../../../src/gameplay/local/hooks/index";
import {useEffect, useRef, useState} from "react";
import type {AnswerEditor} from "./screens/AnswerInput";
import {FailureScreen, LoadingScreen, ResetScreen} from "./screens/BootScreens";
import {GameScreen} from "./screens/GameScreen";
import {MenuScreen, type OnlineAction} from "./screens/MenuScreen";
import {ProgressScreen} from "./screens/ProgressScreen";
import {ResultScreen} from "./screens/ResultScreen";
/** Props for {@link SoloPlayableApp}. */
export type SoloPlayableAppProps = Readonly<{
  /** Host services: save transport, locale, lifecycle. */
  sdk: YouTubeSdkPort;
  /** Bundled content bound to this app. */
  contentSource: YouTubeContentSource;
  /** Way back to hosted play; absent in self-contained tests. */
  online?: OnlineAction;
}>;
/**
 * Native counterpart of the web `YouTubePlayableApp`: the self-contained,
 * offline game whose progress never leaves the device.
 *
 * @remarks
 * Boot, recovery, and gameplay transitions come from the shared controllers in
 * `src/gameplay/local/hooks`; this component only maps their state to native screens.
 */
export function SoloPlayableApp({sdk, contentSource, online}: SoloPlayableAppProps) {
  /** Shared boot controller. */
  const {state: boot, platformPaused, retry, setResetConfirmation, resetSave} = useYouTubePlayableBoot(sdk, contentSource);
  if (boot.kind === "loading") return <LoadingScreen paused={platformPaused} />;
  if (boot.kind === "load-failed") {
    return <FailureScreen locale="en" message="loadFailed" onRetry={retry} paused={platformPaused} />;
  }
  if (boot.kind === "pre-locale-save-failed") {
    return <FailureScreen locale="en" message="saveFailed" onRetry={retry} paused={platformPaused} />;
  }
  if (boot.kind === "recovery-save-failed") {
    return <FailureScreen locale={boot.runtime.locale} message="saveFailed" onRetry={retry} paused={platformPaused} />;
  }
  if (boot.kind === "reset-save-failed") {
    return <FailureScreen locale={boot.reset.locale} message="saveFailed" onRetry={retry} paused={platformPaused} />;
  }
  if (boot.kind === "reset-required") {
    return (
      <ResetScreen
        locale={boot.reset.locale}
        reason={boot.reset.kind}
        confirming={boot.confirming}
        setConfirming={setResetConfirmation}
        onReset={() => {trackEvent("offline_save_reset_requested"); void resetSave();}}
        paused={platformPaused}
      />
    );
  }
  return <ReadySoloApp runtime={boot.runtime} sdk={sdk} online={online} />;
}
/** Props for {@link ReadySoloApp}. */
type ReadySoloAppProps = Readonly<{
  /** Prepared runtime. */
  runtime: YouTubeRuntime;
  /** Host services. */
  sdk: YouTubeSdkPort;
  /** Way back to hosted play, when the build has it. */
  online?: OnlineAction;
}>;
/** Secondary screens reachable while no local puzzle is active. */
type ReadyScreen = "menu" | "progress";
/** Routes the ready session between result, gameplay, progress, and menu screens. */
function ReadySoloApp({runtime, sdk, online}: ReadySoloAppProps) {
  /** Locale, content, and authority prepared by boot. */
  const {locale, content, authority} = runtime;
  /** Secondary screen selection while no puzzle is active. */
  const [screen, setScreen] = useState<ReadyScreen>("menu");
  /** Native answer editor. */
  const inputRef = useRef<AnswerEditor | null>(null);
  /** Shared ready-session controller. */
  const {snapshot, today, notice, run} = useYouTubeReadySession(authority, sdk, {
    focusAnswer: () => inputRef.current?.focus(),
  });
  /** Localized copy lookup. */
  const text = (key: YouTubeCopyKey): string => youtubeText(locale, key);
  /** Active puzzle state. */
  const active = snapshot.save.activeGame;
  const analyticsScreen = snapshot.lastResult ? "offline_result" : active ? `offline_game_${active.mode}` : `offline_${screen}`;
  const analyticsMode = active?.mode ?? snapshot.lastResult?.mode;
  useEffect(() => {trackScreen(analyticsScreen, {play_surface: "offline", game_mode: analyticsMode === "daily" ? "challenge" : analyticsMode});}, [analyticsScreen, analyticsMode]);
  const resumed = useRef(false);
  useEffect(() => {
    if (resumed.current) return;
    resumed.current = true;
    if (active) trackEvent("game_resumed", {game_mode: active.mode === "daily" ? "challenge" : active.mode, play_surface: "offline"});
  }, [active]);
  if (snapshot.lastResult) {
    return <ResultScreen locale={locale} authority={authority} snapshot={snapshot} result={snapshot.lastResult} run={run} text={text} />;
  }
  if (active && snapshot.activeRiddle && snapshot.displayLetters) {
    return (
      <GameScreen
        locale={locale}
        authority={authority}
        snapshot={snapshot}
        active={active}
        riddle={snapshot.activeRiddle}
        displayLetters={snapshot.displayLetters}
        notice={notice}
        run={run}
        text={text}
        inputRef={inputRef}
      />
    );
  }
  if (screen === "progress") {
    return (
      <ProgressScreen
        locale={locale}
        content={content}
        authority={authority}
        snapshot={snapshot}
        run={run}
        text={text}
        onBack={() => setScreen("menu")}
      />
    );
  }
  return (
    <MenuScreen
      locale={locale}
      content={content}
      authority={authority}
      snapshot={snapshot}
      today={today}
      notice={notice}
      run={run}
      text={text}
      onShowProgress={() => setScreen("progress")}
      online={online}
    />
  );
}
