import {useCallback, useEffect, useRef, useState} from "react";
import {splitGraphemes} from "@qwordly/core/game";
import {YOUTUBE_CLASSIC_SKIP_COST, YOUTUBE_CONTINUE_COST, YOUTUBE_HINT_COST, utcDay} from "./economy";
import {youtubeDirection, youtubeText, type YouTubeCopyKey} from "./i18n";
import {
  deleteYouTubeAnswerLetter,
  insertYouTubeAnswerText,
  canShowLatinShortcut,
  normalizeLatinShortcutKey,
} from "./input";
import {YouTubeAuthorityError, type YouTubeAuthoritySnapshot} from "./LocalSoloAuthority";
import type {YouTubeSdkPort} from "./types";
import {YouTubeNativeAnswerInput} from "./YouTubeNativeAnswerInput";
import {YouTubeSaveBlockedError} from "./YouTubeSaveGate";
import {AchievementIcon, SaveBanner, StatusHeader} from "./YouTubePlayableViews";
import {useYouTubePlayableBoot, type YouTubeRuntime} from "./useYouTubePlayableBoot";

/** Provides milliseconds until next utc day behavior. */
const millisecondsUntilNextUtcDay = (now: Date): number => {
  /** Provides next behavior. */
  const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  // A small boundary cushion avoids rescheduling against the previous day on
  // clocks whose timeout fires fractionally early.
  return Math.max(1, next - now.getTime() + 50);
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
  /** Stores sdk. */ /** Stores sdk. */ /** Stores sdk. */ /** Stores sdk. */
  /** Stores sdk. */
  sdk: YouTubeSdkPort;
}) {
  /** Provides the complete YouTube boot controller. */
  const {state: boot, platformPaused, retry, setResetConfirmation, resetSave} = useYouTubePlayableBoot(sdk);

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
        <button className="yt-primary" onClick={retry}>
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
        <button className="yt-primary" onClick={retry}>
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
        <button className="yt-primary" onClick={retry}>
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
        <button className="yt-primary" onClick={retry}>
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
            <button className="yt-danger" onClick={resetSave}>
              {youtubeText(locale, "resetSave")}
            </button>
            <button onClick={() => setResetConfirmation(false)}>{youtubeText(locale, "cancel")}</button>
          </div>
        ) : (
          <button className="yt-danger" onClick={() => setResetConfirmation(true)}>
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
  runtime: YouTubeRuntime; /** Stores sdk. */
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
