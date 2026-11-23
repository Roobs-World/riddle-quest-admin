import {RaceEntryResponseSchema, type RaceInvitationView} from "../../../../core/race";
import {
  RACE_CATEGORY_IDS,
  RACE_HINT_PENALTY_MS,
  RACE_RULES,
  RACE_SKIP_PENALTY_MS,
  type RaceCategoryId,
  type RaceGhostEvent,
  type RaceOutcome,
  type RaceRunView,
} from "../../../../core/race";
import {computeFeedback, splitGraphemes} from "../../../../core/game";
import type {HostServices} from "../../../../hosted/hostTypes";
import {readBrowserStorage, writeBrowserStorage} from "../../../platform/browserStorage";

/** Multiplayer host methods implemented by the deterministic browser harness. */
type RaceMethods = Pick<
  HostServices,
  | "listRaceCategories"
  | "startRace"
  | "readyRace"
  | "submitRaceGuess"
  | "requestRaceHint"
  | "skipRaceRiddle"
  | "resumeRace"
  | "abandonRace"
  | "publishRace"
  | "reserveRaceInvite"
  | "getRaceEntry"
  | "cancelRaceInvite"
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
    icon: "history" | "geography" | "music" | "film" | "science" | "shuffle";
    /** Stores color token. */
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

