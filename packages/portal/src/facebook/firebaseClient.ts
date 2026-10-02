import {httpsCallable} from "firebase/functions";
import type {
  ListFacebookTournamentRequest,
  RecordFacebookTournamentRunRequest,
  ListFacebookContextBoardRequest,
  RecordFacebookContextRunRequest,
} from "@qwordly/core/race";
import {firebaseFunctions} from "../firebase";
import {
  parseFacebookClientConfiguration,
  parseFacebookRewardedContinue,
  parseFacebookNotificationPromptAcceptance,
  parseFacebookNotificationPromptClaim,
  parseFacebookContextBoardResponse,
  parseFacebookContextRecordResponse,
  parseFacebookTournamentRecordResponse,
  parseFacebookTournamentResponse,
} from "./facebookCallableResponses";

/** Facebook-only extra-attempt boundary; it never accepts a grant amount. */
const grantFacebookRewardedContinueRaw = httpsCallable<{
  /** Single-player mode bound to the continuation session. */
  gameMode: "classic" | "challenge";
  /** Authority-owned question identity for the continuation grant. */
  riddleId: string;
  /** Server-issued session token binds continuation to the current question. */
  sessionToken: string;
  /** Stable mutation receipt retained across grant delivery retries. */
  requestId: string;
}, unknown>(firebaseFunctions, "grantFacebookRewardedContinue");
/** Rejects malformed responses before the game can resume. */
export const grantFacebookRewardedContinue = async (input: Parameters<typeof grantFacebookRewardedContinueRaw>[0]) => {
  /** Authority response is validated before applying its balance and continuation. */
  const result = await grantFacebookRewardedContinueRaw(input);
  return {...result, data: parseFacebookRewardedContinue(result.data)};
};

/** Provides claim facebook notification permission prompt raw behavior. */
const claimFacebookNotificationPermissionPromptRaw = httpsCallable<Record<string, never>, unknown>(
  firebaseFunctions,
  "claimFacebookNotificationPermissionPrompt",
);
/** Provides claim facebook notification permission prompt behavior. */
export const claimFacebookNotificationPermissionPrompt = async () => {
  /** Provides result behavior. */
  const result = await claimFacebookNotificationPermissionPromptRaw({});
  return {...result, data: parseFacebookNotificationPromptClaim(result.data)};
};

/** Provides accept facebook notification permission prompt raw behavior. */
const acceptFacebookNotificationPermissionPromptRaw = httpsCallable<Record<string, never>, unknown>(
  firebaseFunctions,
  "acceptFacebookNotificationPermissionPrompt",
);
/** Provides accept facebook notification permission prompt behavior. */
export const acceptFacebookNotificationPermissionPrompt = async (): Promise<void> => {
  /** Provides result behavior. */
  const result = await acceptFacebookNotificationPermissionPromptRaw({});
  parseFacebookNotificationPromptAcceptance(result.data);
};

/** Reads fail-closed Facebook feature switches and durable ad suppression. */
const getFacebookClientConfigurationRaw = httpsCallable<Record<string, never>, unknown>(
  firebaseFunctions,
  "getFacebookClientConfiguration",
);
/** Gets facebook client configuration. */
export const getFacebookClientConfiguration = async () => {
  /** Provides result behavior. */
  const result = await getFacebookClientConfigurationRaw({});
  return {...result, data: parseFacebookClientConfiguration(result.data)};
};

/** Lists identity-free authoritative Facebook tournament standings. */
const listFacebookTournamentRaw = httpsCallable<ListFacebookTournamentRequest, unknown>(
  firebaseFunctions,
  "listFacebookTournament",
);
/** Lists facebook tournament. */
export const listFacebookTournament = async (input: ListFacebookTournamentRequest) => {
  /** Provides result behavior. */
  const result = await listFacebookTournamentRaw(input);
  return {...result, data: parseFacebookTournamentResponse(result.data)};
};

/** Derives and records a tournament score from an authoritative completed run. */
const recordFacebookTournamentRaw = httpsCallable<RecordFacebookTournamentRunRequest, unknown>(
  firebaseFunctions,
  "recordFacebookTournament",
);
/** Records facebook tournament. */
export const recordFacebookTournament = async (input: RecordFacebookTournamentRunRequest) => {
  /** Provides result behavior. */
  const result = await recordFacebookTournamentRaw(input);
  return {...result, data: parseFacebookTournamentRecordResponse(result.data)};
};

/** Lists an identity-free active Facebook context board. */
const listFacebookContextBoardRaw = httpsCallable<ListFacebookContextBoardRequest, unknown>(
  firebaseFunctions,
  "listFacebookContextBoard",
);
/** Lists facebook context board. */
export const listFacebookContextBoard = async (input: ListFacebookContextBoardRequest) => {
  /** Provides result behavior. */
  const result = await listFacebookContextBoardRaw(input);
  return {...result, data: parseFacebookContextBoardResponse(result.data)};
};

/** Records one authoritative completed run into an active Facebook context board. */
const recordFacebookContextRunRaw = httpsCallable<RecordFacebookContextRunRequest, unknown>(
  firebaseFunctions,
  "recordFacebookContextRun",
);
/** Records facebook context run. */
export const recordFacebookContextRun = async (input: RecordFacebookContextRunRequest) => {
  /** Provides result behavior. */
  const result = await recordFacebookContextRunRaw(input);
  return {...result, data: parseFacebookContextRecordResponse(result.data)};
};
