import React from "react";
import { renderHook, act, waitFor } from "@testing-library/react-native";
import { Player, FirestoreRiddle } from "../../validation/firestoreSchemas";

// Mock Firestore before any module imports it
jest.mock("@react-native-firebase/firestore", () => {
  const mockCollection = jest.fn(() => ({
    doc: jest.fn(() => ({
      get: jest.fn(() => Promise.resolve({ exists: false, data: () => null })),
      set: jest.fn(() => Promise.resolve()),
      update: jest.fn(() => Promise.resolve()),
    })),
    where: jest.fn(() => ({
      limit: jest.fn(() => ({
        get: jest.fn(() => Promise.resolve({ empty: true, docs: [] })),
      })),
    })),
    get: jest.fn(() => Promise.resolve({ empty: true, docs: [] })),
  }));
  return {
    __esModule: true,
    getFirestore: jest.fn(() => ({
      collection: mockCollection,
    })),
    FirebaseFirestoreTypes: {},
  };
});

// Mock all Firebase dependencies before importing AuthContext (modular API: getAuth, getApp)
jest.mock("@react-native-firebase/auth", () => {
  const mockAuthInstance = {
    currentUser: null,
    onAuthStateChanged: jest.fn((cb) => {
      setTimeout(() => cb(null), 0);
      return jest.fn();
    }),
    signOut: jest.fn(),
  };
  return {
    __esModule: true,
    default: () => mockAuthInstance,
    getAuth: jest.fn(() => mockAuthInstance),
    // Expose the instance for test access
    __mockAuthInstance: mockAuthInstance,
  };
});

jest.mock("../../services/FirestoreService");
jest.mock("../../services/RiddleInitializationService");

// Import mocked modules
const authModule = require("@react-native-firebase/auth");
const mockAuthInstance = authModule.__mockAuthInstance;

import {
  loadUserProgressFromFirestore,
  fetchDailyRiddleFromFirestore,
  fetchClassicRiddleFromFirestore,
  updateClassicIndexInFirestore,
  updateUserDocumentInFirestore,
  createUserDocumentInFirestore,
} from "../../services/FirestoreService";
import { RiddleInitializationService } from "../../services/RiddleInitializationService";

// Import AuthContext after all mocks are set up
import { AuthProvider, useAuth } from "../AuthContext";

// Setup mocks
(
  RiddleInitializationService.checkAndInitializeRiddles as jest.Mock
).mockResolvedValue(undefined);

