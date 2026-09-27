import {
  RACE_CATEGORY_IDS,
  RACE_HINT_PENALTY_MS,
  RACE_RULES,
  RACE_SKIP_PENALTY_MS,
  type RaceCategoryId,
  type RaceGhostEvent,
  type RaceOutcome,
  type RaceRunView,
} from "@qwordly/core/race";
import type {HostServices} from "../../types";
import {readBrowserStorage, writeBrowserStorage} from "../../../platform/browserStorage";

/** Multiplayer host methods implemented by the deterministic browser harness. */
type RaceMethods = Pick<
  HostServices,
  | "listRaceCategories"
  | "startRace"
  | "submitRaceGuess"
  | "requestRaceHint"
  | "skipRaceRiddle"
  | "resumeRace"
  | "abandonRace"
  | "publishRace"
  | "reserveRaceInvite"
  | "getRaceChallenge"
  | "getRaceOutcome"
  | "listRaceInbox"
  | "blockRival"
  | "reportRival"
>;

/** Mutable harness record backing one simulated authoritative race run. */
type FakeRun = {
  /** The evaluation enabled used by the current operation. */
  evaluationEnabled: boolean;
  /** Stores view. */
  view: RaceRunView;
  /** Stores started at ms. */
  startedAtMs: number;
  /** Stores answers. */
  answers: string[];
  /** Stores guesses used. */
  guessesUsed: number;
  /** Stores hint used. */
  hintUsed: boolean;
  /** Stores hint penalty ms. */
  hintPenaltyMs: number;
  /** Stores skip penalty ms. */
  skipPenaltyMs: number;
  /** Stores responses. */
  responses: Map<string, unknown>;
};

/** Persisted challenge data shared between creator and recipient harnesses. */
type FakeChallenge = {
  /** Stores preview. */
  preview: Awaited<ReturnType<RaceMethods["getRaceChallenge"]>>;
  /** Stores run id. */
  runId: string;
  /** Stores events. */
  events: RaceGhostEvent[];
};

/** Storage namespace for deterministic browser-harness challenges. */
const FAKE_CHALLENGE_PREFIX = "riddleQuest:fakeRaceChallenge:";

/** Returns whether cross-page harness challenge sharing is enabled. */
const sharedHarnessEnabled = () =>
  typeof location !== "undefined" && new URLSearchParams(location.search).get("sharedRace") === "1";

/** Loads a challenge from local storage or the shared browser harness endpoint. */
const loadPersistedChallenge = async (challengeId: string): Promise<FakeChallenge | undefined> => {
  try {
    /** Provides raw behavior. */
    const raw = readBrowserStorage("local", `${FAKE_CHALLENGE_PREFIX}${challengeId}`);
    if (raw) return JSON.parse(raw) as FakeChallenge;
    if (sharedHarnessEnabled()) {
      /** Provides response behavior. */
      const response = await fetch(`/__race-harness/challenges/${encodeURIComponent(challengeId)}`);
      if (response.ok) return (await response.json()) as FakeChallenge;
    }
    return undefined;
  } catch {
    return undefined;
  }
};

/** Persists a challenge for recipient-browser test flows. */
const persistChallenge = async (challengeId: string, challenge: FakeChallenge) => {
  try {
    writeBrowserStorage("local", `${FAKE_CHALLENGE_PREFIX}${challengeId}`, JSON.stringify(challenge));
    if (sharedHarnessEnabled()) {
      await fetch(`/__race-harness/challenges/${encodeURIComponent(challengeId)}`, {
        method: "PUT",
        headers: {"content-type": "application/json"},
        body: JSON.stringify(challenge),
      });
    }
  } catch {
    // Persistence is only a cross-browser convenience for the deterministic browser harness.
  }
};

/** Visual metadata used by the fake category listing. */
const categoryPresentation: Record<
  RaceCategoryId,
  {
    /** Stores icon. */
    icon: "history" | "geography" | "music" | "film" | "science" | "shuffle"; /** Stores color token. */
    /** Stores color token. */
    colorToken: string;
  }
