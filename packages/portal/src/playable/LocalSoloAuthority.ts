import {splitGraphemes} from "@qwordly/core/game";
import {findNewYouTubeAchievements} from "./achievements";
import {
  YOUTUBE_ACHIEVEMENT_COINS,
  YOUTUBE_CLASSIC_SKIP_COST,
  YOUTUBE_CONTINUE_COST,
  YOUTUBE_HINT_COST,
  utcDay,
} from "./economy";
import {
  YouTubeAuthorityError,
  YouTubeAuthorityRestoreSaveError,
  type YouTubeAuthoritySnapshot,
} from "./LocalSoloAuthority.contract";
import {
  activeYouTubeGameMatchesContent,
  completeYouTubeGame,
  findFirstEditableYouTubeSlot,
  findYouTubeHintIndex,
  getYouTubeDailyRiddleId,
  normalizeYouTubeDraftLetters,
  projectYouTubeDisplayLetters,
  scoreYouTubeGuess,
} from "./localSoloGameRules";
import {cloneYouTubeSave, appendYouTubeReceipt} from "./save";
import type {
  YouTubeActiveGame,
  YouTubeContent,
  YouTubeGameMode,
  YouTubeResult,
  YouTubeRiddle,
  YouTubeSaveV1,
} from "./types";
import {YouTubeSaveBlockedError, YouTubeSaveGate} from "./YouTubeSaveGate";

