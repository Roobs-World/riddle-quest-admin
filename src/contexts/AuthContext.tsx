import React, {
  createContext,
  useState,
  useEffect,
  useContext,
  useCallback,
} from "react";
import {
  loadUserProgressFromFirestore,
  fetchDailyRiddleFromFirestore,
  fetchClassicRiddleFromFirestore,
  updateClassicIndexInFirestore,
  updateUserDocumentInFirestore,
  createUserDocumentInFirestore,
} from "../services/FirestoreService";
import { Player, FirestoreRiddle } from "../validation/firestoreSchemas";
import auth from "@react-native-firebase/auth";
import { RiddleInitializationService } from "../services/RiddleInitializationService";
import { AccessToken } from "react-native-fbsdk-next";
// Assuming you have an AuthService with login/logout methods
// import { AuthService } from "../services/AuthService";

export type GameMode = "daily" | "classic" | "challenge"; // Export GameMode type and include "challenge"

interface AuthContextType {
  isAuthenticated: boolean;
  playerData: Player | null;
  isLoading: boolean;
  isRiddlesInitializing: boolean; // Add this to track riddle initialization
  currentRiddle: FirestoreRiddle | null; // Use a single state for the current riddle regardless of mode
  isDailyChallengeAvailable: boolean | undefined;
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
  const [isDailyChallengeAvailable, setIsDailyChallengeAvailable] = useState<
    boolean | undefined
  >(undefined); // Initialize as undefined to indicate not yet determined
  const [gameMode, setGameMode] = useState<GameMode>("daily"); // Add state for game mode, default to daily
  const [isRiddlesInitializing, setIsRiddlesInitializing] = useState(false); // Track riddle initialization

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
  const fetchCurrentRiddle = useCallback(
    async (player: Player | null, mode: GameMode) => {
      if (!player) {
        setCurrentRiddle(null);
        setIsDailyChallengeAvailable(undefined); // Set to undefined when no player data
        return;
      }

      let fetchedRiddle: FirestoreRiddle | null = null;
      let attemptCount = 0;
      const maxAttempts = 20; // Try for up to 1 minute (20 * 3 seconds)

      // Check daily challenge availability
      // The lastDailyChallengeCompletedAt is stored as a number timestamp, convert to Date for isTodayUTC
      const lastCompletedDate = player.lastDailyChallengeCompletedAt
        ? new Date(player.lastDailyChallengeCompletedAt)
        : null;
      const dailyAvailable = isTodayUTC(lastCompletedDate);
      setIsDailyChallengeAvailable(dailyAvailable); // Update availability state

      // Helper function to attempt riddle fetch
      const attemptFetchRiddle = async (): Promise<FirestoreRiddle | null> => {
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
              console.warn(
                "Daily challenge index is undefined for daily mode."
              );
            }
          }

          // If no daily riddle available (completed or failed to fetch), fall back to classic mode
          if (!fetchedRiddle) {
            console.log(
              "No daily riddle available, falling back to classic mode riddle."
            );
            if (player.progress?.classicIndex !== undefined) {
              fetchedRiddle = await fetchClassicRiddleFromFirestore(
                player.progress.classicIndex
              );
            } else {
              console.warn(
                "Classic index is undefined, cannot load fallback riddle."
              );
            }
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
          }
        } else if (mode === "challenge") {
          // For challenge mode, try to fetch daily riddle first
          if (dailyAvailable) {
            if (player.progress?.dailyChallengeIndex !== undefined) {
              fetchedRiddle = await fetchDailyRiddleFromFirestore(
                player.progress.dailyChallengeIndex
              );
            }
          }

          // If no daily riddle available, fall back to classic mode
          if (!fetchedRiddle) {
            console.log(
              "No daily challenge riddle available, falling back to classic mode riddle."
            );
            if (player.progress?.classicIndex !== undefined) {
              fetchedRiddle = await fetchClassicRiddleFromFirestore(
                player.progress.classicIndex
              );
            }
          }
        }