> = {
  history: {icon: "history", colorToken: "#2E8B57"},
  geography: {icon: "geography", colorToken: "#286B8E"},
  music: {icon: "music", colorToken: "#6847A5"},
  film: {icon: "film", colorToken: "#247A55"},
  science: {icon: "science", colorToken: "#A46712"},
  mixed: {icon: "shuffle", colorToken: "#A43B4D"},
};

/** Deterministic riddle prompts served by the browser harness. */
const clues = [
  "What has keys but cannot open a door?",
  "What has hands and a face but no arms?",
  "What gets wetter while it dries?",
  "What has a neck but no head?",
  "What can travel around the world while staying in a corner?",
  "What has one eye but cannot see?",
  "What belongs to you but others use more?",
  "What has many teeth but cannot bite?",
  "What runs but never walks?",
  "What has words but never speaks?",
  "What goes up but never comes down?",
  "What has a thumb and four fingers but is not alive?",
  "What building has the most stories?",
  "What can fill a room but takes no space?",
  "What has a ring but no finger?",
];
/** Answers corresponding by position to the deterministic harness clues. */
const answers = [
  "piano",
  "clock",
  "towel",
  "bottle",
  "stamp",
  "needle",
  "name",
  "comb",
  "water",
  "book",
  "age",
  "glove",
  "library",
  "light",
  "phone",
];

/** Returns the bounded outcome delay requested by the browser-test URL. */
const getRaceOutcomeDelayMs = () => {
  if (typeof location === "undefined") return 0;
  /** Requested artificial outcome latency in milliseconds. */
  const requestedDelay = Number(new URLSearchParams(location.search).get("raceOutcomeDelayMs"));
  return Number.isFinite(requestedDelay) ? Math.max(0, Math.min(2_000, requestedDelay)) : 0;
};

/** Returns how many outcome requests the browser harness should fail before recovering. */
const getRaceOutcomeFailureCount = () => {
  if (typeof location === "undefined") return 0;
  /** Requested number of one-shot failures. */
  const requestedFailures = Number(new URLSearchParams(location.search).get("raceOutcomeFailures"));
  return Number.isFinite(requestedFailures) ? Math.max(0, Math.min(3, Math.floor(requestedFailures))) : 0;
};

/** Returns the bounded race-start delay requested by the browser-test URL. */
const getRaceStartDelayMs = () => {
  if (typeof location === "undefined") return 0;
  /** Requested artificial start latency in milliseconds. */
  const requestedDelay = Number(new URLSearchParams(location.search).get("raceStartDelayMs"));
  return Number.isFinite(requestedDelay) ? Math.max(0, Math.min(5_000, requestedDelay)) : 0;
};

/** Returns the bounded guess delay requested by the browser-test URL. */
const getRaceGuessDelayMs = () => {
  if (typeof location === "undefined") return 0;
  /** Requested artificial guess latency in milliseconds. */
  const requestedDelay = Number(new URLSearchParams(location.search).get("raceGuessDelayMs"));
  return Number.isFinite(requestedDelay) ? Math.max(0, Math.min(5_000, requestedDelay)) : 0;
};

/** Whether the browser harness should mirror the backend's late-ghost rejection. */
const rejectsLateGhostGuess = () =>
  typeof location !== "undefined" && new URLSearchParams(location.search).get("raceRejectLateGuess") === "1";

