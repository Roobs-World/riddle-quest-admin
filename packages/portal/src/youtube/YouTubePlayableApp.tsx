import {useCallback, useEffect, useRef, useState} from "react";
import {splitGraphemes} from "@qwordly/core/game";
import {loadYouTubeContent, resolveYouTubeLocale} from "./content";
import {
  YOUTUBE_CLASSIC_SKIP_COST,
  YOUTUBE_CONTINUE_COST,
  YOUTUBE_HINT_COST,
  utcDay,
} from "./economy";
import {youtubeDirection, youtubeText, type YouTubeCopyKey} from "./i18n";
import {
  deleteYouTubeAnswerLetter,
  insertYouTubeAnswerText,
  canShowLatinShortcut,
  normalizeLatinShortcutKey,
} from "./input";
import {
  LocalSoloAuthority,
  YouTubeAuthorityError,
  YouTubeAuthorityRestoreSaveError,
  type YouTubeAuthoritySnapshot,
} from "./LocalSoloAuthority";
import {cloneYouTubeSave, createEmptyYouTubeSave, parseYouTubeSave} from "./save";
import type {YouTubeContent, YouTubeLocale, YouTubeSaveV1, YouTubeSdkPort} from "./types";
import {YouTubeNativeAnswerInput} from "./YouTubeNativeAnswerInput";
import {YouTubeSaveBlockedError, YouTubeSaveGate} from "./YouTubeSaveGate";
import {AchievementIcon, SaveBanner, StatusHeader} from "./YouTubePlayableViews";

/** Describes runtime. */
type Runtime = Readonly<{
  locale: YouTubeLocale;
  content: YouTubeContent;
  authority: LocalSoloAuthority;
}>;

/** Describes reset state. */
type ResetState = Readonly<{
  kind: "invalid" | "future-version";
  locale: YouTubeLocale;
  content: YouTubeContent;
  raw: string;
}>;

/** Describes reset failure. */
type ResetFailure = Readonly<{
  locale: YouTubeLocale;
  content: YouTubeContent;
  save: YouTubeSaveV1;
  gate: YouTubeSaveGate;
}>;

/** Describes prepared loaded save. */
type PreparedLoadedSave = Readonly<{
  save: YouTubeSaveV1;
  gate: YouTubeSaveGate;
  recoveredActiveGame: boolean;
}>;

/** Describes prepared runtime result. */
type PreparedRuntimeResult =
  | {kind: "ready"; runtime: Runtime}
  | {kind: "recovery-save-failed"; runtime: Runtime};

/** Describes boot state. */
type BootState =
  | {kind: "loading"}
  | {kind: "load-failed"}
  | {kind: "pre-locale-save-failed"; prepared: PreparedLoadedSave}
  | {kind: "recovery-save-failed"; runtime: Runtime}
  | {kind: "reset-required"; reset: ResetState; confirming: boolean}
  | {kind: "reset-save-failed"; reset: ResetFailure}
  | {kind: "ready"; runtime: Runtime};

/** Requests next frame. */
const requestNextFrame = (callback: () => void): number => {
  if (typeof requestAnimationFrame === "function") return requestAnimationFrame(callback);
  callback();
  return 0;
};

/** Provides cancel next frame behavior. */
const cancelNextFrame = (id: number): void => {
  if (id && typeof cancelAnimationFrame === "function") cancelAnimationFrame(id);
};

/** Provides milliseconds until next utc day behavior. */
const millisecondsUntilNextUtcDay = (now: Date): number => {
  const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  // A small boundary cushion avoids rescheduling against the previous day on
  // clocks whose timeout fires fractionally early.
  return Math.max(1, next - now.getTime() + 50);
};

/** Provides mark paused behavior. */
const markPaused = (paused: boolean): void => {
  document.documentElement.classList.toggle("youtube-game-paused", paused);
  const root = document.querySelector<HTMLElement>("[data-youtube-playable-root]");
  if (paused) root?.setAttribute("inert", "");
  else root?.removeAttribute("inert");
};

