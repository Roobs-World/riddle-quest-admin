import React from "react";
import { renderHook, act } from "@testing-library/react-native";
import { AuthProvider, useAuth, GameMode } from "../AuthContext";

// Explicitly mock @react-native-firebase/app at the top of the file
jest.mock("@react-native-firebase/app", () => ({
  __esModule: true,
  default: {
    app: jest.fn(() => ({
      name: "[DEFAULT]",
      options: {},
    })),
    apps: [
      {
        name: "[DEFAULT]",
        options: {},
      },
    ],
    SDK_VERSION: "mockSDKVersion",
    initializeApp: jest.fn().mockReturnValue({
      name: "[DEFAULT]",
      options: {},
    }),
    NativeModules: {
      RNFBAppModule: {
        // This is the crucial part
        NATIVE_FIREBASE_APPS: JSON.stringify([
          { name: "[DEFAULT]", options: {} },
        ]),
        FIREBASE_RAW_JSON: "{}",
        addListener: jest.fn(),
        removeListeners: jest.fn(),
        // Add other constants/methods from RNFBAppModule if needed
      },
    },
  },
}));

// Firebase Auth will be mocked by jest.setup.js
import auth, { type FirebaseAuthTypes } from "@react-native-firebase/auth";
import * as FirestoreService from "../../services/FirestoreService";
import { Player, FirestoreRiddle } from "../../validation/firestoreSchemas";

// Define mock user locally for this test suite
const mockFirebaseUser = {
  uid: "testUser123",
  email: "test@example.com",
  displayName: "Test User",
} as FirebaseAuthTypes.User;

// Mock FirestoreService
jest.mock("../../services/FirestoreService", () => ({
  loadUserProgressFromFirestore: jest.fn(),
  fetchDailyRiddleFromFirestore: jest.fn(),
  fetchClassicRiddleFromFirestore: jest.fn(),
  updateLastDailyChallengeCompletedAt: jest.fn().mockResolvedValue(undefined),
  updateClassicIndexInFirestore: jest.fn().mockResolvedValue(undefined),
  updateUserDocumentInFirestore: jest.fn().mockResolvedValue(undefined),
}));

const mockPlayer: Player = {
  userId: "testUser123",
  email: "test@example.com",
  username: "TestUser",
  displayName: "Test User",
  avatarUrl: "test.jpg",
  xp: 1000,
  coins: 100,
  registeredAt: Date.now(),
  lastLogin: Date.now(),
  progress: {
    dailyChallengeIndex: 0,
    classicIndex: 1,
    tutorialIndex: 0,
  },
  stats: {
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
  },
  lastDailyChallengeCompletedAt: undefined,
  hasPurchasedApp: false,
};

const mockDailyRiddle: FirestoreRiddle = {
  riddleId: "dailyRiddle01",
  dailyIndex: 0,
  text: "I am a daily riddle",
  answer: "DAILY",
  category: "general",
  difficulty: "medium",
};

const mockClassicRiddle: FirestoreRiddle = {
  riddleId: "classicRiddle01",
  classicIndex: 1,
  text: "I am a classic riddle",
  answer: "CLASSIC",
  category: "general",
  difficulty: "easy",
};

const wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <AuthProvider>{children}</AuthProvider>
);