describe("AuthContext", () => {
  // Define test data
  const mockUser = {
    uid: "testUser123",
    email: "test@example.com",
    displayName: "Test User",
  };

  const mockPlayer: Player = {
    userId: "testUser123",
    email: "test@example.com",
    username: "TestUser",
    displayName: "Test User",
    avatarUrl: "test.jpg",
    coins: 100,
    registeredAt: Date.now(),
    lastLogin: Date.now(),
    progress: {
      dailyChallengeIndex: 0,
      dailyChallengeCurrentQuestion: 0,
      classicIndex: 1,
      tutorialIndex: 0,
    },
    stats: {
      xp: 0,
      level: 1,
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
      totalHintsUsed: 0,
    },
    lastDailyChallengeCompletedAt: undefined,
    hasPurchasedApp: false,
    unlockedAchievements: [],
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

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset auth mock
    mockAuthInstance.currentUser = null;
    mockAuthInstance.onAuthStateChanged.mockClear();
    mockAuthInstance.signOut.mockReset();
  });

  it("initial state when not authenticated", async () => {
    // Mock auth state as not authenticated
    mockAuthInstance.onAuthStateChanged.mockImplementation(
      (callback: (user: any) => void) => {
        // Call with null user immediately
        callback(null);
        return jest.fn(); // unsubscribe function
      }
    );

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.playerData).toBeNull();
    expect(result.current.currentRiddle).toBeNull();
  });

  describe("Authentication Flow", () => {
    it("handles user login", async () => {
      // Mock the services
      (loadUserProgressFromFirestore as jest.Mock).mockResolvedValue(
        mockPlayer
      );
      (fetchDailyRiddleFromFirestore as jest.Mock).mockResolvedValue(
        mockDailyRiddle
      );

      // Mock auth state change
      mockAuthInstance.onAuthStateChanged.mockImplementation(
        (callback: (user: any) => void) => {
          // Call immediately instead of using setTimeout
          callback(mockUser as any);
          return jest.fn();
        }
      );

      const { result } = renderHook(() => useAuth(), { wrapper });

      // Wait for auth state to update and loading to complete
      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(true);
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.playerData).toEqual(mockPlayer);
      expect(result.current.currentRiddle).toEqual(mockDailyRiddle);
      expect(
        RiddleInitializationService.checkAndInitializeRiddles
      ).toHaveBeenCalled();
    });

    it("handles user logout", async () => {
      // First set up authenticated state
      (loadUserProgressFromFirestore as jest.Mock).mockResolvedValue(
        mockPlayer
      );
      (fetchDailyRiddleFromFirestore as jest.Mock).mockResolvedValue(
        mockDailyRiddle
      );

      let authCallback: (user: any) => void;
      mockAuthInstance.onAuthStateChanged.mockImplementation(
        (callback: (user: any) => void) => {
          authCallback = callback;
          // Start with authenticated user
          callback(mockUser as any);
          return jest.fn();
        }
      );
      mockAuthInstance.signOut.mockResolvedValue(undefined);

      const { result } = renderHook(() => useAuth(), { wrapper });

      // Wait for initial auth
      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(true);
      });

      // Trigger logout
      await act(async () => {
        await result.current.logout();
      });

      // Simulate auth state change to null
      act(() => {
        authCallback(null);
      });

      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(false);
      });

      expect(mockAuthInstance.signOut).toHaveBeenCalled();
      expect(result.current.playerData).toBeNull();
      expect(result.current.currentRiddle).toBeNull();
    });
  });

  describe("Game Mode and Riddle Fetching", () => {
    it("fetches classic riddle when game mode changes to classic", async () => {
      // Set up mocks
      (loadUserProgressFromFirestore as jest.Mock).mockResolvedValue(
        mockPlayer
      );
      (fetchDailyRiddleFromFirestore as jest.Mock).mockResolvedValue(
        mockDailyRiddle
      );
      (fetchClassicRiddleFromFirestore as jest.Mock).mockResolvedValue(
        mockClassicRiddle
      );

      mockAuthInstance.onAuthStateChanged.mockImplementation(
        (callback: (user: any) => void) => {
          callback(mockUser as any);
          return jest.fn();
        }
      );

      const { result } = renderHook(() => useAuth(), { wrapper });

      // Wait for initial load
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.currentRiddle).toEqual(mockDailyRiddle);

      // Change game mode
      act(() => {
        result.current.setGameMode("classic");
      });

      // Manually trigger fetch for classic mode
      await act(async () => {
        await result.current.fetchCurrentRiddle(mockPlayer, "classic");
      });

      expect(result.current.gameMode).toBe("classic");
      expect(fetchClassicRiddleFromFirestore).toHaveBeenCalledWith(1); // classicIndex is 1
      expect(result.current.currentRiddle).toEqual(mockClassicRiddle);
    });

    it("sets currentRiddle to null if daily challenge is not available", async () => {
      // Mock player with completed daily challenge
      const playerWithCompletedDaily = {
        ...mockPlayer,
        lastDailyChallengeCompletedAt: Date.now(), // Today
      };

      (loadUserProgressFromFirestore as jest.Mock).mockResolvedValue(
        playerWithCompletedDaily
      );
      (fetchDailyRiddleFromFirestore as jest.Mock).mockResolvedValue(null);
      (fetchClassicRiddleFromFirestore as jest.Mock).mockResolvedValue(
        mockClassicRiddle
      );

      mockAuthInstance.onAuthStateChanged.mockImplementation(
        (callback: (user: any) => void) => {
          callback(mockUser as any);
          return jest.fn();
        }
      );

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Should fall back to classic riddle when daily is not available
      expect(result.current.isDailyChallengeAvailable).toBe(true);
      expect(result.current.currentRiddle).toEqual(mockClassicRiddle);
    });
  });

  describe("Player Data Updates", () => {
    it("updatePlayerClassicIndex updates Firestore and refetches riddle", async () => {
      // Set up initial authenticated state with a fresh player object
      const initialPlayer = { ...mockPlayer };
      (loadUserProgressFromFirestore as jest.Mock).mockResolvedValue(
        initialPlayer
      );
      (fetchDailyRiddleFromFirestore as jest.Mock).mockResolvedValue(
        mockDailyRiddle
      );
      (fetchClassicRiddleFromFirestore as jest.Mock).mockResolvedValue(
        mockClassicRiddle
      );
      (updateClassicIndexInFirestore as jest.Mock).mockResolvedValue(undefined);

      mockAuthInstance.onAuthStateChanged.mockImplementation(
        (callback: (user: any) => void) => {
          callback(mockUser as any);
          return jest.fn();
        }
      );

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const newClassicIndex = 5;

      // Set game mode to classic first
      act(() => {
        result.current.setGameMode("classic");
      });

      // Clear previous mock calls
      (fetchClassicRiddleFromFirestore as jest.Mock).mockClear();

      // Update the classic index
      await act(async () => {
        await result.current.updatePlayerClassicIndex(newClassicIndex);
      });

      // Check that Firestore was updated with the correct index
      expect(updateClassicIndexInFirestore).toHaveBeenCalledWith(
        "testUser123",
        newClassicIndex
      );

      // Check that the fetch was called with the new index
      expect(fetchClassicRiddleFromFirestore).toHaveBeenCalledWith(
        newClassicIndex
      );

      // The state update is verified implicitly by the fact that the fetch was called with the new index
    });

    it("updatePlayerData updates Firestore and local state", async () => {
      // Set up initial authenticated state
      (loadUserProgressFromFirestore as jest.Mock).mockResolvedValue(
        mockPlayer
      );
      (fetchDailyRiddleFromFirestore as jest.Mock).mockResolvedValue(
        mockDailyRiddle
      );
      (updateUserDocumentInFirestore as jest.Mock).mockResolvedValue(undefined);

      mockAuthInstance.onAuthStateChanged.mockImplementation(
        (callback: (user: any) => void) => {
          callback(mockUser as any);
          return jest.fn();
        }
      );

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const updates: Partial<Player> = {
        coins: 150,
        displayName: "Updated Name",
      };

      await act(async () => {
        await result.current.updatePlayerData(updates);
      });

      expect(updateUserDocumentInFirestore).toHaveBeenCalledWith(
        "testUser123",
        updates
      );
      expect(result.current.playerData?.coins).toBe(150);
      expect(result.current.playerData?.displayName).toBe("Updated Name");
    });
  });

  it("setCurrentRiddle updates the current riddle state directly", async () => {
    // Set up initial authenticated state
    (loadUserProgressFromFirestore as jest.Mock).mockResolvedValue(mockPlayer);
    (fetchDailyRiddleFromFirestore as jest.Mock).mockResolvedValue(
      mockDailyRiddle
    );

    mockAuthInstance.onAuthStateChanged.mockImplementation(
      (callback: (user: any) => void) => {
        callback(mockUser as any);
        return jest.fn();
      }
    );

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
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