export {
  YouTubeAuthorityError,
  YouTubeAuthorityRestoreSaveError,
  type YouTubeAuthoritySnapshot,
} from "./LocalSoloAuthority.contract";
/** Target-local authority: all valuable transitions are committed through the Cloud Save gate. */
export class LocalSoloAuthority {
  /** Stores save. */
  private save: YouTubeSaveV1;
  /** Stores content. */
  private readonly content: YouTubeContent;
  /** Stores save gate. */
  private readonly saveGate: YouTubeSaveGate;
  /** Stores now. */
  private readonly now: () => Date;
  /** Stores listeners. */
  private readonly listeners = new Set<() => void>();
  /** Stores resume waiters. */
  private readonly resumeWaiters = new Set<() => void>();
  /** Stores paused. */
  private paused = false;
  /** Stores busy. */
  private busy = false;
  /** Stores draft letters. */
  private draftLetters: string[] = [];
  /** Stores active slot index. */
  private activeSlotIndex = 0;
  /** Stores recovery notice. */
  private recoveryNotice = false;
  /** Stores last result. */
  private lastResult: YouTubeResult | null = null;
  /** Creates a local solo authority instance. */
  private constructor(save: YouTubeSaveV1, content: YouTubeContent, saveGate: YouTubeSaveGate, now: () => Date) {
    this.save = save;
    this.content = content;
    this.saveGate = saveGate;
    this.now = now;
    this.resetDraft();
  }
  /** Restores a validated save and commits content-version/active-game recovery before play. */
  static async restore(
    loaded: YouTubeSaveV1,
    content: YouTubeContent,
    saveGate: YouTubeSaveGate,
    now: () => Date = () => new Date(),
    recoveredActiveGame = false,
    requiresMigrationSave = false,
    recoveryNoticeAlreadySaved = false,
  ): Promise<LocalSoloAuthority> {
    /** Provides authority behavior. */
    const authority = new LocalSoloAuthority(cloneYouTubeSave(loaded), content, saveGate, now);
    authority.recoveryNotice = recoveryNoticeAlreadySaved;
    /** Provides active behavior. */
    const active = authority.save.activeGame;
    /** Provides active riddle behavior. */
    const activeRiddle = active ? content.riddles.get(active.riddleId) : undefined;
    /** Provides needs active recovery behavior. */
    const needsActiveRecovery =
      recoveredActiveGame ||
      Boolean(active && !activeYouTubeGameMatchesContent(active, activeRiddle, content, authority.save));
    /** Provides needs version update behavior. */
    const needsVersionUpdate = authority.save.contentVersion !== content.contentVersion;
    if (needsActiveRecovery || needsVersionUpdate || requiresMigrationSave) {
      /** Provides next behavior. */
      const next = cloneYouTubeSave(authority.save);
      next.revision += 1;
      next.contentVersion = content.contentVersion;
      if (needsActiveRecovery) next.activeGame = null;
      // Serialization is a fail-closed precondition. Do not publish a recovered
      // or migrated document that cannot become the gate's exact retry payload.
      saveGate.stage(next);
      authority.save = next;
      authority.resetDraft();
      authority.recoveryNotice = authority.recoveryNotice || needsActiveRecovery;
      try {
        await saveGate.commitStaged();
      } catch (error) {
        throw new YouTubeAuthorityRestoreSaveError(authority, error);
      }
    }
    return authority;
  }
  /** Provides subscribe behavior. */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  /** Gets snapshot. */
  getSnapshot(): YouTubeAuthoritySnapshot {
    /** Provides active riddle behavior. */
    const activeRiddle = this.save.activeGame
      ? (this.content.riddles.get(this.save.activeGame.riddleId) ?? null)
      : null;
    return {
      save: cloneYouTubeSave(this.save),
      activeRiddle,
      displayLetters:
        this.save.activeGame && activeRiddle
          ? projectYouTubeDisplayLetters(this.draftLetters, this.save.activeGame, activeRiddle)
          : null,
      activeSlotIndex: this.activeSlotIndex,
      paused: this.paused,
      busy: this.busy || this.saveGate.writing,
      saveBlocked: this.saveGate.blocked,
      pendingSaveRevision: this.saveGate.pendingRevision,
      recoveryNotice: this.recoveryNotice,
      lastResult: this.lastResult,
    };
  }
  /** Provides dismiss recovery notice behavior. */
  dismissRecoveryNotice(): void {
    this.recoveryNotice = false;
    this.emit();
  }
  /** Clears result. */
  clearResult(): void {
    this.lastResult = null;
    this.emit();
  }
  /** Sets paused. */
  setPaused(paused: boolean): void {
    if (this.paused === paused) return;
    this.paused = paused;
    if (paused) this.checkpointOnPause();
    else {
      for (const resume of this.resumeWaiters) resume();
      this.resumeWaiters.clear();
    }
    this.emit();
  }
  /** Provides retry pending save behavior. */
  async retryPendingSave(): Promise<void> {
    if (!this.saveGate.blocked) return;
    this.busy = true;
    this.emit();
    try {
      await this.saveGate.retry();
    } finally {
      await this.waitUntilActive();
      this.busy = false;
      this.emit();
    }
  }
  /** Sets accessibility preference. */
  async setAccessibilityPreference(preference: "reducedMotion" | "highContrast", enabled: boolean): Promise<void> {
    this.assertMutationAllowed();
    if (this.save.preferences[preference] === enabled) return;
    await this.mutate(`preference:${preference}:${enabled}:${this.save.revision + 1}`, (next) => {
      next.preferences[preference] = enabled;
      return undefined;
    });
  }
  /** Completes guidance. */
  async completeGuidance(): Promise<void> {
    this.assertMutationAllowed();
    if (this.save.preferences.guidanceComplete) return;
    await this.mutate(`guidance:complete:${this.save.revision + 1}`, (next) => {
      next.preferences.guidanceComplete = true;
      return undefined;
    });
  }
  /** Sets active slot. */
  setActiveSlot(index: number): void {
    if (!this.inputAllowed()) return;
    /** Provides active behavior. */
    const active = this.requireEditableGame();
    if (
      !Number.isInteger(index) ||
      index < 0 ||
      index >= this.draftLetters.length ||
      active.hintRevealedIndices.includes(index)
    )
      return;
    this.activeSlotIndex = index;
    this.emit();
  }
  /** Sets input. */
  setInput(letters: readonly string[], activeSlotIndex: number): void {
    if (!this.inputAllowed()) return;
    /** Provides active behavior. */
    const active = this.requireEditableGame();
    if (
      letters.length !== this.draftLetters.length ||
      !Number.isInteger(activeSlotIndex) ||
      activeSlotIndex < 0 ||
      activeSlotIndex >= letters.length
    )
      return;
    /** Provides riddle behavior. */
    const riddle = this.requireActiveRiddle();
    /** Normalizes d. */
    const normalized = normalizeYouTubeDraftLetters(letters, active, riddle, this.content.locale);
    if (!normalized) return;
    this.draftLetters = normalized;
    this.activeSlotIndex = activeSlotIndex;
    this.emit();
  }
  /** Provides start behavior. */
  async start(mode: YouTubeGameMode): Promise<void> {
    this.assertMutationAllowed();
    if (this.save.activeGame) throw new YouTubeAuthorityError("active-game-must-resume");
    /** Provides today behavior. */
    const today = utcDay(this.now());
    if (
      mode === "daily" &&
      this.save.progression.lastDailyCompletedDate &&
      this.save.progression.lastDailyCompletedDate >= today
    ) {
      throw new YouTubeAuthorityError("daily-already-complete");
    }
    /** Provides riddle behavior. */
    const riddle = mode === "classic" ? this.getClassicRiddle() : this.getDailyRiddle(today);
    if (!riddle) throw new YouTubeAuthorityError(mode === "classic" ? "classic-complete" : "daily-unavailable");
    /** Provides answer length behavior. */
    const answerLength = splitGraphemes(riddle.answer.normalize("NFC"), this.content.locale).length;
    /** Provides operation id behavior. */
    const operationId = `start:${mode}:${mode === "daily" ? today : this.save.progression.classicIndex}:${this.save.revision + 1}`;
    await this.mutate(operationId, (next) => {
      next.activeGame = {
        sessionRevision: next.revision,
        mode,
        riddleId: riddle.canonicalId,
        contentFingerprint: riddle.contentFingerprint,
        ...(mode === "daily" ? {dailyDate: today} : {}),
        hintRevealedIndices: [],
        guesses: [],
        attemptsUsed: 0,
        hasUsedContinue: false,
        awaitingContinue: false,
      };
      this.draftLetters = Array.from({length: answerLength}, () => "");
      this.activeSlotIndex = 0;
      return undefined;
    });
  }
  /** Submits guess. */
  async submitGuess(): Promise<YouTubeResult | null> {
    this.assertMutationAllowed();
    /** Provides active behavior. */
    const active = this.requireEditableGame();
    /** Provides riddle behavior. */
    const riddle = this.requireActiveRiddle();
    /** Submits ted letters. */
    const submittedLetters = projectYouTubeDisplayLetters(this.draftLetters, active, riddle);
    if (submittedLetters.some((letter) => !letter)) throw new YouTubeAuthorityError("answer-incomplete");
    /** Provides feedback behavior. */
    const feedback = scoreYouTubeGuess(submittedLetters, riddle.answer, this.content.locale);
    /** Indicates whether is correct. */
    const isCorrect = feedback.every((entry) => entry === "green");
    /** Provides attempt behavior. */
    const attempt = active.attemptsUsed + 1;
    // The operation key must never duplicate a correct answer in Cloud Save.
    /** Provides operation id behavior. */
    const operationId = `guess:${active.sessionRevision}:${attempt}`;
    return this.mutate(operationId, (next) => {
      /** Provides game behavior. */
      const game = next.activeGame!;
      game.guesses.push({letters: submittedLetters, feedback});
      game.attemptsUsed = attempt;
      next.progression.totalGuesses += 1;
      if (isCorrect) {
        return this.rememberResult(completeYouTubeGame(next, game.mode, true, attempt, game.dailyDate));
      }
      /** Provides maximum behavior. */
      const maximum = game.hasUsedContinue ? 6 : 5;
      if (attempt >= maximum) {
        if (!game.hasUsedContinue) {
          game.awaitingContinue = true;
          return null;
        }
        return this.rememberResult(completeYouTubeGame(next, game.mode, false, attempt, game.dailyDate));
      }
      this.draftLetters = Array.from({length: submittedLetters.length}, () => "");
      this.activeSlotIndex = findFirstEditableYouTubeSlot(this.draftLetters, game);
      return null;
    });
  }
  /** Requests hint. */
  async requestHint(): Promise<readonly string[]> {
    this.assertMutationAllowed();
    /** Provides active behavior. */
    const active = this.requireEditableGame();
    /** Provides riddle behavior. */
    const riddle = this.requireActiveRiddle();
    if (this.save.progression.coins < YOUTUBE_HINT_COST) throw new YouTubeAuthorityError("coins-insufficient");
    /** Provides index behavior. */
    const index = findYouTubeHintIndex(this.draftLetters, active, riddle, this.content.locale);
    if (index < 0) throw new YouTubeAuthorityError("hint-unavailable");
    /** Provides operation id behavior. */
    const operationId = `hint:${active.sessionRevision}:${active.hintRevealedIndices.length}:${index}`;
    return this.mutate(operationId, (next) => {
      /** Provides game behavior. */
      const game = next.activeGame!;
      this.draftLetters[index] = "";
      game.hintRevealedIndices = [...game.hintRevealedIndices, index].sort((left, right) => left - right);
      this.activeSlotIndex = findFirstEditableYouTubeSlot(this.draftLetters, game);
      next.progression.coins -= YOUTUBE_HINT_COST;
      next.progression.totalHintsUsed += 1;
      /** Provides unlocked behavior. */
      const unlocked = findNewYouTubeAchievements(next.progression, {
        mode: game.mode,
        isCorrect: false,
        attempts: game.attemptsUsed,
        gameOver: false,
      });
      next.progression.unlockedAchievementIds.push(...unlocked);
      next.progression.coins += unlocked.length * YOUTUBE_ACHIEVEMENT_COINS;
      return unlocked;
    });
  }
  /** Provides buy continue behavior. */
  async buyContinue(): Promise<void> {
    this.assertMutationAllowed();
    /** Provides active behavior. */
    const active = this.requireActiveGame();
    if (!active.awaitingContinue || active.hasUsedContinue) throw new YouTubeAuthorityError("continue-unavailable");
    if (this.save.progression.coins < YOUTUBE_CONTINUE_COST) throw new YouTubeAuthorityError("coins-insufficient");
    await this.mutate(`continue:${active.sessionRevision}`, (next) => {
      /** Provides game behavior. */
      const game = next.activeGame!;
      next.progression.coins -= YOUTUBE_CONTINUE_COST;
      game.hasUsedContinue = true;
      game.awaitingContinue = false;
      this.draftLetters = this.draftLetters.map(() => "");
      this.activeSlotIndex = findFirstEditableYouTubeSlot(this.draftLetters, game);
      return undefined;
    });
  }
  /** Provides finish without continue behavior. */
  async finishWithoutContinue(): Promise<YouTubeResult> {
    this.assertMutationAllowed();
    /** Provides active behavior. */
    const active = this.requireActiveGame();
    if (!active.awaitingContinue || active.hasUsedContinue) throw new YouTubeAuthorityError("continue-unavailable");
    return this.mutate(`decline:${active.sessionRevision}`, (next) =>
      this.rememberResult(completeYouTubeGame(next, active.mode, false, active.attemptsUsed, active.dailyDate)),
    );
  }
  /** Provides skip classic behavior. */
  async skipClassic(): Promise<YouTubeResult> {
    this.assertMutationAllowed();
    /** Provides active behavior. */
    const active = this.requireEditableGame();
    if (active.mode !== "classic") throw new YouTubeAuthorityError("daily-skip-unavailable");
    if (this.save.progression.coins < YOUTUBE_CLASSIC_SKIP_COST) throw new YouTubeAuthorityError("coins-insufficient");
    return this.mutate(`skip:${active.sessionRevision}`, (next) => {
      next.progression.coins -= YOUTUBE_CLASSIC_SKIP_COST;
      next.progression.classicIndex += 1;
      next.activeGame = null;
      return this.rememberResult({
        kind: "skip",
        mode: "classic",
        attempts: active.attemptsUsed,
        coinsEarned: 0,
        xpEarned: 0,
        newlyUnlockedAchievementIds: [],
      });
    });
  }
  /** Provides mutate behavior. */
  private async mutate<T>(operationId: string, transition: (next: YouTubeSaveV1) => T): Promise<T> {
    this.assertMutationAllowed();
    if (this.save.operationReceipts.some(({id}) => id === operationId)) {
      throw new YouTubeAuthorityError("operation-already-applied");
    }
    this.busy = true;
    /** Provides next behavior. */
    const next = cloneYouTubeSave(this.save);
    next.revision += 1;
    /** Provides prior draft behavior. */
    const priorDraft = [...this.draftLetters];
    /** Provides prior slot behavior. */
    const priorSlot = this.activeSlotIndex;
    /** Provides prior result behavior. */
    const priorResult = this.lastResult;
    /** Provides result behavior. */
    let result: T;
    try {
      result = transition(next);
      appendYouTubeReceipt(next, operationId);
      // Stage exact bytes before publishing the new authoritative snapshot.
      // A size/schema bug therefore rolls back rather than becoming playable
      // unsaved state with no retry payload.
      this.saveGate.stage(next);
    } catch (error) {
      this.draftLetters = priorDraft;
      this.activeSlotIndex = priorSlot;
      this.lastResult = priorResult;
      this.busy = false;
      this.emit();
      throw error;
    }
    this.save = next;
    this.emit();
    try {
      await this.saveGate.commitStaged();
      return result;
    } finally {
      await this.waitUntilActive();
      this.busy = false;
      this.emit();
    }
  }
  /** Provides remember result behavior. */
  private rememberResult(result: YouTubeResult): YouTubeResult {
    this.draftLetters = [];
    this.activeSlotIndex = 0;
    this.lastResult = result;
    return result;
  }
  /** Provides checkpoint on pause behavior. */
  private checkpointOnPause(): void {
    if (this.saveGate.blocked) {
      void (async () => {
        try {
          await this.saveGate.retry();
        } catch {
          // Keep the exact failed payload blocked for the next explicit retry.
        } finally {
          await this.waitUntilActive();
          this.emit();
        }
      })();
      return;
    }
    // Draft input is intentionally ephemeral so a correctly typed answer can
    // never enter Cloud Save. Every durable/material transition is already
    // serialized before another action is enabled.
  }
  /** Provides input allowed behavior. */
  private inputAllowed(): boolean {
    return !this.paused && !this.saveGate.blocked;
  }
  /** Provides wait until active behavior. */
  private waitUntilActive(): Promise<void> {
    if (!this.paused) return Promise.resolve();
    return new Promise((resolve) => this.resumeWaiters.add(resolve));
  }
  /** Asserts mutation allowed. */
  private assertMutationAllowed(): void {
    if (this.paused) throw new YouTubeAuthorityError("game-paused");
    if (this.busy || this.saveGate.writing) throw new YouTubeAuthorityError("operation-pending");
    if (this.saveGate.blocked) throw new YouTubeSaveBlockedError();
  }
  /** Provides require active game behavior. */
  private requireActiveGame(): YouTubeActiveGame {
    if (!this.save.activeGame) throw new YouTubeAuthorityError("active-game-required");
    return this.save.activeGame;
  }
  /** Provides require editable game behavior. */
  private requireEditableGame(): YouTubeActiveGame {
    /** Provides active behavior. */
    const active = this.requireActiveGame();
    if (active.awaitingContinue) throw new YouTubeAuthorityError("continue-decision-required");
    return active;
  }
  /** Provides require active riddle behavior. */
  private requireActiveRiddle(): YouTubeRiddle {
    /** Provides active behavior. */
    const active = this.requireActiveGame();
    /** Provides riddle behavior. */
    const riddle = this.content.riddles.get(active.riddleId);
    if (!riddle || !activeYouTubeGameMatchesContent(active, riddle, this.content, this.save)) {
      throw new YouTubeAuthorityError("active-content-invalid");
    }
    return riddle;
  }
  /** Gets classic riddle. */
  private getClassicRiddle(): YouTubeRiddle | null {
    /** Provides id behavior. */
    const id = this.content.classicOrder[this.save.progression.classicIndex];
    return id ? (this.content.riddles.get(id) ?? null) : null;
  }
  /** Gets daily riddle. */
  private getDailyRiddle(today: string): YouTubeRiddle | null {
    /** Provides id behavior. */
    const id = getYouTubeDailyRiddleId(this.content, today);
    return id ? (this.content.riddles.get(id) ?? null) : null;
  }
  /** Resets draft. */
  private resetDraft(): void {
    /** Provides active behavior. */
    const active = this.save.activeGame;
    /** Provides riddle behavior. */
    const riddle = active ? this.content.riddles.get(active.riddleId) : undefined;
    /** Provides length behavior. */
    const length = riddle ? splitGraphemes(riddle.answer.normalize("NFC"), this.content.locale).length : 0;
    this.draftLetters = Array.from({length}, () => "");
    this.activeSlotIndex = active ? findFirstEditableYouTubeSlot(this.draftLetters, active) : 0;
  }
  /** Provides emit behavior. */
  private emit(): void {
    this.listeners.forEach((listener) => listener());
  }
}
