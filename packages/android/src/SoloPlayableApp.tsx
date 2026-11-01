import {youtubeText, type YouTubeContentSource, type YouTubeCopyKey, type YouTubeSdkPort} from "@qwordly/solo";
import {useYouTubePlayableBoot, useYouTubeReadySession, type YouTubeRuntime} from "@qwordly/solo/react";
import {useRef, useState} from "react";
import type {AnswerEditor} from "./screens/AnswerInput";
import type {HostServices, WebGameMode} from "@qwordly/hosted/hostTypes";
import type {HostedFirebaseClient} from "./hosted/firebaseClient";
import {HostedGameScreen} from "./screens/HostedGameScreen";
import {AccountScreen} from "./screens/AccountScreen";
import {FailureScreen, LoadingScreen, ResetScreen} from "./screens/BootScreens";
import {GameScreen} from "./screens/GameScreen";
import {MenuScreen} from "./screens/MenuScreen";
import {ProgressScreen} from "./screens/ProgressScreen";
import {ResultScreen} from "./screens/ResultScreen";
/** Props for {@link SoloPlayableApp}. */
export type SoloPlayableAppProps = Readonly<{
  /** Host services: save transport, locale, lifecycle. */
  sdk: YouTubeSdkPort;
  /** Bundled content bound to this app. */
  contentSource: YouTubeContentSource;
  /** Hosted Firebase client for the account surface; absent in self-contained tests. */
  hosted?: HostedFirebaseClient;
  /** Shared hosted play services; absent in self-contained tests. */
  hostedServices?: HostServices;
}>;
/**
 * Native counterpart of the web `YouTubePlayableApp`.
 *
 * @remarks
 * Boot, recovery, and gameplay transitions come from the shared controllers in
 * `@qwordly/solo/react`; this component only maps their state to native screens.
 */
export function SoloPlayableApp({sdk, contentSource, hosted, hostedServices}: SoloPlayableAppProps) {
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
        onReset={resetSave}
        paused={platformPaused}
      />
    );
  }
  return <ReadySoloApp runtime={boot.runtime} sdk={sdk} hosted={hosted} hostedServices={hostedServices} />;
}
/** Props for {@link ReadySoloApp}. */
type ReadySoloAppProps = Readonly<{
  /** Prepared runtime. */
  runtime: YouTubeRuntime;
  /** Host services. */
  sdk: YouTubeSdkPort;
  /** Hosted Firebase client, when the account surface is available. */
  hosted?: HostedFirebaseClient;
  /** Shared hosted play services, when hosted play is available. */
  hostedServices?: HostServices;
}>;
/** Secondary screens reachable while no local puzzle is active. */
type ReadyScreen = "menu" | "progress" | "account" | {
  /** Server-authoritative play. */
  hosted: WebGameMode;
};
/** Routes the ready session between result, gameplay, progress, account, hosted play, and menu screens. */
function ReadySoloApp({runtime, sdk, hosted, hostedServices}: ReadySoloAppProps) {
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
  if (typeof screen === "object" && hostedServices) {
    return <HostedGameScreen services={hostedServices} mode={screen.hosted} locale={locale} onBack={() => setScreen("account")} />;
  }
  if (screen === "account" && hosted) {
    return (
      <AccountScreen
        client={hosted}
        onBack={() => setScreen("menu")}
        onPlay={hostedServices ? (mode) => setScreen({hosted: mode}) : undefined}
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
      onShowAccount={hosted ? () => setScreen("account") : undefined}
    />
  );
}
