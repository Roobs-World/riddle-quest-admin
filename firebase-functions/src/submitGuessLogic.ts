import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import {onCall, CallableRequest, HttpsError} from "firebase-functions/v2/https";
import {getUser, updateUserCoins, updateUserStats, getRiddle} from "./firestoreService";
import type {Player, PlayerStats, PlayerStatsUpdate, PlayerProgressUpdate} from "./validation/firestoreSchemas";
import type {FeedbackItem} from "./validation/requestSchemas";

// Type for feedback
export type FeedbackColor = "green" | "yellow" | "red";

interface SubmitGuessRequestData {
  guess: string;
  riddleId: string;
  gameMode: "challenge" | "classic";
  attempts: number;
}

interface SubmitGuessAuthContext {
  uid: string;
  // Potentially include other auth details if your core logic needs them,
  // e.g., token for further verification, although uid is usually sufficient.
}

interface SubmitGuessResponseData {
  feedback: FeedbackItem[];
  isCorrect: boolean;
  correctAnswer?: string;
  coinsEarned?: number;
}

const MAX_ATTEMPTS_CLASSIC = 5;
const MAX_ATTEMPTS_CHALLENGE = 5;

// Core logic, now separated and exportable for testing
export async function handleGuessLogic(
  data: SubmitGuessRequestData,
  auth: SubmitGuessAuthContext,
): Promise<SubmitGuessResponseData> {
  const userId = auth.uid;
  const {guess, riddleId, gameMode, attempts} = data;

  if (!guess || !riddleId || !gameMode || attempts === undefined) {
    throw new HttpsError("invalid-argument", "Missing required parameters: guess, riddleId, gameMode, attempts.");
  }

  try {
    const riddle = await getRiddle(riddleId);
    console.log("handleGuessLogic - Fetched riddle:", JSON.stringify(riddle));

    if (!riddle || !riddle.answer) {
      const errorMessage = !riddle
        ? `Riddle with ID ${riddleId} not found.`
        : `Answer not found for riddle ${riddleId}.`;
      functions.logger.error(errorMessage);
      throw new HttpsError("not-found", errorMessage);
    }

    const correctAnswerClean = riddle.answer.toLowerCase();
    const guessClean = guess.toLowerCase();

    const feedback: FeedbackItem[] = [];
    const answerChars = correctAnswerClean.split("");
    const guessChars = guessClean.split("");
    const answerCharCounts: {[key: string]: number} = {};

    for (const char of answerChars) {
      answerCharCounts[char] = (answerCharCounts[char] || 0) + 1;
    }

    // Initialize feedback with all red
    for (let i = 0; i < guessChars.length; i++) {
      feedback.push({letter: guessChars[i], status: "red"});
    }

    // First pass for green
    for (let i = 0; i < guessChars.length; i++) {
      if (i < answerChars.length && guessChars[i] === answerChars[i]) {
        feedback[i] = {letter: guessChars[i], status: "green"};
        if (answerCharCounts[guessChars[i]]) {
          // check before decrementing
          answerCharCounts[guessChars[i]]--;
        }
      }
    }

    // Second pass for yellow
    for (let i = 0; i < guessChars.length; i++) {
      if (feedback[i].status === "green") continue;
      if (i < answerChars.length && answerChars.includes(guessChars[i]) && answerCharCounts[guessChars[i]] > 0) {
        feedback[i] = {letter: guessChars[i], status: "yellow"};
        if (answerCharCounts[guessChars[i]]) {
          // check before decrementing
          answerCharCounts[guessChars[i]]--;
        }
      }
    }

    // Ensure feedback length matches guess length if guess is longer than answer
    // (This scenario might imply an issue with guess validation before this function, but good to handle)
    while (feedback.length < guessChars.length) {
      // This case should ideally not be hit if guess length is validated earlier
      feedback.push({letter: guessChars[feedback.length], status: "red"});
    }
    if (feedback.length > guessChars.length) {
      feedback.splice(guessChars.length);
    }

    const isCorrect = guessClean === correctAnswerClean;
    let coinsEarned = 0;
    const maxAttempts = gameMode === "challenge" ? MAX_ATTEMPTS_CHALLENGE : MAX_ATTEMPTS_CLASSIC;
    const gameOver = isCorrect || attempts >= maxAttempts;

    const user = await getUser(userId);
    if (!user) {
      throw new HttpsError("internal", "User not found while trying to update stats.");
    }

    const currentStats: PlayerStats = user.stats || {
      gamesPlayed: 0,
      wins: 0,
      winStreak: 0,
      bestStreak: 0,
      totalWordsGuessed: 0, // Ensure this is part of PlayerStats if used
      winRate: 0,
      averageGuesses: 0,
      totalScore: 0, // Ensure this is part of PlayerStats if used
      highestLevelClassic: 0, // Ensure this is part of PlayerStats if used
      challengeWins: 0,
      totalWins: 0,
      totalGuessesInWins: 0,
    };

    const statsUpdate: PlayerStatsUpdate = {
      gamesPlayed: admin.firestore.FieldValue.increment(1),
    };

    // Increment totalWordsGuessed if it's a stat you track with every guess
    // statsUpdate.totalWordsGuessed = admin.firestore.FieldValue.increment(1);

    if (isCorrect) {
      statsUpdate.wins = admin.firestore.FieldValue.increment(1);
      statsUpdate.totalWins = admin.firestore.FieldValue.increment(1);
      statsUpdate.winStreak = admin.firestore.FieldValue.increment(1);
      statsUpdate.totalGuessesInWins = admin.firestore.FieldValue.increment(attempts);

      const playerProfileUpdate: Partial<Player> = {};

      if (gameMode === "challenge") {
        statsUpdate.challengeWins = admin.firestore.FieldValue.increment(1);
        coinsEarned = Math.max(0, 20 - (attempts - 1) * 5);
        playerProfileUpdate.lastDailyChallengeCompletedAt =
          admin.firestore.FieldValue.serverTimestamp() as admin.firestore.FieldValue;
      } else {
        coinsEarned = 10;
      }
      await updateUserCoins(userId, coinsEarned);

      if (Object.keys(playerProfileUpdate).length > 0) {
        await admin.firestore().collection("users").doc(userId).update(playerProfileUpdate);
      }

      if ((currentStats.winStreak || 0) + 1 > (currentStats.bestStreak || 0)) {
        statsUpdate.bestStreak = (currentStats.winStreak || 0) + 1;
      }
    } else if (gameOver) {
      statsUpdate.winStreak = 0;
    }

    const newTotalWins = (currentStats.totalWins || 0) + (isCorrect ? 1 : 0);
    const newGamesPlayed = (currentStats.gamesPlayed || 0) + 1;
    const newTotalGuessesInWins = (currentStats.totalGuessesInWins || 0) + (isCorrect ? attempts : 0);

    if (newTotalWins > 0 && newTotalGuessesInWins > 0) {
      // averageGuesses only if wins
      statsUpdate.averageGuesses = parseFloat((newTotalGuessesInWins / newTotalWins).toFixed(2));
    } else if (isCorrect && newTotalWins > 0) {
      // First win, newTotalGuessesInWins is just attempts
      statsUpdate.averageGuesses = parseFloat((attempts / newTotalWins).toFixed(2));
    }

    if (newGamesPlayed > 0) {
      statsUpdate.winRate = parseFloat(((newTotalWins / newGamesPlayed) * 100).toFixed(2));
    }

    await updateUserStats(userId, statsUpdate);

    if (isCorrect && gameMode === "classic") {
      const userRef = admin.firestore().collection("users").doc(userId);
      await userRef.update({
        "progress.classicIndex": admin.firestore.FieldValue.increment(1),
      });
      console.log(`User ${userId} solved Classic riddle ${riddleId}. Incremented classicIndex.`);
    }

    return {
      feedback,
      isCorrect,
      correctAnswer: gameOver ? riddle.answer : undefined,
      coinsEarned: isCorrect ? coinsEarned : 0,
    };
  } catch (error) {
    console.error("Error in handleGuessLogic:", error);
    if (error instanceof HttpsError) {
      throw error;
    }
    // It's good practice to throw HttpsError from the core logic too if it's meant to be directly callable by other cloud functions
    // or if you want consistent error types.
    throw new HttpsError("internal", "An unexpected error occurred in handleGuessLogic.", error);
  }
}

// The onCall wrapper remains, now calling the core logic
export const submitGuess = onCall(
  {region: "us-central1"},
  async (request: CallableRequest<SubmitGuessRequestData>): Promise<SubmitGuessResponseData> => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "The function must be called while authenticated.");
    }
    // Pass request.data and a simplified auth context to the core logic function
    // The return type of handleGuessLogic matches SubmitGuessResponseData which expects FeedbackItem[] for feedback
    return handleGuessLogic(request.data, {uid: request.auth.uid});
  },
);