/** Provides authority error key behavior. */
const authorityErrorKey = (error: unknown): YouTubeCopyKey => {
  const code = error instanceof YouTubeAuthorityError ? error.code : "";
  if (code === "coins-insufficient") return "insufficientCoins";
  if (code === "answer-incomplete") return "answerIncomplete";
  if (code === "daily-unavailable") return "dailyUnavailable";
  if (error instanceof YouTubeSaveBlockedError) return "saveFailed";
  return "operationFailed";
};

/** Provides you tube playable app behavior. */
export function YouTubePlayableApp({sdk}: {sdk: YouTubeSdkPort}) {
  const [boot, setBoot] = useState<BootState>({kind: "loading"});
  const [bootAttempt, setBootAttempt] = useState(0);
  const [platformPaused, setPlatformPaused] = useState(false);
  const authorityRef = useRef<LocalSoloAuthority | null>(null);
  const pausedRef = useRef(false);
  const resumeWaitersRef = useRef(new Set<() => void>());
  const pendingAudioRef = useRef(false);

  const waitUntilActive = useCallback((): Promise<void> => {
    if (!pausedRef.current) return Promise.resolve();
    return new Promise((resolve) => resumeWaitersRef.current.add(resolve));
  }, []);

  const finishBoot = useCallback((runtime: Runtime) => {
    authorityRef.current = runtime.authority;
    if (pausedRef.current) runtime.authority.setPaused(true);
    setBoot({kind: "ready", runtime});
  }, []);

  const resolvePreparedRuntime = useCallback(async (
    prepared: PreparedLoadedSave,
    cancelled: () => boolean = () => false,
  ): Promise<PreparedRuntimeResult | null> => {
    const languageTag = await sdk.getLanguage();
    await waitUntilActive();
    if (cancelled()) return null;
    const locale = resolveYouTubeLocale(languageTag);
    const content = loadYouTubeContent(locale);
    let authority: LocalSoloAuthority;
    try {
      authority = await LocalSoloAuthority.restore(
        prepared.save,
        content,
        prepared.gate,
        undefined,
        false,
        false,
        prepared.recoveredActiveGame,
      );
    } catch (error) {
      if (!(error instanceof YouTubeAuthorityRestoreSaveError)) throw error;
      return {
        kind: "recovery-save-failed",
        runtime: {locale, content, authority: error.authority},
      };
    }
    await waitUntilActive();
    return cancelled() ? null : {kind: "ready", runtime: {locale, content, authority}};
  }, [sdk, waitUntilActive]);

  const applyPreparedRuntime = useCallback((result: PreparedRuntimeResult): void => {
    if (result.kind === "ready") finishBoot(result.runtime);
    else setBoot(result);
  }, [finishBoot]);

  useEffect(() => {
    let cancelled = false;
    const frame = requestNextFrame(() => {
      void (async () => {
        try {
          await waitUntilActive();
          if (cancelled) return;
          sdk.firstFrameReady();
          // Cloud Save authority is established before any locale/content state can mutate it.
          const raw = await sdk.loadData();
          await waitUntilActive();
          if (cancelled) return;
          const baseContent = loadYouTubeContent("en");
          const parsed = parseYouTubeSave(raw, baseContent.contentVersion);
          if (parsed.kind === "invalid" || parsed.kind === "future-version") {
            const languageTag = await sdk.getLanguage();
            await waitUntilActive();
            if (cancelled) return;
            const locale = resolveYouTubeLocale(languageTag);
            const content = loadYouTubeContent(locale);
            setBoot({kind: "reset-required", reset: {kind: parsed.kind, locale, content, raw: parsed.raw}, confirming: false});
            return;
          }
          const gate = new YouTubeSaveGate(sdk);
          const recoveredActiveGame = parsed.kind === "valid" && parsed.recoveredActiveGame === true;
          const requiresMigrationSave = parsed.kind === "valid" && parsed.migratedFromSchemaVersion === 0;
          let prepared: PreparedLoadedSave = {save: parsed.save, gate, recoveredActiveGame};
          if (recoveredActiveGame || requiresMigrationSave) {
            const migrated = cloneYouTubeSave(parsed.save);
            migrated.revision += 1;
            gate.stage(migrated);
            prepared = {save: migrated, gate, recoveredActiveGame};
            try {
              await gate.commitStaged();
            } catch {
              await waitUntilActive();
              if (!cancelled) setBoot({kind: "pre-locale-save-failed", prepared});
              return;
            }
          }
          const result = await resolvePreparedRuntime(prepared, () => cancelled);
          if (result) applyPreparedRuntime(result);
        } catch {
          await waitUntilActive();
          if (!cancelled) {
            sdk.logError();
            setBoot({kind: "load-failed"});
          }
        }
      })();
    });
    return () => {
      cancelled = true;
      cancelNextFrame(frame);
    };
  }, [applyPreparedRuntime, bootAttempt, resolvePreparedRuntime, sdk, waitUntilActive]);

  useEffect(() => {
    const setAudio = (enabled: boolean): void => {
      pendingAudioRef.current = enabled;
      if (pausedRef.current) return;
      document.documentElement.dataset.youtubeAudio = enabled ? "enabled" : "disabled";
    };
    setAudio(sdk.isAudioEnabled());
    const removeAudio = sdk.onAudioEnabledChange(setAudio);
    const removePause = sdk.onPause(() => {
      pausedRef.current = true;
      setPlatformPaused(true);
      markPaused(true);
      authorityRef.current?.setPaused(true);
    });
    const removeResume = sdk.onResume(() => {
      pausedRef.current = false;
      setPlatformPaused(false);
      markPaused(false);
      document.documentElement.dataset.youtubeAudio = pendingAudioRef.current ? "enabled" : "disabled";
      authorityRef.current?.setPaused(false);
      for (const resume of resumeWaitersRef.current) resume();
      resumeWaitersRef.current.clear();
    });
    return () => {
      removeAudio();
      removePause();
      removeResume();
      for (const resume of resumeWaitersRef.current) resume();
      resumeWaitersRef.current.clear();
      markPaused(false);
    };
  }, [sdk]);

  const retryBoot = (): void => {
    setBoot({kind: "loading"});
    setBootAttempt((attempt) => attempt + 1);
  };

  const resetFresh = async (reset: ResetState): Promise<void> => {
    const save = createEmptyYouTubeSave(reset.content.contentVersion);
    save.revision = 1;
    const gate = new YouTubeSaveGate(sdk);
    setBoot({kind: "loading"});
    try {
      await gate.commit(save);
      await waitUntilActive();
      const authority = await LocalSoloAuthority.restore(save, reset.content, gate);
      await waitUntilActive();
      finishBoot({locale: reset.locale, content: reset.content, authority});
    } catch {
      await waitUntilActive();
      sdk.logWarning();
      setBoot({kind: "reset-save-failed", reset: {locale: reset.locale, content: reset.content, save, gate}});
    }
  };

  const retryResetSave = async (reset: ResetFailure): Promise<void> => {
    setBoot({kind: "loading"});
    try {
      await reset.gate.retry();
      await waitUntilActive();
      const authority = await LocalSoloAuthority.restore(reset.save, reset.content, reset.gate);
      await waitUntilActive();
      finishBoot({locale: reset.locale, content: reset.content, authority});
    } catch {
      await waitUntilActive();
      setBoot({kind: "reset-save-failed", reset});
    }
  };

  const retryRecoverySave = async (runtime: Runtime): Promise<void> => {
    setBoot({kind: "loading"});
    try {
      await runtime.authority.retryPendingSave();
      await waitUntilActive();
      finishBoot(runtime);
    } catch {
      await waitUntilActive();
      setBoot({kind: "recovery-save-failed", runtime});
    }
  };

  const retryPreLocaleSave = async (prepared: PreparedLoadedSave): Promise<void> => {
    setBoot({kind: "loading"});
    try {
      await prepared.gate.retry();
      await waitUntilActive();
      const result = await resolvePreparedRuntime(prepared);
      await waitUntilActive();
      if (result) applyPreparedRuntime(result);
    } catch {
      await waitUntilActive();
      setBoot({kind: "pre-locale-save-failed", prepared});
    }
  };

  if (boot.kind === "loading") {
    return <main className="yt-shell yt-loading" data-youtube-playable-root aria-busy="true" inert={platformPaused}>
      <div className="yt-loader" aria-hidden="true" />
      <p>{youtubeText("en", "loading")}</p>
    </main>;
  }
  if (boot.kind === "load-failed") {
    return <main className="yt-shell yt-center" data-youtube-playable-root lang="en" inert={platformPaused}>
      <h1>{youtubeText("en", "title")}</h1>
      <p role="alert">{youtubeText("en", "loadFailed")}</p>
      <button className="yt-primary" onClick={retryBoot}>{youtubeText("en", "retry")}</button>
    </main>;
  }
  if (boot.kind === "pre-locale-save-failed") {
    return <main className="yt-shell yt-center" data-youtube-playable-root lang="en" inert={platformPaused}>
      <h1>{youtubeText("en", "title")}</h1>
      <p role="alert">{youtubeText("en", "saveFailed")}</p>
      <button className="yt-primary" onClick={() => { void retryPreLocaleSave(boot.prepared); }}>
        {youtubeText("en", "retry")}
      </button>
    </main>;
  }
  if (boot.kind === "recovery-save-failed") {
    const {locale} = boot.runtime;
    return <main className="yt-shell yt-center" data-youtube-playable-root lang={locale} dir={youtubeDirection(locale)} inert={platformPaused}>
      <h1>{youtubeText(locale, "title")}</h1>
      <p role="alert">{youtubeText(locale, "saveFailed")}</p>
      <button className="yt-primary" onClick={() => { void retryRecoverySave(boot.runtime); }}>
        {youtubeText(locale, "retry")}
      </button>
    </main>;
  }
  if (boot.kind === "reset-save-failed") {
    const {locale} = boot.reset;
    return <main className="yt-shell yt-center" data-youtube-playable-root lang={locale} dir={youtubeDirection(locale)} inert={platformPaused}>
      <h1>{youtubeText(locale, "title")}</h1>
      <p role="alert">{youtubeText(locale, "saveFailed")}</p>
      <button className="yt-primary" onClick={() => { void retryResetSave(boot.reset); }}>
        {youtubeText(locale, "retry")}
      </button>
    </main>;
  }
  if (boot.kind === "reset-required") {
    const {locale} = boot.reset;
    return <main className="yt-shell yt-center" data-youtube-playable-root lang={locale} dir={youtubeDirection(locale)} inert={platformPaused}>
      <h1>{youtubeText(locale, boot.confirming ? "confirmReset" : "title")}</h1>
      <p role="alert">{youtubeText(locale, boot.confirming
        ? "confirmResetBody"
        : boot.reset.kind === "future-version" ? "futureSave" : "incompatibleSave")}</p>
      {boot.confirming ? <div className="yt-actions">
        <button className="yt-danger" onClick={() => { void resetFresh(boot.reset); }}>{youtubeText(locale, "resetSave")}</button>
        <button onClick={() => setBoot({...boot, confirming: false})}>{youtubeText(locale, "cancel")}</button>
      </div> : <button className="yt-danger" onClick={() => setBoot({...boot, confirming: true})}>
        {youtubeText(locale, "resetSave")}
      </button>}
    </main>;
  }
  return <ReadyYouTubeApp runtime={boot.runtime} sdk={sdk} />;
}

