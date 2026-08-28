import {useCallback, useEffect, useRef, useState} from "react";
import {splitGraphemes} from "@qwordly/core/game";
import {loadYouTubeContent, resolveYouTubeLocale} from "./content";
import {YOUTUBE_CLASSIC_SKIP_COST, YOUTUBE_CONTINUE_COST, YOUTUBE_HINT_COST, utcDay} from "./economy";
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
  /** Stores locale. */
  locale: YouTubeLocale;
  /** Stores content. */
  content: YouTubeContent;
  /** Stores authority. */
  authority: LocalSoloAuthority;
}>;

/** Describes reset state. */
type ResetState = Readonly<{
  /** Stores kind. */
  kind: "invalid" | "future-version";
  /** Stores locale. */
  locale: YouTubeLocale;
  /** Stores content. */
  content: YouTubeContent;
  /** Stores raw. */
  raw: string;
}>;

/** Describes reset failure. */
type ResetFailure = Readonly<{
  /** Stores locale. */
  locale: YouTubeLocale;
  /** Stores content. */
  content: YouTubeContent;
  /** Stores save. */
  save: YouTubeSaveV1;
  /** Stores gate. */
  gate: YouTubeSaveGate;
}>;

/** Describes prepared loaded save. */
type PreparedLoadedSave = Readonly<{
  /** Stores save. */
  save: YouTubeSaveV1;
  /** Stores gate. */
  gate: YouTubeSaveGate;
  /** Stores recovered active game. */
  recoveredActiveGame: boolean;
}>;

/** Describes prepared runtime result. */
type PreparedRuntimeResult =
  | {
      /** Stores kind. */
      kind: "ready"; /** Stores runtime. */
      /** Stores runtime. */
      runtime: Runtime;
    }
  | {
      /** Stores kind. */
      kind: "recovery-save-failed"; /** Stores runtime. */
      /** Stores runtime. */
      runtime: Runtime;
    };

/** Describes boot state. */
type BootState =
  | {
      /** Stores kind. */
      kind: "loading";
    }
  | {
      /** Stores kind. */
      kind: "load-failed";
    }
  | {
      /** Stores kind. */
      kind: "pre-locale-save-failed"; /** Stores prepared. */
      /** Stores prepared. */
      prepared: PreparedLoadedSave;
    }
  | {
      /** Stores kind. */
      kind: "recovery-save-failed"; /** Stores runtime. */
      /** Stores runtime. */
      runtime: Runtime;
    }
  | {
      /** Stores kind. */
      kind: "reset-required"; /** Stores reset. */
      /** Stores reset. */
      reset: ResetState; /** Stores confirming. */
      /** Stores confirming. */
      confirming: boolean;
    }
  | {
      /** Stores kind. */
      kind: "reset-save-failed"; /** Stores reset. */
      /** Stores reset. */
      reset: ResetFailure;
    }
  | {
      /** Stores kind. */
      kind: "ready"; /** Stores runtime. */
      /** Stores runtime. */
      runtime: Runtime;
    };

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
  /** Provides next behavior. */
  const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  // A small boundary cushion avoids rescheduling against the previous day on
  // clocks whose timeout fires fractionally early.
  return Math.max(1, next - now.getTime() + 50);
};

/** Provides mark paused behavior. */
const markPaused = (paused: boolean): void => {
  document.documentElement.classList.toggle("youtube-game-paused", paused);
  /** Provides root behavior. */
  const root = document.querySelector<HTMLElement>("[data-youtube-playable-root]");
  if (paused) root?.setAttribute("inert", "");
  else root?.removeAttribute("inert");
};

/** Provides authority error key behavior. */
const authorityErrorKey = (error: unknown): YouTubeCopyKey => {
  /** Provides code behavior. */
  const code = error instanceof YouTubeAuthorityError ? error.code : "";
  if (code === "coins-insufficient") return "insufficientCoins";
  if (code === "answer-incomplete") return "answerIncomplete";
  if (code === "daily-unavailable") return "dailyUnavailable";
  if (error instanceof YouTubeSaveBlockedError) return "saveFailed";
  return "operationFailed";
};