describe("AuthContext", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset auth mock to default (logged out)
    // The global mock in jest.setup.js should handle currentUser state.
    // (auth().currentUser as any) = null; // This can be managed by the global mock's state if needed.

    // Setup default mock implementations for FirestoreService
    (
      FirestoreService.loadUserProgressFromFirestore as jest.Mock
    ).mockResolvedValue(mockPlayer);
    (
      FirestoreService.fetchDailyRiddleFromFirestore as jest.Mock
    ).mockResolvedValue(mockDailyRiddle);
    (
      FirestoreService.fetchClassicRiddleFromFirestore as jest.Mock
    ).mockResolvedValue(mockClassicRiddle);
  });

  it("initial state when not authenticated", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.playerData).toBeNull();
    expect(result.current.currentRiddle).toBeNull();
    // isLoading is true initially, then AuthProvider's useEffect runs onAuthStateChanged.
    // We need to simulate that callback.
    expect(result.current.isLoading).toBe(true);

    await act(async () => {
      ((auth() as any).__clearMockUser as jest.Mock)();
    });
    expect(result.current.isLoading).toBe(false);
  });

  describe("Authentication Flow", () => {
    it("handles user login", async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });
      // Initial state (loading)
      expect(result.current.isLoading).toBe(true);
      // Simulate initial onAuthStateChanged with no user
      await act(async () => {
        ((auth() as any).__clearMockUser as jest.Mock)();
      });
      expect(result.current.isLoading).toBe(false);
      expect(result.current.isAuthenticated).toBe(false);

      // Simulate login
      (
        FirestoreService.loadUserProgressFromFirestore as jest.Mock
      ).mockResolvedValueOnce(mockPlayer);
      await act(async () => {
        ((auth() as any).__setMockUser as jest.Mock)(mockFirebaseUser);
      });

      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.playerData).toEqual(mockPlayer);
      expect(
        FirestoreService.loadUserProgressFromFirestore
      ).toHaveBeenCalledWith(mockFirebaseUser.uid);
      expect(
        FirestoreService.fetchDailyRiddleFromFirestore
      ).toHaveBeenCalledWith(mockPlayer.progress?.dailyChallengeIndex);
      expect(result.current.currentRiddle).toEqual(mockDailyRiddle);
      expect(result.current.isDailyChallengeAvailable).toBe(true); // Based on mockPlayer.lastDailyChallengeCompletedAt being undefined
      expect(result.current.isLoading).toBe(false);
    });

    it("handles user logout", async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });
      // First, simulate login
      (
        FirestoreService.loadUserProgressFromFirestore as jest.Mock
      ).mockResolvedValueOnce(mockPlayer);
      await act(async () => {
        ((auth() as any).__setMockUser as jest.Mock)(mockFirebaseUser);
      });
      expect(result.current.isAuthenticated).toBe(true); // This should now pass

      // Then, simulate logout
      await act(async () => {
        await result.current.logout(); // This calls auth().signOut() which internally calls __clearMockUser or similar logic
        // The signOut mock itself should trigger onAuthStateChanged listeners with null.
        // If direct control is needed AFTER signOut's own effects:
        // ((auth() as any).__clearMockUser as jest.Mock)(); // This might be redundant if signOut mock is comprehensive
      });

      expect(auth().signOut).toHaveBeenCalled();
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.playerData).toBeNull();
      expect(result.current.currentRiddle).toBeNull();
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe("Game Mode and Riddle Fetching", () => {
    it("fetches classic riddle when game mode changes to classic", async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });
      // Login first
      (
        FirestoreService.loadUserProgressFromFirestore as jest.Mock
      ).mockResolvedValueOnce(mockPlayer);
      await act(async () => {
        ((auth() as any).__setMockUser as jest.Mock)(mockFirebaseUser);
      });

      expect(result.current.currentRiddle).toEqual(mockDailyRiddle);

      await act(async () => {
        result.current.setGameMode("classic");
      });

      // Wait for useEffect triggered by gameMode change to complete
      await act(async () => {
        await Promise.resolve(); // Flush microtask queue once for the state update to propagate
        await Promise.resolve(); // Flush again for any subsequent promises from the effect
      });

      expect(result.current.gameMode).toBe("classic");
      expect(
        FirestoreService.fetchClassicRiddleFromFirestore
      ).toHaveBeenCalledWith(mockPlayer.progress?.classicIndex);
      expect(result.current.currentRiddle).toEqual(mockClassicRiddle);
    });

    it("sets currentRiddle to null if daily challenge is not available", async () => {
      const playerWithCompletedDaily: Player = {
        ...mockPlayer,
        lastDailyChallengeCompletedAt: new Date().getTime(), // Completed today
      };
      (
        FirestoreService.loadUserProgressFromFirestore as jest.Mock
      ).mockResolvedValue(playerWithCompletedDaily);

      const { result } = renderHook(() => useAuth(), { wrapper });
      await act(async () => {
        ((auth() as any).__setMockUser as jest.Mock)(mockFirebaseUser);
      });

      expect(result.current.isDailyChallengeAvailable).toBe(false);
      expect(result.current.currentRiddle).toBeNull();
      expect(
        FirestoreService.fetchDailyRiddleFromFirestore
      ).not.toHaveBeenCalled();
    });
  });

  describe("Player Data Updates", () => {
    it("updatePlayerClassicIndex updates Firestore, local state, and refetches riddle", async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });
      await act(async () => {
        // Login
        ((auth() as any).__setMockUser as jest.Mock)(mockFirebaseUser);
      });

      const newClassicIndex = 5;
      const newClassicRiddle = {
        ...mockClassicRiddle,
        classicIndex: newClassicIndex,
        riddleId: "classic005",
      };
      (
        FirestoreService.fetchClassicRiddleFromFirestore as jest.Mock
      ).mockResolvedValueOnce(newClassicRiddle);

      await act(async () => {
        await result.current.updatePlayerClassicIndex(newClassicIndex);
      });

      expect(
        FirestoreService.updateClassicIndexInFirestore
      ).toHaveBeenCalledWith(mockPlayer.userId, newClassicIndex);
      expect(result.current.playerData?.progress?.classicIndex).toBe(
        newClassicIndex
      );
      expect(
        FirestoreService.fetchClassicRiddleFromFirestore
      ).toHaveBeenCalledWith(newClassicIndex);
      expect(result.current.currentRiddle).toEqual(newClassicRiddle);
    });

    it("updatePlayerData updates Firestore and local state", async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });
      await act(async () => {
        // Login
        ((auth() as any).__setMockUser as jest.Mock)(mockFirebaseUser);
      });

      const updates: Partial<Player> = {
        coins: 150,
        displayName: "Updated Name",
      };
      await act(async () => {
        await result.current.updatePlayerData(updates);
      });

      expect(
        FirestoreService.updateUserDocumentInFirestore
      ).toHaveBeenCalledWith(mockPlayer.userId, updates);
      expect(result.current.playerData?.coins).toBe(150);
      expect(result.current.playerData?.displayName).toBe("Updated Name");
    });
  });

  it("setCurrentRiddle updates the current riddle state directly", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await act(async () => {
      // Login to initialize playerData
      ((auth() as any).__setMockUser as jest.Mock)(mockFirebaseUser);
    });

    const newRiddle: FirestoreRiddle = {
      ...mockClassicRiddle,
      riddleId: "newRiddle101",
      text: "A brand new riddle",
    };

    act(() => {
      result.current.setCurrentRiddle(newRiddle);
    });

    expect(result.current.currentRiddle).toEqual(newRiddle);
  });
});