/** Provides ready you tube app behavior. */
function ReadyYouTubeApp({runtime, sdk}: {runtime: Runtime; sdk: YouTubeSdkPort}) {
  const {locale, content, authority} = runtime;
  const [snapshot, setSnapshot] = useState<YouTubeAuthoritySnapshot>(() => authority.getSnapshot());
  const [screen, setScreen] = useState<"menu" | "progress">("menu");
  const [notice, setNotice] = useState<YouTubeCopyKey | null>(null);
  const [today, setToday] = useState(() => utcDay(new Date()));
  const inputRef = useRef<HTMLInputElement>(null);
  const text = (key: YouTubeCopyKey): string => youtubeText(locale, key);

  useEffect(() => authority.subscribe(() => setSnapshot(authority.getSnapshot())), [authority]);
  useEffect(() => {
    document.documentElement.classList.toggle("youtube-reduced-motion", snapshot.save.preferences.reducedMotion);
    document.documentElement.classList.toggle("youtube-high-contrast", snapshot.save.preferences.highContrast);
    return () => {
      document.documentElement.classList.remove("youtube-reduced-motion", "youtube-high-contrast");
    };
  }, [snapshot.save.preferences.highContrast, snapshot.save.preferences.reducedMotion]);
  useEffect(() => {
    if (!snapshot.paused) sdk.gameReady();
  }, [sdk, snapshot.paused]);
  useEffect(() => {
    if (snapshot.activeRiddle && !snapshot.paused) inputRef.current?.focus();
  }, [snapshot.activeRiddle, snapshot.paused]);
  useEffect(() => {
    if (snapshot.paused) return;
    const now = new Date();
    setToday(utcDay(now));
    const timer = window.setTimeout(() => setToday(utcDay(new Date())), millisecondsUntilNextUtcDay(now));
    return () => window.clearTimeout(timer);
  }, [snapshot.paused, today]);

  const run = async (action: () => Promise<unknown>): Promise<void> => {
    setNotice(null);
    try {
      await action();
    } catch (error) {
      setNotice(authorityErrorKey(error));
    }
  };

  const active = snapshot.save.activeGame;
  const riddle = snapshot.activeRiddle;
  const displayLetters = snapshot.displayLetters;
  const progression = snapshot.save.progression;
  const materialDisabled = snapshot.busy || snapshot.paused || snapshot.saveBlocked;

  const applyText = (value: string): void => {
    if (!active || !riddle || !displayLetters) return;
    const updated = insertYouTubeAnswerText(
      {letters: [...displayLetters], activeSlotIndex: snapshot.activeSlotIndex},
      value,
      displayLetters.length,
      active.hintRevealedIndices,
      locale,
    );
    authority.setInput(updated.letters, updated.activeSlotIndex);
  };
  const backspace = (): void => {
    if (!active || !displayLetters) return;
    const updated = deleteYouTubeAnswerLetter(
      {letters: [...displayLetters], activeSlotIndex: snapshot.activeSlotIndex},
      displayLetters.length,
      active.hintRevealedIndices,
    );
    authority.setInput(updated.letters, updated.activeSlotIndex);
  };

  if (snapshot.lastResult) {
    const result = snapshot.lastResult;
    return <main className="yt-shell yt-center" data-youtube-playable-root lang={locale} dir={youtubeDirection(locale)} inert={snapshot.paused}>
      <StatusHeader snapshot={snapshot} locale={locale} />
      {snapshot.saveBlocked && <SaveBanner text={text} retry={() => run(() => authority.retryPendingSave())} />}
      <section className="yt-panel yt-result" aria-live="polite">
        <div className="yt-result-icon" aria-hidden="true">{result.kind === "win" ? "✨" : result.kind === "skip" ? "⏭" : "🌙"}</div>
        <h1>{text(result.kind === "win" ? "victory" : result.kind === "skip" ? "skipped" : "loss")}</h1>
        <dl className="yt-result-stats">
          <div><dt>{text("attempts")}</dt><dd>{result.attempts}</dd></div>
          <div><dt>{text("coinsEarned")}</dt><dd>{result.coinsEarned}</dd></div>
          <div><dt>{text("xpEarned")}</dt><dd>{result.xpEarned}</dd></div>
        </dl>
        {result.newlyUnlockedAchievementIds.length > 0 && <div>
          <h2>{text("newAchievements")}</h2>
          <div className="yt-achievement-icons" aria-label={text("newAchievements")}>
            {result.newlyUnlockedAchievementIds.map((id) => <AchievementIcon key={id} id={id} text={text} />)}
          </div>
        </div>}
        <button className="yt-primary" disabled={materialDisabled} onClick={() => authority.clearResult()}>{text("continueToMenu")}</button>
      </section>
    </main>;
  }

  if (active && riddle && displayLetters) {
    const latinShortcut = canShowLatinShortcut(riddle.answer);
    return <main className="yt-shell" data-youtube-playable-root lang={locale} dir={youtubeDirection(locale)} inert={snapshot.paused}>
      <StatusHeader snapshot={snapshot} locale={locale} />
      {snapshot.saveBlocked && <SaveBanner text={text} retry={() => run(() => authority.retryPendingSave())} />}
      {notice && <p className="yt-notice" role="alert">{text(notice)}</p>}
      <section className="yt-puzzle" aria-busy={snapshot.busy}>
        <p className="yt-eyebrow">{text(active.mode === "classic" ? "classic" : "daily")} · {text("riddle")}</p>
        <h1>{riddle.text}</h1>
        <div className="yt-guesses" aria-label={text("attempts")}>
          {active.guesses.map((guess, row) => <div className="yt-guess-row" key={row}>
            {guess.letters.map((letter, index) => <span className={`yt-tile ${guess.feedback[index]}`} key={index}>{letter}</span>)}
          </div>)}
          <div className="yt-guess-row current">
            {displayLetters.map((letter, index) => <button
              className={`yt-tile ${snapshot.activeSlotIndex === index ? "active" : ""} ${active.hintRevealedIndices.includes(index) ? "hinted" : ""}`}
              disabled={materialDisabled || active.hintRevealedIndices.includes(index)}
              onClick={() => { authority.setActiveSlot(index); inputRef.current?.focus(); }}
              key={index}
            >{letter}</button>)}
          </div>
        </div>
        <YouTubeNativeAnswerInput
          ref={inputRef}
          disabled={materialDisabled || active.awaitingContinue}
          locale={locale}
          label={text("inputLabel")}
          onText={applyText}
          onBackspace={backspace}
          onSubmit={() => { if (!materialDisabled) void run(() => authority.submitGuess()); }}
        />
        {latinShortcut && <div className="yt-keyboard" aria-hidden="true">
          {"QWERTYUIOPASDFGHJKLZXCVBNM".split("").map((letter) => <button
            tabIndex={-1}
            disabled={materialDisabled || active.awaitingContinue}
            onClick={() => applyText(normalizeLatinShortcutKey(letter))}
            key={letter}
          >{letter}</button>)}
          <button tabIndex={-1} disabled={materialDisabled || active.awaitingContinue} onClick={backspace}>⌫</button>
        </div>}
        {active.awaitingContinue ? <div className="yt-continue-panel">
          <button className="yt-primary" disabled={materialDisabled || progression.coins < YOUTUBE_CONTINUE_COST}
            onClick={() => { void run(() => authority.buyContinue()); }}>
            {text("buyContinue")} · {YOUTUBE_CONTINUE_COST} {text("coins")}
          </button>
          <button disabled={materialDisabled} onClick={() => { void run(() => authority.finishWithoutContinue()); }}>{text("finishRun")}</button>
        </div> : <div className="yt-actions">
          <button className="yt-primary" disabled={materialDisabled || displayLetters.some((letter) => !letter)}
            onClick={() => { void run(() => authority.submitGuess()); }}>{text("submit")}</button>
          <button disabled={materialDisabled || progression.coins < YOUTUBE_HINT_COST}
            onClick={() => { void run(() => authority.requestHint()); }}>{text("hint")} · {YOUTUBE_HINT_COST}</button>
          {active.mode === "classic" && <button disabled={materialDisabled || progression.coins < YOUTUBE_CLASSIC_SKIP_COST}
            onClick={() => { void run(() => authority.skipClassic()); }}>{text("skip")} · {YOUTUBE_CLASSIC_SKIP_COST}</button>}
        </div>}
      </section>
    </main>;
  }

  if (screen === "progress") {
    const rank = Math.max(1, [1, 3, 6, 10, 15, 21, 28, 36].filter((threshold) => progression.level >= threshold).length);
    return <main className="yt-shell" data-youtube-playable-root lang={locale} dir={youtubeDirection(locale)} inert={snapshot.paused}>
      <StatusHeader snapshot={snapshot} locale={locale} />
      {snapshot.saveBlocked && <SaveBanner text={text} retry={() => run(() => authority.retryPendingSave())} />}
      <section className="yt-panel">
        <button className="yt-back" disabled={materialDisabled} onClick={() => setScreen("menu")}>← {text("back")}</button>
        <h1>{text("progress")}</h1>
        <dl className="yt-progress-grid">
          <div><dt>{text("level")}</dt><dd>{progression.level}</dd></div>
          <div><dt>{text("rank")}</dt><dd>{rank}</dd></div>
          <div><dt>{text("xp")}</dt><dd>{progression.xp}</dd></div>
          <div><dt>{text("coins")}</dt><dd>{progression.coins}</dd></div>
          <div><dt>{text("games")}</dt><dd>{progression.gamesPlayed}</dd></div>
          <div><dt>{text("wins")}</dt><dd>{progression.totalWins}</dd></div>
          <div><dt>{text("streak")}</dt><dd>{progression.currentDailyStreak}</dd></div>
          <div><dt>{text("classicProgress")}</dt><dd>{Math.min(progression.classicIndex, content.classicOrder.length)}/{content.classicOrder.length}</dd></div>
        </dl>
        <h2>{text("achievements")}</h2>
        {progression.unlockedAchievementIds.length > 0
          ? <div className="yt-achievement-icons" aria-label={text("achievements")}>
            {progression.unlockedAchievementIds.map((id) => <AchievementIcon key={id} id={id} text={text} />)}
          </div>
          : <p>{text("noAchievements")}</p>}
        <fieldset className="yt-preferences" disabled={materialDisabled}>
          <legend>{text("progress")}</legend>
          <label><input type="checkbox" checked={snapshot.save.preferences.reducedMotion}
            onChange={(event) => { void run(() => authority.setAccessibilityPreference("reducedMotion", event.currentTarget.checked)); }} />
          {text("reducedMotion")}</label>
          <label><input type="checkbox" checked={snapshot.save.preferences.highContrast}
            onChange={(event) => { void run(() => authority.setAccessibilityPreference("highContrast", event.currentTarget.checked)); }} />
          {text("highContrast")}</label>
        </fieldset>
      </section>
    </main>;
  }

  const classicComplete = progression.classicIndex >= content.classicOrder.length;
  const dailyComplete = Boolean(progression.lastDailyCompletedDate && progression.lastDailyCompletedDate >= today);
  return <main className="yt-shell" data-youtube-playable-root lang={locale} dir={youtubeDirection(locale)} inert={snapshot.paused}>
    <StatusHeader snapshot={snapshot} locale={locale} />
    {snapshot.saveBlocked && <SaveBanner text={text} retry={() => run(() => authority.retryPendingSave())} />}
    {snapshot.recoveryNotice && <div className="yt-banner" role="status">
      <span>{text("recovered")}</span><button onClick={() => authority.dismissRecoveryNotice()}>{text("dismiss")}</button>
    </div>}
    {!snapshot.save.preferences.guidanceComplete && <div className="yt-banner" role="status">
      <span>{text("chooseMode")}: {text("classic")} · {text("daily")}</span>
      <button disabled={materialDisabled} onClick={() => { void run(() => authority.completeGuidance()); }}>{text("dismiss")}</button>
    </div>}
    {notice && <p className="yt-notice" role="alert">{text(notice)}</p>}
    <section className="yt-menu">
      <div><p className="yt-eyebrow">{text("title")}</p><h1>{text("chooseMode")}</h1></div>
      <div className="yt-mode-grid">
        <button className="yt-mode-card" disabled={materialDisabled || classicComplete}
          onClick={() => { void run(() => authority.start("classic")); }}>
          <span aria-hidden="true">🪐</span><strong>{text("classic")}</strong>
          <small>{classicComplete ? text("classicComplete") : `${progression.classicIndex + 1}/${content.classicOrder.length}`}</small>
        </button>
        <button className="yt-mode-card" disabled={materialDisabled || dailyComplete}
          onClick={() => { void run(() => authority.start("daily")); }}>
          <span aria-hidden="true">☀️</span><strong>{text("daily")}</strong><small>{dailyComplete ? text("dailyComplete") : today}</small>
        </button>
      </div>
      <button className="yt-progress-button" disabled={materialDisabled} onClick={() => setScreen("progress")}>{text("progress")}</button>
    </section>
  </main>;
}