/** Provides you tube playable app behavior. */
export function YouTubePlayableApp({
  sdk,
}: {
  /** Stores sdk. */ /** Stores sdk. */ /** Stores sdk. */
  sdk: YouTubeSdkPort;
}) {
  /** Provides [boot, set boot] behavior. */
  const [boot, setBoot] = useState<BootState>({kind: "loading"});
  /** Provides [boot attempt, set boot attempt] behavior. */
  const [bootAttempt, setBootAttempt] = useState(0);
  /** Provides [platform paused, set platform paused] behavior. */
  const [platformPaused, setPlatformPaused] = useState(false);
  /** Provides authority ref behavior. */
  const authorityRef = useRef<LocalSoloAuthority | null>(null);
  /** Provides paused ref behavior. */
  const pausedRef = useRef(false);
  /** Provides resume waiters ref behavior. */
  const resumeWaitersRef = useRef(new Set<() => void>());
  /** Provides pending audio ref behavior. */
  const pendingAudioRef = useRef(false);

  /** Provides wait until active behavior. */
  const waitUntilActive = useCallback((): Promise<void> => {
    if (!pausedRef.current) return Promise.resolve();
    return new Promise((resolve) => resumeWaitersRef.current.add(resolve));
  }, []);

  /** Provides finish boot behavior. */
  const finishBoot = useCallback((runtime: Runtime) => {
    authorityRef.current = runtime.authority;
    if (pausedRef.current) runtime.authority.setPaused(true);
    setBoot({kind: "ready", runtime});
  }, []);

  /** Resolves prepared runtime. */
  const resolvePreparedRuntime = useCallback(
    async (
      prepared: PreparedLoadedSave,
      cancelled: () => boolean = () => false,
    ): Promise<PreparedRuntimeResult | null> => {
      /** Provides language tag behavior. */
      const languageTag = await sdk.getLanguage();
      await waitUntilActive();
      if (cancelled()) return null;
      /** Provides locale behavior. */
      const locale = resolveYouTubeLocale(languageTag);
      /** Provides content behavior. */
      const content = loadYouTubeContent(locale);
      /** Provides authority behavior. */
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
    },
    [sdk, waitUntilActive],
  );

  /** Applies prepared runtime. */
  const applyPreparedRuntime = useCallback(
    (result: PreparedRuntimeResult): void => {
      if (result.kind === "ready") finishBoot(result.runtime);
      else setBoot(result);
    },
    [finishBoot],
  );

  useEffect(() => {
    /** Provides cancelled behavior. */
    let cancelled = false;
    /** Provides frame behavior. */
    const frame = requestNextFrame(() => {
      void (async () => {
        try {
          await waitUntilActive();
          if (cancelled) return;
          sdk.firstFrameReady();
          // Cloud Save authority is established before any locale/content state can mutate it.
          /** Provides raw behavior. */
          const raw = await sdk.loadData();
          await waitUntilActive();
          if (cancelled) return;
          /** Provides base content behavior. */
          const baseContent = loadYouTubeContent("en");
          /** Parses d. */
          const parsed = parseYouTubeSave(raw, baseContent.contentVersion);
          if (parsed.kind === "invalid" || parsed.kind === "future-version") {
            /** Provides language tag behavior. */
            const languageTag = await sdk.getLanguage();
            await waitUntilActive();
            if (cancelled) return;
            /** Provides locale behavior. */
            const locale = resolveYouTubeLocale(languageTag);
            /** Provides content behavior. */
            const content = loadYouTubeContent(locale);
            setBoot({
              kind: "reset-required",
              reset: {kind: parsed.kind, locale, content, raw: parsed.raw},
              confirming: false,
            });
            return;
          }
          /** Provides gate behavior. */
          const gate = new YouTubeSaveGate(sdk);
          /** Provides recovered active game behavior. */
          const recoveredActiveGame = parsed.kind === "valid" && parsed.recoveredActiveGame === true;
          /** Provides requires migration save behavior. */
          const requiresMigrationSave = parsed.kind === "valid" && parsed.migratedFromSchemaVersion === 0;
          /** Provides prepared behavior. */
          let prepared: PreparedLoadedSave = {save: parsed.save, gate, recoveredActiveGame};
          if (recoveredActiveGame || requiresMigrationSave) {
            /** Provides migrated behavior. */
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
          /** Provides result behavior. */
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
    /** Sets audio. */
    const setAudio = (enabled: boolean): void => {
      pendingAudioRef.current = enabled;
      if (pausedRef.current) return;
      document.documentElement.dataset.youtubeAudio = enabled ? "enabled" : "disabled";
    };
    setAudio(sdk.isAudioEnabled());
    /** Removes audio. */
    const removeAudio = sdk.onAudioEnabledChange(setAudio);
    /** Removes pause. */
    const removePause = sdk.onPause(() => {
      pausedRef.current = true;
      setPlatformPaused(true);
      markPaused(true);
      authorityRef.current?.setPaused(true);
    });
    /** Removes resume. */
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

  /** Provides retry boot behavior. */
  const retryBoot = (): void => {
    setBoot({kind: "loading"});
    setBootAttempt((attempt) => attempt + 1);
  };

  /** Resets fresh. */
  const resetFresh = async (reset: ResetState): Promise<void> => {
    /** Provides save behavior. */
    const save = createEmptyYouTubeSave(reset.content.contentVersion);
    save.revision = 1;
    /** Provides gate behavior. */
    const gate = new YouTubeSaveGate(sdk);
    setBoot({kind: "loading"});
    try {
      await gate.commit(save);
      await waitUntilActive();
      /** Provides authority behavior. */
      const authority = await LocalSoloAuthority.restore(save, reset.content, gate);
      await waitUntilActive();
      finishBoot({locale: reset.locale, content: reset.content, authority});
    } catch {
      await waitUntilActive();
      sdk.logWarning();
      setBoot({kind: "reset-save-failed", reset: {locale: reset.locale, content: reset.content, save, gate}});
    }
  };

  /** Provides retry reset save behavior. */
  const retryResetSave = async (reset: ResetFailure): Promise<void> => {
    setBoot({kind: "loading"});
    try {
      await reset.gate.retry();
      await waitUntilActive();
      /** Provides authority behavior. */
      const authority = await LocalSoloAuthority.restore(reset.save, reset.content, reset.gate);
      await waitUntilActive();
      finishBoot({locale: reset.locale, content: reset.content, authority});
    } catch {
      await waitUntilActive();
      setBoot({kind: "reset-save-failed", reset});
    }
  };

  /** Provides retry recovery save behavior. */
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

  /** Provides retry pre locale save behavior. */
  const retryPreLocaleSave = async (prepared: PreparedLoadedSave): Promise<void> => {
    setBoot({kind: "loading"});
    try {
      await prepared.gate.retry();
      await waitUntilActive();
      /** Provides result behavior. */
      const result = await resolvePreparedRuntime(prepared);
      await waitUntilActive();
      if (result) applyPreparedRuntime(result);
    } catch {
      await waitUntilActive();
      setBoot({kind: "pre-locale-save-failed", prepared});
    }
  };

  if (boot.kind === "loading") {
    return (
      <main className="yt-shell yt-loading" data-youtube-playable-root aria-busy="true" inert={platformPaused}>
        <div className="yt-loader" aria-hidden="true" />
        <p>{youtubeText("en", "loading")}</p>
      </main>
    );
  }
  if (boot.kind === "load-failed") {
    return (
      <main className="yt-shell yt-center" data-youtube-playable-root lang="en" inert={platformPaused}>
        <h1>{youtubeText("en", "title")}</h1>
        <p role="alert">{youtubeText("en", "loadFailed")}</p>
        <button className="yt-primary" onClick={retryBoot}>
          {youtubeText("en", "retry")}
        </button>
      </main>
    );
  }
  if (boot.kind === "pre-locale-save-failed") {
    return (
      <main className="yt-shell yt-center" data-youtube-playable-root lang="en" inert={platformPaused}>
        <h1>{youtubeText("en", "title")}</h1>
        <p role="alert">{youtubeText("en", "saveFailed")}</p>
        <button
          className="yt-primary"
          onClick={() => {
            void retryPreLocaleSave(boot.prepared);
          }}
        >
          {youtubeText("en", "retry")}
        </button>
      </main>
    );
  }
  if (boot.kind === "recovery-save-failed") {
    /** Provides {locale} behavior. */
    const {locale} = boot.runtime;
    return (
      <main
        className="yt-shell yt-center"
        data-youtube-playable-root
        lang={locale}
        dir={youtubeDirection(locale)}
        inert={platformPaused}
      >
        <h1>{youtubeText(locale, "title")}</h1>
        <p role="alert">{youtubeText(locale, "saveFailed")}</p>
        <button
          className="yt-primary"
          onClick={() => {
            void retryRecoverySave(boot.runtime);
          }}
        >
          {youtubeText(locale, "retry")}
        </button>
      </main>
    );
  }
  if (boot.kind === "reset-save-failed") {
    /** Provides {locale} behavior. */
    const {locale} = boot.reset;
    return (
      <main
        className="yt-shell yt-center"
        data-youtube-playable-root
        lang={locale}
        dir={youtubeDirection(locale)}
        inert={platformPaused}
      >
        <h1>{youtubeText(locale, "title")}</h1>
        <p role="alert">{youtubeText(locale, "saveFailed")}</p>
        <button
          className="yt-primary"
          onClick={() => {
            void retryResetSave(boot.reset);
          }}
        >
          {youtubeText(locale, "retry")}
        </button>
      </main>
    );
  }
  if (boot.kind === "reset-required") {
    /** Provides {locale} behavior. */
    const {locale} = boot.reset;
    return (
      <main
        className="yt-shell yt-center"
        data-youtube-playable-root
        lang={locale}
        dir={youtubeDirection(locale)}
        inert={platformPaused}
      >
        <h1>{youtubeText(locale, boot.confirming ? "confirmReset" : "title")}</h1>
        <p role="alert">
          {youtubeText(
            locale,
            boot.confirming
              ? "confirmResetBody"
              : boot.reset.kind === "future-version"
                ? "futureSave"
                : "incompatibleSave",
          )}
        </p>
        {boot.confirming ? (
          <div className="yt-actions">
            <button
              className="yt-danger"
              onClick={() => {
                void resetFresh(boot.reset);
              }}
            >
              {youtubeText(locale, "resetSave")}
            </button>
            <button onClick={() => setBoot({...boot, confirming: false})}>{youtubeText(locale, "cancel")}</button>
          </div>
        ) : (
          <button className="yt-danger" onClick={() => setBoot({...boot, confirming: true})}>
            {youtubeText(locale, "resetSave")}
          </button>
        )}
      </main>
    );
  }
  return <ReadyYouTubeApp runtime={boot.runtime} sdk={sdk} />;
}

/** Provides ready you tube app behavior. */
function ReadyYouTubeApp({
  runtime,
  sdk,
}: {
  /** Stores runtime. */
  runtime: Runtime; /** Stores sdk. */
  /** Stores sdk. */
  sdk: YouTubeSdkPort;
}) {
  /** Provides {locale, content, authority} behavior. */
  const {locale, content, authority} = runtime;
  /** Provides [snapshot, set snapshot] behavior. */
  const [snapshot, setSnapshot] = useState<YouTubeAuthoritySnapshot>(() => authority.getSnapshot());
  /** Provides [screen, set screen] behavior. */
  const [screen, setScreen] = useState<"menu" | "progress">("menu");
  /** Provides [notice, set notice] behavior. */
  const [notice, setNotice] = useState<YouTubeCopyKey | null>(null);
  /** Provides [today, set today] behavior. */
  const [today, setToday] = useState(() => utcDay(new Date()));
  /** Provides input ref behavior. */
  const inputRef = useRef<HTMLInputElement>(null);
  /** Provides text behavior. */
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
    /** Provides now behavior. */
    const now = new Date();
    setToday(utcDay(now));
    /** Provides timer behavior. */
    const timer = window.setTimeout(() => setToday(utcDay(new Date())), millisecondsUntilNextUtcDay(now));
    return () => window.clearTimeout(timer);
  }, [snapshot.paused, today]);

  /** Provides run behavior. */
  const run = async (action: () => Promise<unknown>): Promise<void> => {
    setNotice(null);
    try {
      await action();
    } catch (error) {
      setNotice(authorityErrorKey(error));
    }
  };

  /** Provides active behavior. */
  const active = snapshot.save.activeGame;
  /** Provides riddle behavior. */
  const riddle = snapshot.activeRiddle;
  /** Provides display letters behavior. */
  const displayLetters = snapshot.displayLetters;
  /** Provides progression behavior. */
  const progression = snapshot.save.progression;
  /** Provides material disabled behavior. */
  const materialDisabled = snapshot.busy || snapshot.paused || snapshot.saveBlocked;

  /** Applies text. */
  const applyText = (value: string): void => {
    if (!active || !riddle || !displayLetters) return;
    /** Updates d. */
    const updated = insertYouTubeAnswerText(
      {letters: [...displayLetters], activeSlotIndex: snapshot.activeSlotIndex},
      value,
      displayLetters.length,
      active.hintRevealedIndices,
      locale,
    );
    authority.setInput(updated.letters, updated.activeSlotIndex);
  };
  /** Provides backspace behavior. */
  const backspace = (): void => {
    if (!active || !displayLetters) return;
    /** Updates d. */
    const updated = deleteYouTubeAnswerLetter(
      {letters: [...displayLetters], activeSlotIndex: snapshot.activeSlotIndex},
      displayLetters.length,
      active.hintRevealedIndices,
    );
    authority.setInput(updated.letters, updated.activeSlotIndex);
  };

  if (snapshot.lastResult) {
    /** Provides result behavior. */
    const result = snapshot.lastResult;
    return (
      <main
        className="yt-shell yt-center"
        data-youtube-playable-root
        lang={locale}
        dir={youtubeDirection(locale)}
        inert={snapshot.paused}
      >
        <StatusHeader snapshot={snapshot} locale={locale} />
        {snapshot.saveBlocked && <SaveBanner text={text} retry={() => run(() => authority.retryPendingSave())} />}
        <section className="yt-panel yt-result" aria-live="polite">
          <div className="yt-result-icon" aria-hidden="true">
            {result.kind === "win" ? "✨" : result.kind === "skip" ? "⏭" : "🌙"}
          </div>
          <h1>{text(result.kind === "win" ? "victory" : result.kind === "skip" ? "skipped" : "loss")}</h1>
          <dl className="yt-result-stats">
            <div>
              <dt>{text("attempts")}</dt>
              <dd>{result.attempts}</dd>
            </div>
            <div>
              <dt>{text("coinsEarned")}</dt>
              <dd>{result.coinsEarned}</dd>
            </div>
            <div>
              <dt>{text("xpEarned")}</dt>
              <dd>{result.xpEarned}</dd>
            </div>
          </dl>
          {result.newlyUnlockedAchievementIds.length > 0 && (
            <div>
              <h2>{text("newAchievements")}</h2>
              <div className="yt-achievement-icons" aria-label={text("newAchievements")}>
                {result.newlyUnlockedAchievementIds.map((id) => (
                  <AchievementIcon key={id} id={id} text={text} />
                ))}
              </div>
            </div>
          )}
          <button className="yt-primary" disabled={materialDisabled} onClick={() => authority.clearResult()}>
            {text("continueToMenu")}
          </button>
        </section>
      </main>
    );
  }

  if (active && riddle && displayLetters) {
    /** Provides latin shortcut behavior. */
    const latinShortcut = canShowLatinShortcut(riddle.answer);
    return (
      <main
        className="yt-shell"
        data-youtube-playable-root
        lang={locale}
        dir={youtubeDirection(locale)}
        inert={snapshot.paused}
      >
        <StatusHeader snapshot={snapshot} locale={locale} />
        {snapshot.saveBlocked && <SaveBanner text={text} retry={() => run(() => authority.retryPendingSave())} />}
        {notice && (
          <p className="yt-notice" role="alert">
            {text(notice)}
          </p>
        )}
        <section className="yt-puzzle" aria-busy={snapshot.busy}>
          <p className="yt-eyebrow">
            {text(active.mode === "classic" ? "classic" : "daily")} · {text("riddle")}
          </p>
          <h1>{riddle.text}</h1>
          <div className="yt-guesses" aria-label={text("attempts")}>
            {active.guesses.map((guess, row) => (
              <div className="yt-guess-row" key={row}>
                {guess.letters.map((letter, index) => (
                  <span className={`yt-tile ${guess.feedback[index]}`} key={index}>
                    {letter}
                  </span>
                ))}
              </div>
            ))}
            <div className="yt-guess-row current">
              {displayLetters.map((letter, index) => (
                <button
                  className={`yt-tile ${snapshot.activeSlotIndex === index ? "active" : ""} ${active.hintRevealedIndices.includes(index) ? "hinted" : ""}`}
                  disabled={materialDisabled || active.hintRevealedIndices.includes(index)}
                  onClick={() => {
                    authority.setActiveSlot(index);
                    inputRef.current?.focus();
                  }}
                  key={index}
                >
                  {letter}
                </button>
              ))}
            </div>
          </div>
          <YouTubeNativeAnswerInput
            ref={inputRef}
            disabled={materialDisabled || active.awaitingContinue}
            locale={locale}
            label={text("inputLabel")}
            onText={applyText}
            onBackspace={backspace}
            onSubmit={() => {
              if (!materialDisabled) void run(() => authority.submitGuess());
            }}
          />
          {latinShortcut && (
            <div className="yt-keyboard" aria-hidden="true">
              {"QWERTYUIOPASDFGHJKLZXCVBNM".split("").map((letter) => (
                <button
                  tabIndex={-1}
                  disabled={materialDisabled || active.awaitingContinue}
                  onClick={() => applyText(normalizeLatinShortcutKey(letter))}
                  key={letter}
                >
                  {letter}
                </button>
              ))}
              <button tabIndex={-1} disabled={materialDisabled || active.awaitingContinue} onClick={backspace}>
                ⌫
              </button>
            </div>
          )}
          {active.awaitingContinue ? (
            <div className="yt-continue-panel">
              <button
                className="yt-primary"
                disabled={materialDisabled || progression.coins < YOUTUBE_CONTINUE_COST}
                onClick={() => {
                  void run(() => authority.buyContinue());
                }}
              >
                {text("buyContinue")} · {YOUTUBE_CONTINUE_COST} {text("coins")}
              </button>
              <button
                disabled={materialDisabled}
                onClick={() => {
                  void run(() => authority.finishWithoutContinue());
                }}
              >
                {text("finishRun")}
              </button>
            </div>
          ) : (
            <div className="yt-actions">
              <button
                className="yt-primary"
                disabled={materialDisabled || displayLetters.some((letter) => !letter)}
                onClick={() => {
                  void run(() => authority.submitGuess());
                }}
              >
                {text("submit")}
              </button>
              <button
                disabled={materialDisabled || progression.coins < YOUTUBE_HINT_COST}
                onClick={() => {
                  void run(() => authority.requestHint());
                }}
              >
                {text("hint")} · {YOUTUBE_HINT_COST}
              </button>
              {active.mode === "classic" && (
                <button
                  disabled={materialDisabled || progression.coins < YOUTUBE_CLASSIC_SKIP_COST}
                  onClick={() => {
                    void run(() => authority.skipClassic());
                  }}
                >
                  {text("skip")} · {YOUTUBE_CLASSIC_SKIP_COST}
                </button>
              )}
            </div>
          )}
        </section>
      </main>
    );
  }

  if (screen === "progress") {
    /** Provides rank behavior. */
    const rank = Math.max(
      1,
      [1, 3, 6, 10, 15, 21, 28, 36].filter((threshold) => progression.level >= threshold).length,
    );
    return (
      <main
        className="yt-shell"
        data-youtube-playable-root
        lang={locale}
        dir={youtubeDirection(locale)}
        inert={snapshot.paused}
      >
        <StatusHeader snapshot={snapshot} locale={locale} />
        {snapshot.saveBlocked && <SaveBanner text={text} retry={() => run(() => authority.retryPendingSave())} />}
        <section className="yt-panel">
          <button className="yt-back" disabled={materialDisabled} onClick={() => setScreen("menu")}>
            ← {text("back")}
          </button>
          <h1>{text("progress")}</h1>
          <dl className="yt-progress-grid">
            <div>
              <dt>{text("level")}</dt>
              <dd>{progression.level}</dd>
            </div>
            <div>
              <dt>{text("rank")}</dt>
              <dd>{rank}</dd>
            </div>
            <div>
              <dt>{text("xp")}</dt>
              <dd>{progression.xp}</dd>
            </div>
            <div>
              <dt>{text("coins")}</dt>
              <dd>{progression.coins}</dd>
            </div>
            <div>
              <dt>{text("games")}</dt>
              <dd>{progression.gamesPlayed}</dd>
            </div>
            <div>
              <dt>{text("wins")}</dt>
              <dd>{progression.totalWins}</dd>
            </div>
            <div>
              <dt>{text("streak")}</dt>
              <dd>{progression.currentDailyStreak}</dd>
            </div>
            <div>
              <dt>{text("classicProgress")}</dt>
              <dd>
                {Math.min(progression.classicIndex, content.classicOrder.length)}/{content.classicOrder.length}
              </dd>
            </div>
          </dl>
          <h2>{text("achievements")}</h2>
          {progression.unlockedAchievementIds.length > 0 ? (
            <div className="yt-achievement-icons" aria-label={text("achievements")}>
              {progression.unlockedAchievementIds.map((id) => (
                <AchievementIcon key={id} id={id} text={text} />
              ))}
            </div>
          ) : (
            <p>{text("noAchievements")}</p>
          )}
          <fieldset className="yt-preferences" disabled={materialDisabled}>
            <legend>{text("progress")}</legend>
            <label>
              <input
                type="checkbox"
                checked={snapshot.save.preferences.reducedMotion}
                onChange={(event) => {
                  void run(() => authority.setAccessibilityPreference("reducedMotion", event.currentTarget.checked));
                }}
              />
              {text("reducedMotion")}
            </label>
            <label>
              <input
                type="checkbox"
                checked={snapshot.save.preferences.highContrast}
                onChange={(event) => {
                  void run(() => authority.setAccessibilityPreference("highContrast", event.currentTarget.checked));
                }}
              />
              {text("highContrast")}
            </label>
          </fieldset>
        </section>
      </main>
    );
  }

  /** Provides classic complete behavior. */
  const classicComplete = progression.classicIndex >= content.classicOrder.length;
  /** Provides daily complete behavior. */
  const dailyComplete = Boolean(progression.lastDailyCompletedDate && progression.lastDailyCompletedDate >= today);
  return (
    <main
      className="yt-shell"
      data-youtube-playable-root
      lang={locale}
      dir={youtubeDirection(locale)}
      inert={snapshot.paused}
    >
      <StatusHeader snapshot={snapshot} locale={locale} />
      {snapshot.saveBlocked && <SaveBanner text={text} retry={() => run(() => authority.retryPendingSave())} />}
      {snapshot.recoveryNotice && (
        <div className="yt-banner" role="status">
          <span>{text("recovered")}</span>
          <button onClick={() => authority.dismissRecoveryNotice()}>{text("dismiss")}</button>
        </div>
      )}
      {!snapshot.save.preferences.guidanceComplete && (
        <div className="yt-banner" role="status">
          <span>
            {text("chooseMode")}: {text("classic")} · {text("daily")}
          </span>
          <button
            disabled={materialDisabled}
            onClick={() => {
              void run(() => authority.completeGuidance());
            }}
          >
            {text("dismiss")}
          </button>
        </div>
      )}
      {notice && (
        <p className="yt-notice" role="alert">
          {text(notice)}
        </p>
      )}
      <section className="yt-menu">
        <div>
          <p className="yt-eyebrow">{text("title")}</p>
          <h1>{text("chooseMode")}</h1>
        </div>
        <div className="yt-mode-grid">
          <button
            className="yt-mode-card"
            disabled={materialDisabled || classicComplete}
            onClick={() => {
              void run(() => authority.start("classic"));
            }}
          >
            <span aria-hidden="true">🪐</span>
            <strong>{text("classic")}</strong>
            <small>
              {classicComplete
                ? text("classicComplete")
                : `${progression.classicIndex + 1}/${content.classicOrder.length}`}
            </small>
          </button>
          <button
            className="yt-mode-card"
            disabled={materialDisabled || dailyComplete}
            onClick={() => {
              void run(() => authority.start("daily"));
            }}
          >
            <span aria-hidden="true">☀️</span>
            <strong>{text("daily")}</strong>
            <small>{dailyComplete ? text("dailyComplete") : today}</small>
          </button>
        </div>
        <button className="yt-progress-button" disabled={materialDisabled} onClick={() => setScreen("progress")}>
          {text("progress")}
        </button>
      </section>
    </main>
  );
}
