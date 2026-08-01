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
import type {HostServices} from "../types";

type RaceMethods = Pick<
  HostServices,
  | "listRaceCategories"
  | "startRace"
  | "submitRaceGuess"
  | "requestRaceHint"
  | "skipRaceRiddle"
  | "resumeRace"
  | "publishRace"
  | "getRaceChallenge"
  | "getRaceOutcome"
  | "listRaceInbox"
>;

type FakeRun = {
  view: RaceRunView;
  startedAtMs: number;
  answers: string[];
  guessesUsed: number;
  hintUsed: boolean;
  hintPenaltyMs: number;
  skipPenaltyMs: number;
  responses: Map<string, unknown>;
};

type FakeChallenge = {
  preview: Awaited<ReturnType<RaceMethods["getRaceChallenge"]>>;
  runId: string;
  events: RaceGhostEvent[];
};

const FAKE_CHALLENGE_PREFIX = "riddleQuest:fakeRaceChallenge:";

const sharedHarnessEnabled = () =>
  typeof location !== "undefined" && new URLSearchParams(location.search).get("sharedRace") === "1";

const loadPersistedChallenge = async (challengeId: string): Promise<FakeChallenge | undefined> => {
  try {
    const raw = globalThis.localStorage?.getItem(`${FAKE_CHALLENGE_PREFIX}${challengeId}`);
    if (raw) return JSON.parse(raw) as FakeChallenge;
    if (sharedHarnessEnabled()) {
      const response = await fetch(`/__race-harness/challenges/${encodeURIComponent(challengeId)}`);
      if (response.ok) return (await response.json()) as FakeChallenge;
    }
    return undefined;
  } catch {
    return undefined;
  }
};

const persistChallenge = async (challengeId: string, challenge: FakeChallenge) => {
  try {
    globalThis.localStorage?.setItem(`${FAKE_CHALLENGE_PREFIX}${challengeId}`, JSON.stringify(challenge));
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

const categoryPresentation: Record<
  RaceCategoryId,
  {icon: "history" | "geography" | "music" | "film" | "science" | "shuffle"; colorToken: string}
> = {
  history: {icon: "history", colorToken: "#2E8B57"},
  geography: {icon: "geography", colorToken: "#286B8E"},
  music: {icon: "music", colorToken: "#6847A5"},
  film: {icon: "film", colorToken: "#247A55"},
  science: {icon: "science", colorToken: "#A46712"},
  mixed: {icon: "shuffle", colorToken: "#A43B4D"},
};

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

export const createFakeRaceServices = (): RaceMethods => {
  const runs = new Map<string, FakeRun>();
  const challenges = new Map<string, FakeChallenge>();
  let sequence = 0;

  const syncView = (run: FakeRun): RaceRunView => {
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
          }
        : null,
    };
  };

  const getRun = (runId: string): FakeRun => {
    const run = runs.get(runId);
    if (!run) throw new Error("Race run not found.");
    return run;
  };

  const advance = (run: FakeRun) => {
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

  const addEvent = (run: FakeRun, type: RaceGhostEvent["type"], penaltyAddedMs: number) => {
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
    async startRace(input) {
      const challenge = input.challengeId
        ? (challenges.get(input.challengeId) ?? (await loadPersistedChallenge(input.challengeId)))
        : undefined;
      if (input.challengeId && !challenge) throw new Error("Race challenge not found.");
      const runId = `fake-run-${++sequence}`;
      const categoryId = challenge?.preview.categoryId ?? input.categoryId ?? "mixed";
      const startedAtMs = Date.now();
      const run: FakeRun = {
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
    async submitRaceGuess(input) {
      const run = getRun(input.runId);
      const cached = run.responses.get(input.requestId);
      if (cached) return cached as Awaited<ReturnType<RaceMethods["submitRaceGuess"]>>;
      if (run.view.currentRiddle?.riddleId !== input.riddleId) throw new Error("That riddle is no longer active.");
      const answer = run.answers[run.view.currentRiddle.position];
      if (input.guess.length !== answer.length)
        throw new Error(`Guess must contain exactly ${answer.length} characters.`);
      run.guessesUsed += 1;
      const isCorrect = input.guess.toLocaleLowerCase() === answer;
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
    async requestRaceHint(input) {
      const run = getRun(input.runId);
      const cached = run.responses.get(input.requestId);
      if (cached) return cached as Awaited<ReturnType<RaceMethods["requestRaceHint"]>>;
      if (run.hintUsed || !run.view.currentRiddle) throw new Error("The hint is already used.");
      const index = input.currentAttempt.findIndex(
        (letter, position) => letter.toLocaleLowerCase() !== run.answers[run.view.currentRiddle!.position][position],
      );
      const revealedLetter = run.answers[run.view.currentRiddle.position][Math.max(0, index)];
      run.hintUsed = true;
      run.hintPenaltyMs += RACE_HINT_PENALTY_MS;
      run.view = {
        ...run.view,
        currentRiddle: {
          ...run.view.currentRiddle,
          revealedLetters: [{index: Math.max(0, index), letter: revealedLetter}],
        },
      };
      addEvent(run, "hint", RACE_HINT_PENALTY_MS);
      const response = {run: syncView(run), revealedLetter, index: Math.max(0, index)};
      run.responses.set(input.requestId, response);
      return response;
    },
    async skipRaceRiddle(input) {
      const run = getRun(input.runId);
      const cached = run.responses.get(input.requestId);
      if (cached) return cached as Awaited<ReturnType<RaceMethods["skipRaceRiddle"]>>;
      if (run.guessesUsed < 1) throw new Error("Submit one guess before skipping.");
      run.skipPenaltyMs += RACE_SKIP_PENALTY_MS;
      addEvent(run, "skip", RACE_SKIP_PENALTY_MS);
      advance(run);
      const response = {run: syncView(run), penaltyAddedMs: RACE_SKIP_PENALTY_MS as 45000};
      run.responses.set(input.requestId, response);
      return response;
    },
    async resumeRace(runId) {
      return {run: syncView(getRun(runId))};
    },
    async publishRace(input) {
      const run = getRun(input.runId);
      if (run.view.status !== "completed" || run.view.role !== "creator") throw new Error("Complete the race first.");
      const cached = run.responses.get(input.requestId);
      if (cached) return cached as Awaited<ReturnType<RaceMethods["publishRace"]>>;
      const challengeId = `fake-challenge-${++sequence}`;
      const preview = {
        challengeId,
        creator: {displayName: "Guest Solver"},
        categoryId: run.view.categoryId,
        targetCorrect: 10 as const,
        adjustedTimeToBeatMs: syncView(run).adjustedElapsedMs,
        rulesVersion: "race10_v1" as const,
        expiresAtMs: Date.now() + 7 * 24 * 60 * 60 * 1_000,
        status: "active" as const,
      };
      const challenge = {preview, runId: run.view.runId, events: run.view.events};
      challenges.set(challengeId, challenge);
      await persistChallenge(challengeId, challenge);
      const response = {challengeId, preview};
      run.responses.set(input.requestId, response);
      return response;
    },
    async getRaceChallenge(challengeId) {
      const challenge = challenges.get(challengeId) ?? (await loadPersistedChallenge(challengeId));
      if (!challenge) throw new Error("Race challenge not found.");
      return challenge.preview;
    },
    async getRaceOutcome(runId): Promise<RaceOutcome> {
      const run = getRun(runId);
      const view = syncView(run);
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
      };
    },
    async listRaceInbox() {
      return {items: []};
    },
  };
};
