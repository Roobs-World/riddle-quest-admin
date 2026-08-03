import {RACE_HINT_PENALTY_MS, RACE_SKIP_PENALTY_MS} from "@qwordly/core/race";
import type {CallableRequest} from "firebase-functions/v2/https";
import {
  abandonedRaceResponseFixture,
  raceCallableRequestId,
  raceCallableUserId,
  raceCategoriesFixture,
  raceChallengePreviewFixture,
  raceOutcomeFixture,
  raceRunFixture,
  raceRunResponseFixture,
} from "./callableFixtures";

export type RaceHandler = (request: CallableRequest<unknown>) => Promise<unknown>;

export interface RaceCallableCase {
  name: string;
  handler: RaceHandler;
  input: unknown;
  serviceMock: jest.Mock;
  response: unknown;
  expectedCall: unknown[];
  accessCall?: unknown[];
}

type HandlerName =
  | "getRaceAccess"
  | "recordRaceAnalytics"
  | "listRaceCategories"
  | "startRaceRun"
  | "submitRaceGuess"
  | "requestRaceHint"
  | "skipRaceRiddle"
  | "resumeRaceRun"
  | "abandonRaceRun"
  | "publishRaceChallenge"
  | "getRaceChallenge"
  | "getRaceOutcome"
  | "listRaceInbox";

type ServiceName =
  | "getRaceAccessForUser"
  | "recordRaceAnalyticsForUser"
  | "listRaceCategoriesForLocale"
  | "startRaceRunForUser"
  | "submitRaceGuessForUser"
  | "requestRaceHintForUser"
  | "skipRaceRiddleForUser"
  | "resumeRaceRunForUser"
  | "abandonRaceRunForUser"
  | "publishRaceChallengeForUser"
  | "getRaceChallengePreview"
  | "getRaceOutcomeForUser"
  | "listRaceInboxForUser";

export type RaceCallableHandlers = Record<HandlerName, RaceHandler>;
export type RaceCallableServiceMocks = Record<ServiceName, jest.Mock>;

export const createRaceCallableCases = (
  handlers: RaceCallableHandlers,
  mocks: RaceCallableServiceMocks,
): RaceCallableCase[] => {
  const userId = raceCallableUserId;
  const requestId = raceCallableRequestId;
  return [
    {
      name: "getRaceAccess",
      handler: handlers.getRaceAccess,
      input: {locale: "en"},
      serviceMock: mocks.getRaceAccessForUser,
      response: {enabled: true, locale: "en", reason: "enabled"},
      expectedCall: [userId, "en"],
    },
    {
      name: "recordRaceAnalytics",
      handler: handlers.recordRaceAnalytics,
      input: {eventId: requestId, eventName: "race_mode_viewed", params: {}},
      serviceMock: mocks.recordRaceAnalyticsForUser,
      response: {accepted: true},
      expectedCall: [userId, {eventId: requestId, eventName: "race_mode_viewed", params: {}}],
    },
    {
      name: "listRaceCategories",
      handler: handlers.listRaceCategories,
      input: {locale: "en"},
      serviceMock: mocks.listRaceCategoriesForLocale,
      response: raceCategoriesFixture,
      expectedCall: ["en"],
      accessCall: [userId, "en"],
    },
    {
      name: "startRaceRun",
      handler: handlers.startRaceRun,
      input: {locale: "en", categoryId: "history", requestId},
      serviceMock: mocks.startRaceRunForUser,
      response: raceRunResponseFixture,
      expectedCall: [userId, {locale: "en", categoryId: "history", requestId}],
      accessCall: [userId, "en"],
    },
    {
      name: "submitRaceGuess",
      handler: handlers.submitRaceGuess,
      input: {runId: "run-1", riddleId: "riddle-1", guess: "piano", requestId},
      serviceMock: mocks.submitRaceGuessForUser,
      response: {
        run: raceRunFixture,
        feedback: [{letter: "p", status: "green"}],
        isCorrect: true,
        autoSkipped: false,
      },
      expectedCall: [userId, {runId: "run-1", riddleId: "riddle-1", guess: "piano", requestId}],
      accessCall: [userId],
    },
    {
      name: "requestRaceHint",
      handler: handlers.requestRaceHint,
      input: {runId: "run-1", riddleId: "riddle-1", requestId},
      serviceMock: mocks.requestRaceHintForUser,
      response: {
        run: {...raceRunFixture, totalPenaltyMs: RACE_HINT_PENALTY_MS},
        revealedLetter: "p",
        index: 0,
      },
      expectedCall: [userId, {runId: "run-1", riddleId: "riddle-1", requestId}, {enforceAccess: true}],
    },
    {
      name: "skipRaceRiddle",
      handler: handlers.skipRaceRiddle,
      input: {runId: "run-1", riddleId: "riddle-1", requestId},
      serviceMock: mocks.skipRaceRiddleForUser,
      response: {
        run: {...raceRunFixture, totalPenaltyMs: RACE_SKIP_PENALTY_MS},
        penaltyAddedMs: RACE_SKIP_PENALTY_MS,
      },
      expectedCall: [userId, {runId: "run-1", riddleId: "riddle-1", requestId}],
      accessCall: [userId],
    },
    {
      name: "resumeRaceRun",
      handler: handlers.resumeRaceRun,
      input: {runId: "run-1"},
      serviceMock: mocks.resumeRaceRunForUser,
      response: raceRunResponseFixture,
      expectedCall: [userId, "run-1"],
      accessCall: [userId],
    },
    {
      name: "abandonRaceRun",
      handler: handlers.abandonRaceRun,
      input: {runId: "run-1", requestId},
      serviceMock: mocks.abandonRaceRunForUser,
      response: abandonedRaceResponseFixture,
      expectedCall: [userId, {runId: "run-1", requestId}],
      accessCall: [userId],
    },
    {
      name: "publishRaceChallenge",
      handler: handlers.publishRaceChallenge,
      input: {runId: "run-1", requestId},
      serviceMock: mocks.publishRaceChallengeForUser,
      response: {
        challengeId: "challenge-1",
        preview: raceChallengePreviewFixture,
        newlyUnlockedAchievementIds: [],
        achievementCoinsAwarded: 0,
      },
      expectedCall: [userId, {runId: "run-1", requestId}],
      accessCall: [userId],
    },
    {
      name: "getRaceChallenge",
      handler: handlers.getRaceChallenge,
      input: {challengeId: "challenge-1"},
      serviceMock: mocks.getRaceChallengePreview,
      response: raceChallengePreviewFixture,
      expectedCall: ["challenge-1"],
      accessCall: [userId],
    },
    {
      name: "getRaceOutcome",
      handler: handlers.getRaceOutcome,
      input: {runId: "run-1"},
      serviceMock: mocks.getRaceOutcomeForUser,
      response: raceOutcomeFixture,
      expectedCall: [userId, "run-1"],
      accessCall: [userId],
    },
    {
      name: "listRaceInbox",
      handler: handlers.listRaceInbox,
      input: {limit: 10},
      serviceMock: mocks.listRaceInboxForUser,
      response: {items: []},
      expectedCall: [userId, {limit: 10}],
      accessCall: [userId],
    },
  ];
};
