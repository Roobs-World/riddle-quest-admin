import * as admin from "firebase-admin";

/**
 * Retrieves the IDs of existing riddles for a user.
 * @param {string} userId - The ID of the user.
 * @returns {Promise<Set<string>>} A set of existing riddle IDs.
 */
async function getExistingRiddleIds(userId: string): Promise<Set<string>> {
  const db = admin.firestore();
  const userRef = db.collection("users").doc(userId);
  const userDoc = await userRef.get();

  if (userDoc.exists) {
    const userData = userDoc.data();
    const existingRiddles = userData?.riddles || [];
    // Assuming each riddle object has a unique 'id' property
    // If not, you might need a different way to identify uniqueness
    return new Set(
      existingRiddles
        .map((riddle: any) => riddle.id)
        .filter((id: string | undefined) => id !== undefined)
    );
  } else {
    return new Set();
  }
}

/**
 * Generates a new unique riddle.
 * @param {Set<string>} existingRiddleIds - A set of IDs of existing riddles.
 * @param {number} maxAttempts - Maximum attempts to generate a unique riddle.
 * @returns {Promise<{ riddle: string, answer: string, id: string } | null>} A new unique riddle or null if unable to generate.
 */
async function generateNewUniqueRiddle(
  existingRiddleIds: Set<string>,
  maxAttempts = 100
): Promise<{ riddle: string; answer: string; id: string } | null> {
  // This is a placeholder. Replace with actual riddle generation logic
  // that ensures uniqueness based on existingRiddleIds.
  for (let i = 0; i < maxAttempts; i++) {
    const potentialRiddle = {
      riddle: `Riddle ${Math.random()}`,
      answer: `Answer ${Math.random()}`,
      id: `riddle_${Date.now()}_${i}`,
    };
    if (!existingRiddleIds.has(potentialRiddle.id)) {
      return potentialRiddle;
    }
  }
  return null; // Unable to generate a unique riddle
}

/**
 * Appends generated riddles to the user's document.
 * @param {string} userId - The ID of the user.
 * @param {Array<{ riddle: string, answer: string }>} newRiddles - The riddles to append.
 */
async function appendRiddlesToUserDocument(
  userId: string,
  newRiddles: Array<{ riddle: string; answer: string }>
): Promise<void> {
  const db = admin.firestore();
  const userRef = db.collection("users").doc(userId);

  try {
    const userDoc = await userRef.get();
    if (userDoc.exists) {
      const userData = userDoc.data();
      const currentRiddles = userData?.riddles || [];
      const updatedRiddles = [...currentRiddles, ...newRiddles];
      await userRef.update({ riddles: updatedRiddles });
    } else {
      // If the user document doesn't exist, create it with the new riddles.
      await userRef.set({ riddles: newRiddles });
    }
  } catch (error) {
    console.error("Error appending riddles to user document:", error);
    throw error; // Re-throw the error after logging
  }
}

/**
 * Generates new unique riddles for a user and appends them to their document.
 * @param {string} userId - The ID of the user.
 * @param {number} count - The number of riddles to generate.
 */
export async function generateAndAppendRiddles(
  userId: string,
  count: number
): Promise<void> {
  try {
    const existingRiddleIds = await getExistingRiddleIds(userId);
    const newRiddles: Array<{ riddle: string; answer: string; id: string }> =
      []; // Include 'id' in type

    for (let i = 0; i < count; i++) {
      const newRiddle = await generateNewUniqueRiddle(existingRiddleIds);
      if (newRiddle) {
        newRiddles.push(newRiddle);
        // Add the newly generated riddle's ID to the set to ensure uniqueness within the batch
        existingRiddleIds.add(newRiddle.id);
      } else {
        console.warn(
          `Could not generate a unique riddle after multiple attempts for user ${userId}.`
        );
        break; // Stop if we can't generate enough unique riddles
      }
    }

    if (newRiddles.length > 0) {
      await appendRiddlesToUserDocument(userId, newRiddles);
      console.log(
        `Successfully generated and appended ${newRiddles.length} riddles for user ${userId}.`
      );
    } else {
      console.log(`No new riddles generated for user ${userId}.`);
    }
  } catch (error) {
    console.error("Error in generateAndAppendRiddles:", error);
    throw error; // Re-throw the error after logging
  }
}
