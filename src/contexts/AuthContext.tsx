import React, { createContext, useState, useEffect, useContext } from "react";
import {
  loadUserProgressFromFirestore,
  fetchDailyRiddleFromFirestore,
  fetchClassicRiddleFromFirestore,
  updateClassicIndexInFirestore,
  updateUserDocumentInFirestore,
} from "../services/FirestoreService";
import { Player, FirestoreRiddle } from "../validation/firestoreSchemas";
import auth from "@react-native-firebase/auth";
// Assuming you have an AuthService with login/logout methods
// import { AuthService } from "../services/AuthService";

export type GameMode = "daily" | "classic" | "challenge"; // Export GameMode type and include "challenge"

interface AuthContextType {
  isAuthenticated: boolean;
  playerData: Player | null;
  isLoading: boolean;
  currentRiddle: FirestoreRiddle | null; // Use a single state for the current riddle regardless of mode
  isDailyChallengeAvailable: boolean;
  gameMode: GameMode; // Add state for current game mode
  setGameMode: (mode: GameMode) => void; // Add function to change game mode
  login: () => Promise<void>;
  logout: () => Promise<void>;
  // Removed updatePlayerCoins as coin updates are now handled by backend functions
  // updatePlayerCoins: (newCoins: number) => Promise<void>;
  updatePlayerClassicIndex: (newIndex: number) => Promise<void>;
  updatePlayerData: (updates: Partial<Player>) => Promise<void>;
  // Add setCurrentRiddle to the interface
  setCurrentRiddle: React.Dispatch<
    React.SetStateAction<FirestoreRiddle | null>
  >; // Expose the state setter
  fetchCurrentRiddle: (player: Player | null, mode: GameMode) => Promise<void>; // Expose fetchCurrentRiddle
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [playerData, setPlayerData] = useState<Player | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentRiddle, setCurrentRiddle] = useState<FirestoreRiddle | null>(
    null
  ); // Use single state for current riddle
  const [isDailyChallengeAvailable, setIsDailyChallengeAvailable] =
    useState(false); // Add state and initialize
  const [gameMode, setGameMode] = useState<GameMode>("daily"); // Add state for game mode, default to daily

  // Helper function to check if the last completed date was today in UTC
  const isTodayUTC = (date?: Date | null): boolean => {
    if (!date) return true; // If no date is set, the challenge is available
    const todayUtc = new Date();
    todayUtc.setUTCHours(0, 0, 0, 0);
    const lastCompletedUtc = new Date(date);
    lastCompletedUtc.setUTCHours(0, 0, 0, 0);
    return todayUtc.getTime() > lastCompletedUtc.getTime();
  };

  // Function to fetch riddle based on current game mode and player data
  const fetchCurrentRiddle = async (player: Player | null, mode: GameMode) => {
    if (!player) {
      setCurrentRiddle(null);
      setIsDailyChallengeAvailable(false);
      return;
    }

    let fetchedRiddle: FirestoreRiddle | null = null;

    // Check daily challenge availability
    // The lastDailyChallengeCompletedAt is stored as a number timestamp, convert to Date for isTodayUTC
    const lastCompletedDate = player.lastDailyChallengeCompletedAt
      ? new Date(player.lastDailyChallengeCompletedAt)
      : null;
    const dailyAvailable = isTodayUTC(lastCompletedDate);
    setIsDailyChallengeAvailable(dailyAvailable); // Update availability state

    if (mode === "daily") {
      if (dailyAvailable) {
        // If daily challenge is available and index is defined, fetch it
        // Access dailyChallengeIndex from the nested progress object
        if (player.progress?.dailyChallengeIndex !== undefined) {
          fetchedRiddle = await fetchDailyRiddleFromFirestore(
            player.progress.dailyChallengeIndex
          );
        } else {
          // Handle case where dailyIndex is undefined for daily mode (shouldn't happen if user data is initialized correctly)
          console.warn("Daily challenge index is undefined for daily mode.");
          // Optionally set an error state or load a default riddle/message
        }
      } else {
        // If daily challenge is not available, no riddle is fetched for daily mode
        console.log("Daily challenge already completed for today.");
        fetchedRiddle = null; // Explicitly set to null
      }
    } else if (mode === "classic") {
      // For classic mode, fetch the riddle based on classicIndex
      // Access classicIndex from the nested progress object
      if (player.progress?.classicIndex !== undefined) {
        fetchedRiddle = await fetchClassicRiddleFromFirestore(
          player.progress.classicIndex
        );
      } else {
        // Handle case where classicIndex is undefined for classic mode
        console.warn("Classic index is undefined for classic mode.");
        // Optionally set an error state or load a default riddle/message
      }
    } // Add other modes here as needed

    setCurrentRiddle(fetchedRiddle);
  };

  // Handle user state changes using Firebase auth listener
  useEffect(() => {
    const subscriber = auth().onAuthStateChanged(async (user) => {
      setIsLoading(true);
      if (user) {
        // User is signed in
        setIsAuthenticated(true);
        try {
          // Load user data from Firestore
          const data = await loadUserProgressFromFirestore(user.uid);
          // setPlayerData(data); // Use the loaded data which should conform to the updated Player type

          // Use the loaded 'data' directly for setting state and fetching riddle
          setPlayerData(data); // Set loaded data

          // Fetch riddle based on loaded player data and current game mode
          // Pass the fetched player data to fetchCurrentRiddle
          await fetchCurrentRiddle(data, gameMode); // Use fetched 'data' here
        } catch (error) {
          console.error("Error loading user data or riddle:", error);
          setPlayerData(null);
          setCurrentRiddle(null);
          setIsDailyChallengeAvailable(false);
        }
      } else {
        // User is signed out
        setIsAuthenticated(false);
        setPlayerData(null);
        setCurrentRiddle(null);
        setIsDailyChallengeAvailable(false);
      }
      setIsLoading(false);
    });

    // Unsubscribe on unmount
    return subscriber;
  }, [gameMode]); // Add gameMode to dependency array to re-run effect when mode changes

  // Function to update player classic index and context state
  const updatePlayerClassicIndex = async (newIndex: number): Promise<void> => {
    if (!playerData?.userId) return; // Ensure user is logged in
    try {
      await updateClassicIndexInFirestore(playerData.userId, newIndex);
      // Update local state to reflect the change immediately and re-fetch riddle
      setPlayerData((prevData: Player | null) =>
        // Correctly update the nested classicIndex property
        prevData
          ? {
              ...prevData,
              progress: { ...prevData.progress, classicIndex: newIndex },
            }
          : null
      );
      console.log(
        "AuthContext: Player classic index updated locally and in Firestore."
      );
      // After updating the index, re-fetch the riddle for the new level
      if (playerData)
        await fetchCurrentRiddle(
          // Pass a new object with the updated classicIndex in progress
          {
            ...playerData,
            progress: { ...playerData.progress, classicIndex: newIndex },
          },
          "classic"
        ); // Use updated data for fetch
    } catch (error) {
      console.error("AuthContext: Error updating player classic index:", error);
      throw error; // Rethrow
    }
  };

  // New function to update partial player data in Firestore and context
  const updatePlayerData = async (updates: Partial<Player>): Promise<void> => {
    if (!playerData?.userId) {
      console.warn("Attempted to update player data without a userId.");
      return;
    }
    try {
      await updateUserDocumentInFirestore(playerData.userId, updates); // Call the Firestore service function
      // Update local state to reflect the change immediately by merging updates
      setPlayerData((prevData: Player | null) =>
        // Merge updates, handling nested objects if necessary (Partial<Player> should handle this)
        prevData ? { ...prevData, ...updates } : null
      );
      console.log("AuthContext: Player data updated locally and in Firestore.");
    } catch (error) {
      console.error("AuthContext: Error updating player data:", error);
      throw error; // Rethrow
    }
  };

  // Placeholder login function (keep for now, onAuthStateChanged listener handles state)
  const login = async () => {
    // The onAuthStateChanged listener will handle the state update including riddle fetching
    // We can potentially add a re-fetch logic here if needed after a manual login trigger
  };

  // Placeholder logout function (keep for now, onAuthStateChanged listener handles state)
  const logout = async () => {
    setIsLoading(true);
    try {
      await auth().signOut(); // Trigger Firebase sign out
      // The onAuthStateChanged listener will handle the state update
    } catch (error) {
      console.error("Error during logout:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        playerData,
        isLoading,
        currentRiddle,
        isDailyChallengeAvailable,
        gameMode,
        setGameMode,
        login,
        logout,
        updatePlayerClassicIndex,
        updatePlayerData,
        setCurrentRiddle,
        fetchCurrentRiddle,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
