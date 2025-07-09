import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import {onCall, HttpsError} from "firebase-functions/v2/https";
import {
  getUser,
  updateUserCoins,
  updateUserStats,
  getRiddleByGameMode,
  ensureUserDocumentComplete,
} from "./firestoreService";
import {PlayerStats, PlayerStatsUpdate, PlayerSchema} from "./validation/firestoreSchemas";
import type {FeedbackItem} from "./validation/requestSchemas";
import {generateAndAppendRiddles, initializeRiddleDatabaseIfEmpty} from "./riddleGeneration";

// Define a type for potential top-level updates to the Player document
type PlayerTopLevelUpdate = {
  lastDailyChallengeCompletedAt?: number | admin.firestore.FieldValue;
  // Add other top-level fields here if they are updated similarly
};

// Type for feedback
export type FeedbackColor = "green" | "yellow" | "red";

interface SubmitGuessRequestData {
  guess: string;
  riddleId: string;
  gameMode: "challenge" | "classic" | "tutorial";
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
  const {guess, riddleId, gameMode, attempts} = data;
  const userId = auth.uid;

  if (!guess || !riddleId || !gameMode || attempts === undefined) {
    throw new HttpsError("invalid-argument", "Missing required parameters: guess, riddleId, gameMode, attempts.");
  }

  try {
    // Ensure user document has all required stats and progress fields (defensive programming)
    await ensureUserDocumentComplete(userId);

    // Initialize database if empty (for new deployments)
    await initializeRiddleDatabaseIfEmpty();

    // Get riddle from the appropriate collection based on game mode
    const riddle = await getRiddleByGameMode(riddleId, gameMode);
    console.log("handleGuessLogic - Fetched riddle:", JSON.stringify(riddle));

    if (!riddle || !riddle.answer) {
      const errorMessage = !riddle
        ? `${gameMode} riddle with ID ${riddleId} not found.`
        : `Answer not found for ${gameMode} riddle ${riddleId}.`;
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
    const maxAttempts =
      gameMode === "challenge" ? MAX_ATTEMPTS_CHALLENGE : gameMode === "tutorial" ? 3 : MAX_ATTEMPTS_CLASSIC; // Tutorial has 3 attempts
    const gameOver = isCorrect || attempts >= maxAttempts;

    const user = await getUser(userId);
    if (!user) {
      throw new HttpsError("internal", "User not found while trying to update stats.");
    }

    const currentStats: PlayerStats = user.stats || {
      dailyPuzzlesCompleted: 0,
      bestStreak: 0,
      totalWordsGuessed: 0,
      winRate: 0,
      averageGuesses: 0,
      totalScore: 0,
      highestLevelClassic: 0,
      gamesPlayed: 0,
      wins: 0,
      challengeWins: 0,
      winStreak: 0,
      totalWins: 0,
      totalGuessesInWins: 0,
    };

    const statsUpdate: PlayerStatsUpdate = {
      gamesPlayed: admin.firestore.FieldValue.increment(1),
      totalWordsGuessed: admin.firestore.FieldValue.increment(1), // Track each guess attempt
    };

    if (isCorrect) {
      statsUpdate.wins = admin.firestore.FieldValue.increment(1);
      statsUpdate.totalWins = admin.firestore.FieldValue.increment(1);
      statsUpdate.winStreak = admin.firestore.FieldValue.increment(1);
      statsUpdate.totalGuessesInWins = admin.firestore.FieldValue.increment(attempts);

      const playerProfileUpdate: PlayerTopLevelUpdate = {};

      if (gameMode === "challenge") {
        statsUpdate.challengeWins = admin.firestore.FieldValue.increment(1);
        statsUpdate.dailyPuzzlesCompleted = admin.firestore.FieldValue.increment(1); // Track daily puzzles completed
        coinsEarned = Math.max(0, 20 - (attempts - 1) * 5);
        playerProfileUpdate.lastDailyChallengeCompletedAt = admin.firestore.FieldValue.serverTimestamp();

        // Update daily challenge progress index
        await admin
          .firestore()
          .collection("users")
          .doc(userId)
          .update({
            "progress.dailyChallengeIndex": admin.firestore.FieldValue.increment(1),
          });
        console.log(`User ${userId} completed daily challenge. Incremented dailyChallengeIndex.`);
      } else if (gameMode === "tutorial") {
        coinsEarned = 5; // Tutorial mode gives small coin reward

        // Update tutorial progress index
        await admin
          .firestore()
          .collection("users")
          .doc(userId)
          .update({
            "progress.tutorialIndex": admin.firestore.FieldValue.increment(1),
          });
        console.log(`User ${userId} completed tutorial level. Incremented tutorialIndex.`);
      } else {
        coinsEarned = 10; // Classic mode
      }

      // Calculate and add score based on performance (fewer attempts = higher score)
      const baseScore = gameMode === "challenge" ? 100 : gameMode === "tutorial" ? 25 : 50; // Tutorial has lower base score
      const attemptsBonus = Math.max(0, (maxAttempts - attempts + 1) * 10);
      const scoreEarned = baseScore + attemptsBonus;
      statsUpdate.totalScore = admin.firestore.FieldValue.increment(scoreEarned);
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

      // Update highestLevelClassic stat to match the new progress
      const newClassicLevel = (user.progress?.classicIndex || 0) + 1;
      if (newClassicLevel > (currentStats.highestLevelClassic || 0)) {
        await updateUserStats(userId, {
          highestLevelClassic: newClassicLevel,
        });
      }

      // Check if new riddles need to be generated
      const updatedUserDoc = await userRef.get();
      const updatedPlayerData = PlayerSchema.parse(updatedUserDoc.data());
      const currentClassicIndex = updatedPlayerData.progress?.classicIndex || 0;

      try {
        // Count total classic riddles in Firestore
        const classicRiddlesSnapshot = await admin
          .firestore()
          .collection("riddles")
          .where("classicIndex", ">=", 0)
          .get();

        const totalClassicRiddles = classicRiddlesSnapshot.size;

        console.log(
          `User ${userId} currentClassicIndex: ${currentClassicIndex}, totalClassicRiddles: ${totalClassicRiddles}`,
        );

        if (totalClassicRiddles - currentClassicIndex <= 10) {
          console.log(`User ${userId} has <= 10 classic riddles remaining. Triggering generation of 25 new riddles.`);
          try {
            await generateAndAppendRiddles(25);
            console.log("Successfully triggered generation of 25 new classic riddles.");
          } catch (error) {
            console.error("Error triggering generation of new classic riddles:", error);
            // Decide if this error should be surfaced to the client or just logged
          }
        }
      } catch (error) {
        console.error("Error checking classic riddle count:", error);
      }
    }

    return {
      feedback,
      isCorrect,
      correctAnswer: gameOver || isCorrect ? riddle.answer : undefined,
      coinsEarned,
    };
  } catch (error: unknown) {
    console.error("Error in handleGuessLogic:", error);
    if (error instanceof HttpsError) {
      throw error;
    }
    throw new HttpsError("internal", "An unexpected error occurred in handleGuessLogic.", error);
  }
}

// This is the callable function wrapper
export const submitGuess = onCall<SubmitGuessRequestData, Promise<SubmitGuessResponseData>>(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "The function must be called while authenticated.");
  }
  // Validate data if necessary (using Zod or similar)
  // e.g., const validatedData = SubmitGuessRequestDataSchema.parse(request.data);
  return handleGuessLogic(request.data, request.auth);
});