/** Returns the bounded skip delay requested by the browser-test URL. */
const getRaceSkipDelayMs = () => {
  if (typeof location === "undefined") return 0;
  /** Requested artificial skip latency in milliseconds. */
  const requestedDelay = Number(new URLSearchParams(location.search).get("raceSkipDelayMs"));
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
  /** Concurrent and repeated starts resolve the same run, matching the authority's start receipts. */
  const startRequests = new Map<string, Promise<string>>();
  /** Published challenges indexed by their opaque harness challenge identifier. */
  const challenges = new Map<string, FakeChallenge>();
  /** Reservation identity remains separate from reusable challenge publication. */
  const invitations = new Map<string, RaceInvitationView & {
    /** Cancellation fact. */ cancelled: boolean}>();
  /** Persisted harness invitations permit recipient waiting on another mounted surface. */
  const invitationKey = (challengeId: string) => `riddleQuest:fakeRaceInvitation:${challengeId}`;
  /** Loads reservation facts without interpreting a provider-specific ID. */
  const loadInvitation = (challengeId: string) => {
    if (invitations.has(challengeId)) return invitations.get(challengeId);
    try {
      /** Shared browser-harness record. */
      const raw = readBrowserStorage("local", invitationKey(challengeId));
      return raw ? {...JSON.parse(raw), role: "recipient", canCancel: false} as RaceInvitationView & {
    /** Cancellation fact. */ cancelled: boolean} : undefined;
    } catch {return undefined;}
  };
  /** Monotonic identifier sequence for harness runs and challenges. */
  let sequence = 0;

  /** Produces the current externally visible run view from mutable harness state. */
  const syncView = (run: FakeRun): RaceRunView => {
    /** One authority sample determines both lifecycle and elapsed duration. */
    const nowMs = Date.now();
    if (run.view.status === "scheduled" && nowMs >= run.startedAtMs) run.view.status = "active";
    if (run.view.status === "prepared" && nowMs >= (run.view.preparationExpiresAtMs ?? Infinity)) {
      run.view.status = "abandoned"; run.view.currentRiddle = null;
    }
    /** Provides wall elapsed ms behavior. */
    const wallElapsedMs =
      run.view.status === "active" ? Math.max(0, nowMs - run.startedAtMs) : run.view.wallElapsedMs;
    return {
      ...run.view,
      serverNowMs: nowMs,
      ...(run.view.status !== "prepared" ? {startsAtMs: run.startedAtMs} : {}),
      wallElapsedMs,
      totalPenaltyMs: run.hintPenaltyMs + run.skipPenaltyMs,
      adjustedElapsedMs: wallElapsedMs + run.hintPenaltyMs + run.skipPenaltyMs,
      ...(run.evaluationEnabled
        ? {
            preloadedRiddles: clues.map((text, position) => ({
              hint: {index: 0, letter: Array.from(answers[position]!)[0]!},
              riddleId: `fake-race-${position + 1}`,
              text,
              answerLength: answers[position].length,
              position,
              evaluation: {answer: answers[position], locale: run.view.locale},
            })),
          }
        : {}),
      currentRiddle: run.view.currentRiddle
        ? {
            ...run.view.currentRiddle,
            guessesUsed: run.guessesUsed,
            guessesRemaining: 5 - run.guessesUsed,
            hintAvailable: run.view.currentRiddle.revealedLetters.length < run.answers[run.view.currentRiddle.position].length,
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
  /** Enforces the same active-question precondition as production before a new mutation is charged. */
  const requireActiveQuestion = (run: FakeRun, riddleId: string): void => {
    /** Scheduled runs become editable only at their authority-owned start. */
    const view = syncView(run);
    if (view.status !== "active" || !view.currentRiddle) throw new Error("This Race to 10 run is no longer active.");
    if (view.currentRiddle.riddleId !== riddleId) throw new Error("That riddle is no longer active.");
  };
  /** Intermediate paid actions can end competitive play without clearing all ten questions. */
  const finalizePenalty = (run: FakeRun): void => {
    /** Maximum-time expiry takes precedence over an opponent finish for an incomplete run. */
    const view = syncView(run);
    /** Creators remain uncapped while recording their challenge. */
    const timedOut = view.role === "challenger" && view.adjustedElapsedMs >= view.rules.maxAdjustedTimeMs;
    if (timedOut || view.opponent && view.adjustedElapsedMs > view.opponent.adjustedFinishMs) {
      /** Terminal clocks retain the charge while freezing solving time. */
      const finishMs = timedOut ? view.rules.maxAdjustedTimeMs : view.opponent!.adjustedFinishMs;
      run.view = {...view, status: timedOut ? "timed_out" : "completed", currentRiddle: null,
        wallElapsedMs: Math.max(0, finishMs - view.totalPenaltyMs)};
    }
  };

  /** Advances a run to its next deterministic riddle. */
  const advance = (run: FakeRun) => {
    /** Provides current position behavior. */
    const currentPosition = (run.view.currentRiddle?.position ?? 0) + 1;
    run.guessesUsed = 0;
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
      /** A replay reads the latest authoritative view rather than creating another run. */
      const existing = startRequests.get(input.requestId);
      if (existing) return {run: syncView(getRun(await existing))};
      /** Register creation before its first asynchronous step to deduplicate concurrent starts. */
      const pending = (async () => {
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
          hintPenaltyMs: 0,
          skipPenaltyMs: 0,
          responses: new Map(),
          view: {
            runId,
            challengeId: input.challengeId,
            rivalryChallengeId: input.rivalryChallengeId,
            role: input.challengeId ? "challenger" : "creator",
            status: input.prepare ? "prepared" : "active",
            ...(input.prepare ? {preparationExpiresAtMs: Date.now() + 30_000} : {}),
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
        return runId;
      })();
      startRequests.set(input.requestId, pending);
      try {return {run: syncView(getRun(await pending))};}
      catch (error) {
        if (startRequests.get(input.requestId) === pending) startRequests.delete(input.requestId);
        throw error;
      }
    },
    /** Schedules one prepared harness run; retries preserve its first server start. */
    async readyRace(input) {
      /** Provides run behavior. */
      const run = getRun(input.runId);
      syncView(run);
      if (run.view.status === "prepared") { run.startedAtMs = Date.now() + 3_000; run.view.status = "scheduled"; }
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
      /** A concurrent delivery may have committed this receipt while transport was delayed. */
      const committed = run.responses.get(input.requestId);
      if (committed) return committed as Awaited<ReturnType<RaceMethods["submitRaceGuess"]>>;
      requireActiveQuestion(run, input.riddleId);
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
      /** Authority trims transport whitespace before validating and scoring the answer slots. */
      const guess = input.guess.trim();
      if (splitGraphemes(guess, run.view.locale).length !== splitGraphemes(answer, run.view.locale).length)
        throw new Error(`Guess must contain exactly ${answer.length} characters.`);
      run.guessesUsed += 1;
      /** Indicates whether is correct. */
      const isCorrect = guess.normalize("NFC").toLocaleLowerCase(run.view.locale) === answer.normalize("NFC").toLocaleLowerCase(run.view.locale);
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
        run.view = {...run.view, correctCount: run.view.correctCount + 1};
        addEvent(run, "skip", RACE_SKIP_PENALTY_MS);
        if (run.view.correctCount >= run.view.rules.targetCorrect) run.view = {...syncView(run), status: "completed", currentRiddle: null};
        else {advance(run); finalizePenalty(run);}
        autoSkipped = true;
      }
      /** Shared scoring preserves duplicate occurrence limits and localized grapheme positions. */
      const feedback = computeFeedback(guess, answer, run.view.locale);
      /** Provides response behavior. */
      const response = {
        run: syncView(run),
        feedback: splitGraphemes(guess, run.view.locale).map((letter, index) => ({
          letter, status: feedback[index],
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
      requireActiveQuestion(run, input.riddleId);
      if (!run.view.currentRiddle) throw new Error("No active race riddle is available.");
      /** Provides revealed behavior. */
      const revealed = new Set(run.view.currentRiddle.revealedLetters.map((letter) => letter.index));
      /** Provides index behavior. */
      const index = [...run.answers[run.view.currentRiddle.position]].findIndex(
        (_, position) => !revealed.has(position),
      );
      if (index < 0) throw new Error("No server-selected hint is available.");
      /** Provides revealed letter behavior. */
      const revealedLetter = run.answers[run.view.currentRiddle.position][index];
      run.hintPenaltyMs += RACE_HINT_PENALTY_MS;
      run.view = {
        ...run.view,
        currentRiddle: {
          ...run.view.currentRiddle,
          revealedLetters: [...run.view.currentRiddle.revealedLetters, {index, letter: revealedLetter}],
        },
      };
      addEvent(run, "hint", RACE_HINT_PENALTY_MS);
      finalizePenalty(run);
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
      /** Artificial transport latency used to prove that the client transition is local. */
      const delayMs = getRaceSkipDelayMs();
      if (delayMs > 0) await new Promise((resolve) => window.setTimeout(resolve, delayMs));
      /** A concurrent delivery may have committed this receipt while transport was delayed. */
      const committed = run.responses.get(input.requestId);
      if (committed) return committed as Awaited<ReturnType<RaceMethods["skipRaceRiddle"]>>;
      requireActiveQuestion(run, input.riddleId);
      run.skipPenaltyMs += RACE_SKIP_PENALTY_MS;
      run.view = {...run.view, correctCount: run.view.correctCount + 1};
      addEvent(run, "skip", RACE_SKIP_PENALTY_MS);
      if (run.view.correctCount >= 10) run.view = {...syncView(run), status: "completed", currentRiddle: null};
      else {advance(run); finalizePenalty(run);}
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
      if (!["prepared", "scheduled", "active", "abandoned"].includes(run.view.status)) {
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
      /** Deterministic unique reservation identity. */
      const suffix = (++sequence).toString(16).padStart(32, "0");
      /** Private reservation expires even if no recording is published. */
      const challengeId = `jest-invite-${"a".repeat(64)}-${suffix}`;
      /** Independent invitation facts for this creator surface. */
      const invitation = {claimState: "unclaimed" as const, publicationState: "pending" as const, role: "creator" as const, canCancel: true, expiresAtMs: Date.now() + 7 * 86400000, cancelled: false};
      invitations.set(challengeId, invitation);
      writeBrowserStorage("local", invitationKey(challengeId), JSON.stringify(invitation));
      return {challengeId, expiresAtMs: invitation.expiresAtMs};
    },
    /** Reads typed readiness rather than encoding waiting in errors. */
    async getRaceEntry(challengeId, locale) {
      /** Independent persisted authority facts used by the injected browser harness. */
      const invitation = loadInvitation(challengeId);
      /** Recording becomes available only after successful publication. */
      const challenge = challenges.get(challengeId) ?? await loadPersistedChallenge(challengeId);
      /** Server clock included for waiting expiry. */
      const serverNowMs = Date.now();
      if (invitation?.cancelled) return RaceEntryResponseSchema.parse({status: "cancelled", invitation: {claimState: invitation.claimState, publicationState: invitation.publicationState, role: invitation.role, canCancel: false, expiresAtMs: invitation.expiresAtMs}, serverNowMs});
      if (invitation && invitation.expiresAtMs <= serverNowMs) return {status: "expired", serverNowMs};
      if (challenge && challenge.preview.locale !== locale) return {status: "unavailable", reason: "locale", serverNowMs};
      if (challenge && challenge.preview.expiresAtMs <= serverNowMs) return {status: "expired", serverNowMs};
      if (challenge && challenge.preview.status !== "active") return {status: "unavailable", reason: "inactive", serverNowMs};
      if (challenge && !invitation) return RaceEntryResponseSchema.parse({status: "ready", challenge: challenge.preview, serverNowMs});
      if (!invitation) return {status: "unavailable", reason: "missing", serverNowMs};
      if (invitation.role === "recipient") invitation.claimState = "claimed";
      if (challenge) invitation.publicationState = "published";
      writeBrowserStorage("local", invitationKey(challengeId), JSON.stringify(invitation));
      /** Recipient reads retain a claimed seat while waiting for publication. */
      const {cancelled: _cancelled, ...view} = invitation;
      if (challenge) return RaceEntryResponseSchema.parse({status: "ready", challenge: challenge.preview, invitation: view, serverNowMs});
      return RaceEntryResponseSchema.parse({status: "waiting", invitation: view, serverNowMs});
    },
    /** Cancels a reservation without revoking any unrelated public score challenge. */
    async cancelRaceInvite(input) {
      /** Only the reservation owner may cancel. */
      const invitation = loadInvitation(input.challengeId);
      if (!invitation?.canCancel) throw new Error("Only the creator can cancel.");
      invitation.cancelled = true;
      invitations.set(input.challengeId, invitation);
      writeBrowserStorage("local", invitationKey(input.challengeId), JSON.stringify(invitation));
      /** Privacy-safe terminal lifecycle view. */
      const {cancelled: _cancelled, ...view} = invitation;
      return RaceEntryResponseSchema.parse({status: "cancelled", invitation: {...view, canCancel: false}, serverNowMs: Date.now()});
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
      /** Separate creator surfaces must never publish different recordings under one shared link. */
      const challengeId = input.reservedChallengeId ?? `fake-challenge-${crypto.randomUUID()}`;
      if (input.reservedChallengeId) {
        /** Reserved publication cannot revive a cancelled or expired invitation. */
        const invitation = loadInvitation(challengeId);
        if (!invitation || invitation.cancelled || invitation.expiresAtMs <= Date.now()) throw new Error("Invitation is unavailable.");
        invitation.publicationState = "published";
        invitations.set(challengeId, invitation);
        writeBrowserStorage("local", invitationKey(challengeId), JSON.stringify(invitation));
      }
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
      // Mirror authority deadline settlement before returning a terminal outcome.
      if (run.view.correctCount < run.view.rules.targetCorrect) finalizePenalty(run);
      /** Provides view behavior. */
      const view = syncView(run);
      /** Provides result behavior. */
      const result: RaceOutcome["result"] =
        view.status === "timed_out"
          ? "timed_out"
          : view.role === "creator"
            ? "recorded"
            : view.status === "completed" && view.correctCount < view.rules.targetCorrect && view.opponent
              ? "ghost_win"
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
        publishable: view.role === "creator" && view.status === "completed" && view.correctCount === view.rules.targetCorrect,
        rematchEligible: view.role === "challenger" && view.status === "completed",
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