/** Creates deterministic in-memory race services for browser and component harnesses. */
export const createFakeRaceServices = (): RaceMethods => {
  /** Remaining deliberate outcome failures for retry-path browser coverage. */
  let raceOutcomeFailuresRemaining = getRaceOutcomeFailureCount();
  /** Mutable runs indexed by their opaque harness run identifier. */
  const runs = new Map<string, FakeRun>();
  /** Published challenges indexed by their opaque harness challenge identifier. */
  const challenges = new Map<string, FakeChallenge>();
  /** Monotonic identifier sequence for harness runs and challenges. */
  let sequence = 0;

  /** Produces the current externally visible run view from mutable harness state. */
  const syncView = (run: FakeRun): RaceRunView => {
    /** Wall-clock duration captured or advanced for the run. */
    const wallElapsedMs =
      run.view.status === "active" ? Math.max(0, Date.now() - run.startedAtMs) : run.view.wallElapsedMs;
    return {
      ...run.view,
      wallElapsedMs,
      totalPenaltyMs: run.hintPenaltyMs + run.skipPenaltyMs,
      adjustedElapsedMs: wallElapsedMs + run.hintPenaltyMs + run.skipPenaltyMs,
      currentRiddle: run.view.currentRiddle
        ? {
            ...run.view.currentRiddle,
            guessesUsed: run.guessesUsed,
            guessesRemaining: 5 - run.guessesUsed,
            hintAvailable: !run.hintUsed,
            ...(run.evaluationEnabled ? {evaluation: {
              answer: run.answers[run.view.currentRiddle.position], locale: run.view.locale,
            }} : {}),
          }
        : null,
    };
  };

  /** Returns a harness run or throws the same not-found failure as the host service. */
  const getRun = (runId: string): FakeRun => {
    /** Provides run behavior. */
    const run = runs.get(runId);
    if (!run) throw new Error("Race run not found.");
    return run;
  };

  /** Advances a run to its next deterministic riddle. */
  const advance = (run: FakeRun) => {
    /** Provides current position behavior. */
    const currentPosition = (run.view.currentRiddle?.position ?? 0) + 1;
    run.guessesUsed = 0;
    run.hintUsed = false;
    run.view = {
      ...syncView(run),
      currentRiddle:
        run.view.correctCount >= 10
          ? null
          : {
              riddleId: `fake-race-${currentPosition + 1}`,
              text: clues[currentPosition],
              answerLength: answers[currentPosition].length,
              position: currentPosition,
              guessesUsed: 0,
              guessesRemaining: 5,
              hintAvailable: true,
              revealedLetters: [],
            },
    };
  };

  /** Appends one authoritative ghost-playback event to a harness run. */
  const addEvent = (run: FakeRun, type: RaceGhostEvent["type"], penaltyAddedMs: number) => {
    /** Provides view behavior. */
    const view = syncView(run);
    run.view = {
      ...view,
      events: [
        ...view.events,
        {
          sequence: view.events.length,
          type,
          riddlePosition: view.currentRiddle?.position ?? 0,
          wallElapsedMs: view.wallElapsedMs,
          penaltyAddedMs: penaltyAddedMs as 0 | 15000 | 45000,
          totalPenaltyMs: view.totalPenaltyMs,
          adjustedElapsedMs: view.adjustedElapsedMs,
          correctCount: view.correctCount,
        },
      ],
    };
  };

  return {
    /** Lists deterministic categories using the production race rules. */
    async listRaceCategories() {
      return {
        categories: RACE_CATEGORY_IDS.map((categoryId) => ({
          categoryId,
          nameKey: `RaceTo10.CATEGORY_${categoryId.toUpperCase()}_NAME`,
          descriptionKey: `RaceTo10.CATEGORY_${categoryId.toUpperCase()}_DESCRIPTION`,
          ...categoryPresentation[categoryId],
          availableRiddleCount: 30,
        })),
        rules: RACE_RULES,
      };
    },
    /** Starts a creator or challenger harness run. */
    async startRace(input) {
      /** Provides delay ms behavior. */
      const delayMs = getRaceStartDelayMs();
      if (delayMs > 0) await new Promise((resolve) => window.setTimeout(resolve, delayMs));
      /** Provides challenge behavior. */
      const challenge = input.challengeId
        ? (challenges.get(input.challengeId) ?? (await loadPersistedChallenge(input.challengeId)))
        : undefined;
      if (input.challengeId && !challenge) throw new Error("Race challenge not found.");
      /** Provides run id behavior. */
      const runId = `fake-run-${++sequence}`;
      /** Provides category id behavior. */
      const categoryId = challenge?.preview.categoryId ?? input.categoryId ?? "mixed";
      /** Starts ed at ms. */
      const startedAtMs = Date.now();
      /** Provides run behavior. */
      const run: FakeRun = {
        evaluationEnabled: input.includeEvaluation === true,
        startedAtMs,
        answers,
        guessesUsed: 0,
        hintUsed: false,
        hintPenaltyMs: 0,
        skipPenaltyMs: 0,
        responses: new Map(),
        view: {
          runId,
          challengeId: input.challengeId,
          rivalryChallengeId: input.rivalryChallengeId,
          role: input.challengeId ? "challenger" : "creator",
          status: "active",
          categoryId,
          locale: input.locale,
          rules: RACE_RULES,
          correctCount: 0,
          wallElapsedMs: 0,
          totalPenaltyMs: 0,
          adjustedElapsedMs: 0,
          currentRiddle: {
            riddleId: "fake-race-1",
            text: clues[0],
            answerLength: answers[0].length,
            position: 0,
            guessesUsed: 0,
            guessesRemaining: 5,
            hintAvailable: true,
            revealedLetters: [],
          },
          events: [],
          opponent: challenge
            ? {
                displayName: challenge.preview.creator.displayName,
                adjustedFinishMs: challenge.preview.adjustedTimeToBeatMs,
                events: challenge.events,
              }
            : undefined,
        },
      };
      runs.set(runId, run);
      return {run: syncView(run)};
    },
    /** Scores and idempotently records a guess against the active harness riddle. */
    async submitRaceGuess(input) {
      /** Provides run behavior. */
      const run = getRun(input.runId);
      /** Provides cached behavior. */
      const cached = run.responses.get(input.requestId);
      if (cached) return cached as Awaited<ReturnType<RaceMethods["submitRaceGuess"]>>;
      /** Provides delay ms behavior. */
      const delayMs = getRaceGuessDelayMs();
      if (delayMs > 0) await new Promise((resolve) => window.setTimeout(resolve, delayMs));
      /** Current view after deliberate network latency. */
      const delayedView = syncView(run);
      if (
        rejectsLateGhostGuess() &&
        delayedView.opponent &&
        delayedView.adjustedElapsedMs > delayedView.opponent.adjustedFinishMs
      ) {
        throw new Error("This Race to 10 run is no longer active. [400]");
      }
      if (run.view.currentRiddle?.riddleId !== input.riddleId) throw new Error("That riddle is no longer active.");
      /** Provides answer behavior. */
      const answer = run.answers[run.view.currentRiddle.position];
      if (input.guess.length !== answer.length)
        throw new Error(`Guess must contain exactly ${answer.length} characters.`);
      run.guessesUsed += 1;
      /** Indicates whether is correct. */
      const isCorrect = input.guess.toLocaleLowerCase() === answer;
      /** Provides auto skipped behavior. */
      let autoSkipped = false;
      if (isCorrect) {
        run.view = {...run.view, correctCount: run.view.correctCount + 1};
        addEvent(run, "correct", 0);
        if (run.view.correctCount === 10) {
          run.view = {...syncView(run), status: "completed", currentRiddle: null};
        } else advance(run);
      } else if (run.guessesUsed === 5) {
        run.skipPenaltyMs += RACE_SKIP_PENALTY_MS;
        addEvent(run, "skip", RACE_SKIP_PENALTY_MS);
        advance(run);
        autoSkipped = true;
      }
      /** Provides response behavior. */
      const response = {
        run: syncView(run),
        feedback: [...input.guess].map((letter, index) => ({
          letter,
          status: (letter.toLocaleLowerCase() === answer[index] ? "green" : "red") as "green" | "red",
        })),
        isCorrect,
        autoSkipped,
      };
      run.responses.set(input.requestId, response);
      return response;
    },
    /** Reveals the next server-selected letter and applies the hint penalty. */
    async requestRaceHint(input) {
      /** Provides run behavior. */
      const run = getRun(input.runId);
      /** Provides cached behavior. */
      const cached = run.responses.get(input.requestId);
      if (cached) return cached as Awaited<ReturnType<RaceMethods["requestRaceHint"]>>;
      if (run.hintUsed || !run.view.currentRiddle) throw new Error("The hint is already used.");
      /** Provides revealed behavior. */
      const revealed = new Set(run.view.currentRiddle.revealedLetters.map((letter) => letter.index));
      /** Provides index behavior. */
      const index = [...run.answers[run.view.currentRiddle.position]].findIndex(
        (_, position) => !revealed.has(position),
      );
      if (index < 0) throw new Error("No server-selected hint is available.");
      /** Provides revealed letter behavior. */
      const revealedLetter = run.answers[run.view.currentRiddle.position][index];
      run.hintUsed = true;
      run.hintPenaltyMs += RACE_HINT_PENALTY_MS;
      run.view = {
        ...run.view,
        currentRiddle: {
          ...run.view.currentRiddle,
          revealedLetters: [...run.view.currentRiddle.revealedLetters, {index, letter: revealedLetter}],
        },
      };
      addEvent(run, "hint", RACE_HINT_PENALTY_MS);
      /** Provides response behavior. */
      const response = {run: syncView(run), revealedLetter, index};
      run.responses.set(input.requestId, response);
      return response;
    },
    /** Skips the current riddle and applies the authoritative skip penalty. */
    async skipRaceRiddle(input) {
      /** Provides run behavior. */
      const run = getRun(input.runId);
      /** Provides cached behavior. */
      const cached = run.responses.get(input.requestId);
      if (cached) return cached as Awaited<ReturnType<RaceMethods["skipRaceRiddle"]>>;
      run.skipPenaltyMs += RACE_SKIP_PENALTY_MS;
      addEvent(run, "skip", RACE_SKIP_PENALTY_MS);
      advance(run);
      /** Provides response behavior. */
      const response = {run: syncView(run), penaltyAddedMs: RACE_SKIP_PENALTY_MS as 45000};
      run.responses.set(input.requestId, response);
      return response;
    },
    /** Returns the latest authoritative view for an existing harness run. */
    async resumeRace(runId) {
      return {run: syncView(getRun(runId))};
    },
    /** Idempotently abandons an active harness run. */
    async abandonRace(input) {
      /** Provides run behavior. */
      const run = getRun(input.runId);
      /** Provides cached behavior. */
      const cached = run.responses.get(input.requestId);
      if (cached) return cached as Awaited<ReturnType<RaceMethods["abandonRace"]>>;
      if (run.view.status !== "active" && run.view.status !== "abandoned") {
        throw new Error("This race already has a final result.");
      }
      run.view = {...syncView(run), status: "abandoned", currentRiddle: null};
      /** Provides response behavior. */
      const response = {run: syncView(run), result: null};
      run.responses.set(input.requestId, response);
      return response;
    },
    /** Reserves an expiring two-player invite lobby for browser-harness sharing. */
    async reserveRaceInvite() {
      /** Deterministic unique component for the synthetic challenge identifier. */
      const suffix = (++sequence).toString(16).padStart(32, "0");
      return {
        challengeId: `jest-invite-${"a".repeat(64)}-${suffix}`,
        expiresAtMs: Date.now() + 7 * 24 * 60 * 60 * 1_000,
      };
    },
    /** Publishes a completed creator run as a persisted harness challenge. */
    async publishRace(input) {
      /** Provides run behavior. */
      const run = getRun(input.runId);
      if (run.view.status !== "completed" || run.view.role !== "creator") throw new Error("Complete the race first.");
      /** Provides cached behavior. */
      const cached = run.responses.get(input.requestId);
      if (cached) return cached as Awaited<ReturnType<RaceMethods["publishRace"]>>;
      /** Provides challenge id behavior. */
      const challengeId = input.reservedChallengeId ?? `fake-challenge-${++sequence}`;
      /** Provides preview behavior. */
      const preview = {
        challengeId,
        creator: {displayName: "Guest Solver"},
        categoryId: run.view.categoryId,
        locale: run.view.locale,
        targetCorrect: 10 as const,
        adjustedTimeToBeatMs: syncView(run).adjustedElapsedMs,
        rulesVersion: "race10_v1" as const,
        expiresAtMs: Date.now() + 7 * 24 * 60 * 60 * 1_000,
        status: "active" as const,
      };
      /** Provides challenge behavior. */
      const challenge = {preview, runId: run.view.runId, events: run.view.events};
      challenges.set(challengeId, challenge);
      await persistChallenge(challengeId, challenge);
      /** Provides response behavior. */
      const response = {
        challengeId,
        preview,
        newlyUnlockedAchievementIds: [],
        achievementCoinsAwarded: 0,
      };
      run.responses.set(input.requestId, response);
      return response;
    },
    /** Loads a published harness challenge preview. */
    async getRaceChallenge(challengeId, locale) {
      /** Provides challenge behavior. */
      const challenge = challenges.get(challengeId) ?? (await loadPersistedChallenge(challengeId));
      if (!challenge) throw new Error("Race challenge not found.");
      if (challenge.preview.locale !== locale) throw new Error("RaceTo10.ERROR_LOCALE_MISMATCH");
      return challenge.preview;
    },
    /** Calculates the final authoritative outcome for a harness run. */
    async getRaceOutcome(runId): Promise<RaceOutcome> {
      /** Provides delay ms behavior. */
      const delayMs = getRaceOutcomeDelayMs();
      if (delayMs > 0) await new Promise((resolve) => setTimeout(resolve, delayMs));
      if (raceOutcomeFailuresRemaining > 0) {
        raceOutcomeFailuresRemaining -= 1;
        throw new Error("Temporary outcome service failure.");
      }
      /** Provides run behavior. */
      const run = getRun(runId);
      /** Provides view behavior. */
      const view = syncView(run);
      /** Provides result behavior. */
      const result: RaceOutcome["result"] =
        view.status === "timed_out"
          ? "timed_out"
          : view.role === "creator"
            ? "recorded"
            : !view.opponent || view.adjustedElapsedMs < view.opponent.adjustedFinishMs
              ? "player_win"
              : view.adjustedElapsedMs > view.opponent.adjustedFinishMs
                ? "ghost_win"
                : "tie";
      return {
        runId,
        challengeId: view.challengeId,
        result,
        correctCount: view.correctCount,
        wallFinishMs: view.wallElapsedMs,
        hintPenaltyMs: run.hintPenaltyMs,
        skipPenaltyMs: run.skipPenaltyMs,
        totalPenaltyMs: view.totalPenaltyMs,
        adjustedFinishMs: view.adjustedElapsedMs,
        opponentAdjustedFinishMs: view.opponent?.adjustedFinishMs,
        publishable: view.role === "creator" && view.status === "completed",
        rematchEligible: view.status === "completed",
        newlyUnlockedAchievementIds: [],
        achievementCoinsAwarded: 0,
      };
    },
    /** Lists deterministic inbox content for browser navigation tests. */
    async listRaceInbox() {
      return {
        items: [
          {
            itemId: "fake-race-result-1",
            challengeId: "fake-challenge-1",
            opponentUserId: "jest_1111111111111111111111111111111111111111",
            opponentDisplayName: "Nova",
            categoryId: "history" as const,
            result: "win" as const,
            adjustedDeltaMs: 3_500,
            read: false,
            createdAtMs: Date.now(),
          },
        ],
      };
    },
    /** Provides block rival behavior. */
    async blockRival() {
      return {blocked: true as const};
    },
    /** Provides report rival behavior. */
    async reportRival(input) {
      return {reportId: `fake-report-${input.requestId}`, queued: true as const};
    },
  };
};