        return fetchedRiddle;
      };

      // First attempt to fetch riddle
      fetchedRiddle = await attemptFetchRiddle();

      // If no riddle found and riddles might still be initializing, poll for riddles
      if (!fetchedRiddle) {
        const initStatus =
          RiddleInitializationService.getInitializationStatus();

        // Only poll if initialization hasn't failed
        if (!initStatus.initializationFailed) {
          console.log(
            "📊 No riddle found, checking if riddles are still being generated..."
          );
          setIsRiddlesInitializing(true);

          // Poll for riddles
          while (!fetchedRiddle && attemptCount < maxAttempts) {
            attemptCount++;
            console.log(
              `🔄 Polling for riddles... Attempt ${attemptCount}/${maxAttempts}`
            );

            // Wait 3 seconds before next attempt
            await new Promise((resolve) => setTimeout(resolve, 3000));

            // Try fetching again
            fetchedRiddle = await attemptFetchRiddle();

            // Check if initialization completed or failed
            const currentStatus =
              RiddleInitializationService.getInitializationStatus();
            if (
              currentStatus.initializationFailed ||
              currentStatus.hasInitialized
            ) {
              break;
            }
          }

          setIsRiddlesInitializing(false);
        }
      }

      setCurrentRiddle(fetchedRiddle);

      if (!fetchedRiddle) {
        console.error("❌ Failed to load any riddle after all attempts");
      }
    },
    [setIsRiddlesInitializing]
  );

  // Effect to set up Firebase auth state listener
  useEffect(() => {
    console.log("🔧 Setting up Firebase auth listener...");

    const subscriber = auth().onAuthStateChanged(async (user) => {
      console.log(
        "🔔 Firebase auth state changed. User:",
        user ? user.uid : "null"
      );

      if (user) {
        // User is signed in
        console.log("🔐 User authenticated, loading user data...");
        setIsAuthenticated(true);

        try {
          // Check and initialize riddles if needed (do this early so riddles are ready)
          console.log("🎲 Checking riddle database...");
          setIsRiddlesInitializing(true);
          await RiddleInitializationService.checkAndInitializeRiddles();
          setIsRiddlesInitializing(false);

          // Load user data from Firestore
          console.log("🔍 Checking for existing user document...");
          let data = await loadUserProgressFromFirestore(user.uid);

          // If no user document exists, create one (new user signup)
          if (!data) {
            console.log(
              "🆕 No user document found, creating new user document for:",
              user.uid
            );
            console.log(
              "📧 Firebase user email:",
              user.email || "(null/empty)"
            );
            console.log("📧 Email type:", typeof user.email);
            console.log("📧 Email length:", user.email ? user.email.length : 0);
            console.log(
              "👤 Using display name:",
              user.displayName || "undefined"
            );
            console.log("🔍 Full user object debug:", {
              uid: user.uid,
              email: user.email,
              emailVerified: user.emailVerified,
              displayName: user.displayName,
              photoURL: user.photoURL,
              providerData: user.providerData.map((provider) => ({
                providerId: provider.providerId,
                uid: provider.uid,
                email: provider.email,
                displayName: provider.displayName,
              })),
            });

            try {
              let userEmail = user.email;

              // Check if email is null, undefined, or empty string
              if (!userEmail || userEmail.trim() === "") {
                console.log(
                  "⚠️ Firebase user has no email, checking if this is a Facebook user..."
                );

                // Check if this is a Facebook login by looking at provider data
                const facebookProvider = user.providerData?.find(
                  (provider) => provider.providerId === "facebook.com"
                );

                if (facebookProvider) {
                  console.log(
                    "📘 Detected Facebook login, attempting direct Facebook Graph API call..."
                  );

                  try {
                    // Get current Facebook access token
                    const currentToken =
                      await AccessToken.getCurrentAccessToken();
                    if (!currentToken) {
                      throw new Error(
                        "No Facebook access token available for Graph API call"
                      );
                    }

                    console.log(
                      "🌐 Making Facebook Graph API request for user email..."
                    );

                    // Call Facebook Graph API to get user info including email
                    const graphResponse = await fetch(
                      `https://graph.facebook.com/me?fields=id,name,email&access_token=${currentToken.accessToken}`
                    );

                    if (!graphResponse.ok) {
                      throw new Error(
                        `Facebook Graph API error: ${graphResponse.status} ${graphResponse.statusText}`
                      );
                    }

                    const userData = await graphResponse.json();
                    console.log("📊 Facebook Graph API response:", {
                      id: userData.id,
                      name: userData.name,
                      email: userData.email || "(not provided)",
                      hasEmail: !!userData.email,
                    });

                    if (userData.email) {
                      console.log(
                        "✅ Successfully retrieved email from Facebook Graph API:",
                        userData.email
                      );
                      userEmail = userData.email;
                    } else {
                      console.warn(
                        "⚠️ Facebook Graph API also didn't provide email address"
                      );
                      console.warn("🔍 This could mean:");
                      console.warn(
                        "  - User's Facebook account has no email address"
                      );
                      console.warn("  - Email is not verified on Facebook");
                      console.warn(
                        "  - Facebook privacy settings prevent email sharing"
                      );
                      console.warn(
                        "  - App needs to be in Live mode for email permission"
                      );
                      console.warn(
                        "  - Email permission was not actually granted despite UI showing it"
                      );
                    }
                  } catch (graphError) {
                    console.error(
                      "❌ Facebook Graph API call failed:",
                      graphError
                    );
                  }
                }

                // Final check - if we still don't have an email, throw error
                if (!userEmail || userEmail.trim() === "") {
                  throw new Error(
                    "Email is required but not provided by authentication provider. Please ensure email permission is granted."
                  );
                }
              }

              data = await createUserDocumentInFirestore(
                user.uid,
                userEmail!, // We've validated userEmail is not null above
                user.displayName || undefined
              );
              console.log("✅ New user document created successfully");
              console.log(
                "📄 Created user data:",
                JSON.stringify(data, null, 2)
              );
            } catch (createError) {
              console.error("❌ Error creating user document:", createError);
              throw createError;
            }
          } else {
            console.log("✅ Existing user document found");
          }

          console.log("📊 User data loaded successfully:", !!data);
          setPlayerData(data);

          // Fetch riddle based on loaded player data and current game mode
          console.log("🧩 Loading riddle for game mode:", gameMode);
          await fetchCurrentRiddle(data, gameMode);
          console.log("✅ Riddle loading completed");

          // Only set loading to false after everything is complete
          console.log(
            "🏁 Setting isLoading to false - initialization complete"
          );
          setIsLoading(false);
        } catch (error) {
          console.error("❌ Error loading user data or riddle:", error);
          console.error("❌ Error details:", JSON.stringify(error, null, 2));
          setPlayerData(null);
          setCurrentRiddle(null);
          setIsDailyChallengeAvailable(undefined);
          // Set loading to false even on error so user isn't stuck
          setIsLoading(false);
        }
      } else {
        // User is signed out - no need to load riddles
        console.log("🚪 User signed out, clearing data");
        setIsAuthenticated(false);
        setPlayerData(null);
        setCurrentRiddle(null);
        setIsDailyChallengeAvailable(undefined);
        console.log("🏁 Setting isLoading to false");
        setIsLoading(false);
      }

      console.log("✅ Auth state processing completed");
    });

    console.log("🎯 Firebase auth listener set up successfully");

    // Unsubscribe on unmount
    return subscriber;
  }, [gameMode, fetchCurrentRiddle]);

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
        isRiddlesInitializing,
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
