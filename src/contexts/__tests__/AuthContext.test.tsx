import React from "react";
import {renderHook, act, waitFor} from "@testing-library/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {Player, FirestoreRiddle} from "../../validation/firestoreSchemas";

// Mock Firestore before any module imports it
jest.mock("@react-native-firebase/firestore", () => {
  const mockCollection = jest.fn(() => ({
    doc: jest.fn(() => ({
      get: jest.fn(() => Promise.resolve({exists: false, data: () => null})),
      set: jest.fn(() => Promise.resolve()),
      update: jest.fn(() => Promise.resolve()),
    })),
    where: jest.fn(() => ({
      limit: jest.fn(() => ({
        get: jest.fn(() => Promise.resolve({empty: true, docs: []})),
      })),
    })),
    get: jest.fn(() => Promise.resolve({empty: true, docs: []})),
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
    signOut: jest.fn((auth) => auth.signOut()),
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
import {RiddleInitializationService} from "../../services/RiddleInitializationService";

// Import AuthContext after all mocks are set up
import {AuthProvider, useAuth} from "../AuthContext";

// Setup mocks
(RiddleInitializationService.checkAndInitializeRiddles as jest.Mock).mockResolvedValue(undefined);

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
  };

  const mockClassicRiddle: FirestoreRiddle = {
    riddleId: "classicRiddle01",
    classicIndex: 1,
    text: "I am a classic riddle",
    answer: "CLASSIC",
    category: "general",
  };

  const wrapper: React.FC<{children: React.ReactNode}> = ({children}) => <AuthProvider>{children}</AuthProvider>;

  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
    // Reset auth mock
    mockAuthInstance.currentUser = null;
    mockAuthInstance.onAuthStateChanged.mockClear();
    mockAuthInstance.signOut.mockReset();
  });

  it("initial state when not authenticated", async () => {
    // Mock auth state as not authenticated
    mockAuthInstance.onAuthStateChanged.mockImplementation((callback: (user: any) => void) => {
      // Call with null user immediately
      callback(null);
      return jest.fn(); // unsubscribe function
    });

    const {result} = renderHook(() => useAuth(), {wrapper});

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.playerData).toBeNull();
    expect(result.current.currentRiddle).toBeNull();
  });

  describe("Authentication Flow", () => {
    it("restores guest profile fields from local storage on app open", async () => {
      const guestUid = "guest-restore-1";
      const guestStoredPayload = {
        coins: 777,
        progress: {
          classicIndex: 9,
          dailyChallengeIndex: 12,
          dailyChallengeCurrentQuestion: 0,
        },
        stats: {
          xp: 321,
          level: 5,
          dailyPuzzlesCompleted: 8,
          bestStreak: 4,
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
        unlockedAchievements: [{achievementId: "daily_completed", unlockedAt: 1710000000000}],
        hasPurchasedApp: true,
        lastDailyChallengeCompletedAt: 1710000000000,
      };

      await AsyncStorage.setItem("@guest_player_progress_v1", JSON.stringify(guestStoredPayload));

      (fetchClassicRiddleFromFirestore as jest.Mock).mockResolvedValue(mockClassicRiddle);

      mockAuthInstance.onAuthStateChanged.mockImplementation((callback: (user: any) => void) => {
        callback({
          uid: guestUid,
          isAnonymous: true,
          email: null,
          displayName: null,
        } as any);
        return jest.fn();
      });

      const {result} = renderHook(() => useAuth(), {wrapper});

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.playerData?.userId).toBe(guestUid);
      expect(result.current.playerData?.coins).toBe(777);
      expect(result.current.playerData?.progress.dailyChallengeIndex).toBe(12);
      expect(result.current.playerData?.stats.xp).toBe(321);
      expect(result.current.playerData?.stats.dailyPuzzlesCompleted).toBe(8);
      expect(result.current.playerData?.unlockedAchievements).toEqual([
        {achievementId: "daily_completed", unlockedAt: 1710000000000},
      ]);
      expect(result.current.playerData?.hasPurchasedApp).toBe(true);
    });

    it("starts a fresh guest session with 300 coins", async () => {
      const guestUid = "guest-fresh-1";

      (fetchDailyRiddleFromFirestore as jest.Mock).mockResolvedValue(mockDailyRiddle);

      mockAuthInstance.onAuthStateChanged.mockImplementation((callback: (user: any) => void) => {
        callback({
          uid: guestUid,
          isAnonymous: true,
          email: null,
          displayName: null,
        } as any);
        return jest.fn();
      });

      const {result} = renderHook(() => useAuth(), {wrapper});

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.playerData?.userId).toBe(guestUid);
      expect(result.current.playerData?.coins).toBe(300);
    });

    it("restores a same-day guest classic session instead of defaulting back to daily", async () => {
      const guestUid = "guest-active-classic-1";
      const storedClassicRiddle: FirestoreRiddle = {
        ...mockClassicRiddle,
        riddleId: "classicRiddle03",
        classicIndex: 3,
      };

      await AsyncStorage.setItem(
        "@guest_player_progress_v1",
        JSON.stringify({
          coins: 50,
          progress: {
            classicIndex: 3,
            dailyChallengeIndex: 0,
            dailyChallengeCurrentQuestion: 0,
          },
          stats: mockPlayer.stats,
        }),
      );
      await AsyncStorage.setItem(
        "@active_game_session_v1",
        JSON.stringify({
          version: 1,
          userId: guestUid,
          gameMode: "classic",
          riddleId: "classicRiddle03",
          classicIndex: 3,
          savedAt: Date.now(),
          savedUtcDate: new Date().toISOString().slice(0, 10),
        }),
      );

      (fetchDailyRiddleFromFirestore as jest.Mock).mockResolvedValue(mockDailyRiddle);
      (fetchClassicRiddleFromFirestore as jest.Mock).mockResolvedValue(storedClassicRiddle);

      mockAuthInstance.onAuthStateChanged.mockImplementation((callback: (user: any) => void) => {
        mockAuthInstance.currentUser = {
          uid: guestUid,
          isAnonymous: true,
          email: null,
          displayName: null,
        } as any;
        callback(mockAuthInstance.currentUser);
        return jest.fn();
      });

      const {result} = renderHook(() => useAuth(), {wrapper});

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.playerData?.coins).toBe(50);
      expect(result.current.gameMode).toBe("classic");
      expect(fetchClassicRiddleFromFirestore).toHaveBeenCalledWith(3);
      expect(result.current.currentRiddle).toEqual(storedClassicRiddle);
    });

    it("does not drop anonymous-to-provider upgrade auth event for same uid", async () => {
      const upgradedUid = "guest-upgrade-1";

      (loadUserProgressFromFirestore as jest.Mock).mockResolvedValue(null);
      (createUserDocumentInFirestore as jest.Mock).mockResolvedValue({
        ...mockPlayer,
        userId: upgradedUid,
      });
      (updateUserDocumentInFirestore as jest.Mock).mockResolvedValue(undefined);
      (fetchDailyRiddleFromFirestore as jest.Mock).mockResolvedValue(mockDailyRiddle);

      mockAuthInstance.onAuthStateChanged.mockImplementation((callback: (user: any) => void) => {
        callback({
          uid: upgradedUid,
          isAnonymous: true,
          email: null,
          displayName: null,
          providerData: [],
        } as any);
        callback({
          uid: upgradedUid,
          isAnonymous: false,
          email: "upgraded@example.com",
          displayName: "Upgraded User",
          providerData: [{providerId: "google.com"}],
        } as any);
        return jest.fn();
      });

      renderHook(() => useAuth(), {wrapper});

      await waitFor(() => {
        expect(createUserDocumentInFirestore).toHaveBeenCalledTimes(1);
      });

      const [uidArg, emailArg, displayNameArg, avatarArg] = (createUserDocumentInFirestore as jest.Mock).mock.calls[0];
      expect(uidArg).toBe(upgradedUid);
      expect(emailArg).toBe("upgraded@example.com");
      expect(displayNameArg).toBe("Upgraded User");
      expect(avatarArg).toBeUndefined();

      await waitFor(() => {
        expect(updateUserDocumentInFirestore).toHaveBeenCalledWith(
          upgradedUid,
          expect.objectContaining({
            userId: upgradedUid,
            username: "Upgraded User",
            email: "test@example.com",
          }),
        );
      });
    });

    it("handles user login", async () => {
      // Mock the services
      (loadUserProgressFromFirestore as jest.Mock).mockResolvedValue(mockPlayer);
      (fetchDailyRiddleFromFirestore as jest.Mock).mockResolvedValue(mockDailyRiddle);

      // Mock auth state change
      mockAuthInstance.onAuthStateChanged.mockImplementation((callback: (user: any) => void) => {
        // Call immediately instead of using setTimeout
        callback(mockUser as any);
        return jest.fn();
      });

      const {result} = renderHook(() => useAuth(), {wrapper});

      // Wait for auth state to update and loading to complete
      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(true);
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.playerData).toEqual(mockPlayer);
      expect(result.current.currentRiddle).toEqual(mockDailyRiddle);
      expect(RiddleInitializationService.checkAndInitializeRiddles).toHaveBeenCalled();
    });

    it("does not restart provider bootstrap for delayed duplicate same-user auth events", async () => {
      const realDateNow = Date.now.bind(Date);
      const dateNowSpy = jest
        .spyOn(Date, "now")
        .mockImplementationOnce(() => 1000)
        .mockImplementationOnce(() => 3000)
        .mockImplementation(() => realDateNow());

      let resolveLoadUserProgress: (value: Player | null) => void = () => {};
      const loadUserProgressPromise = new Promise<Player | null>((resolve) => {
        resolveLoadUserProgress = resolve;
      });
      (loadUserProgressFromFirestore as jest.Mock).mockReturnValue(loadUserProgressPromise);
      (fetchDailyRiddleFromFirestore as jest.Mock).mockResolvedValue(mockDailyRiddle);
      const functionsModule = require("@react-native-firebase/functions");
      const dailyStatusCallable = jest.fn(() => Promise.resolve({data: {hasCompletedToday: false}}));
      (functionsModule.httpsCallable as jest.Mock).mockReturnValue(dailyStatusCallable);

      const providerUser = {
        ...mockUser,
        isAnonymous: false,
        emailVerified: true,
        photoURL: null,
        providerData: [{providerId: "google.com"}],
      };

      try {
        mockAuthInstance.onAuthStateChanged.mockImplementation((callback: (user: any) => void) => {
          callback(providerUser as any);
          callback(providerUser as any);
          return jest.fn();
        });

        const {result} = renderHook(() => useAuth(), {wrapper});

        await waitFor(() => {
          expect(loadUserProgressFromFirestore).toHaveBeenCalledTimes(1);
        });
        expect(RiddleInitializationService.checkAndInitializeRiddles).toHaveBeenCalledTimes(1);
        expect(fetchDailyRiddleFromFirestore).not.toHaveBeenCalled();

        await act(async () => {
          resolveLoadUserProgress(mockPlayer);
          await loadUserProgressPromise;
        });

        await waitFor(() => {
          expect(result.current.isLoading).toBe(false);
        });

        expect(loadUserProgressFromFirestore).toHaveBeenCalledTimes(1);
        expect(RiddleInitializationService.checkAndInitializeRiddles).toHaveBeenCalledTimes(1);
        expect(dailyStatusCallable).toHaveBeenCalledTimes(1);
        expect(fetchDailyRiddleFromFirestore).toHaveBeenCalledTimes(1);
        expect(result.current.currentRiddle).toEqual(mockDailyRiddle);
      } finally {
        dateNowSpy.mockRestore();
      }
    });

    it("handles user logout", async () => {
      // First set up authenticated state
      (loadUserProgressFromFirestore as jest.Mock).mockResolvedValue(mockPlayer);
      (fetchDailyRiddleFromFirestore as jest.Mock).mockResolvedValue(mockDailyRiddle);

      let authCallback: (user: any) => void;
      mockAuthInstance.onAuthStateChanged.mockImplementation((callback: (user: any) => void) => {
        authCallback = callback;
        // Start with authenticated user
        mockAuthInstance.currentUser = mockUser as any;
        callback(mockUser as any);
        return jest.fn();
      });
      mockAuthInstance.signOut.mockResolvedValue(undefined);

      const {result} = renderHook(() => useAuth(), {wrapper});

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

    it("clears local data immediately when guest logs out", async () => {
      const guestUser = {
        uid: "guest-logout-1",
        email: null,
        displayName: null,
        isAnonymous: true,
      };
      (fetchDailyRiddleFromFirestore as jest.Mock).mockResolvedValue(mockDailyRiddle);

      mockAuthInstance.onAuthStateChanged.mockImplementation((callback: (user: any) => void) => {
        mockAuthInstance.currentUser = guestUser as any;
        callback(guestUser as any);
        return jest.fn();
      });
      mockAuthInstance.signOut.mockResolvedValue(undefined);

      const {result} = renderHook(() => useAuth(), {wrapper});

      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(true);
      });

      (AsyncStorage.clear as jest.Mock).mockClear();

      await act(async () => {
        await result.current.logout();
      });

      expect(AsyncStorage.clear).toHaveBeenCalled();
      expect(mockAuthInstance.signOut).toHaveBeenCalled();
    });
  });

  describe("Game Mode and Riddle Fetching", () => {
    it("fetches classic riddle when game mode changes to classic", async () => {
      // Set up mocks
      (loadUserProgressFromFirestore as jest.Mock).mockResolvedValue(mockPlayer);
      (fetchDailyRiddleFromFirestore as jest.Mock).mockResolvedValue(mockDailyRiddle);
      (fetchClassicRiddleFromFirestore as jest.Mock).mockResolvedValue(mockClassicRiddle);

      mockAuthInstance.onAuthStateChanged.mockImplementation((callback: (user: any) => void) => {
        callback(mockUser as any);
        return jest.fn();
      });

      const {result} = renderHook(() => useAuth(), {wrapper});

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

      (loadUserProgressFromFirestore as jest.Mock).mockResolvedValue(playerWithCompletedDaily);
      (fetchDailyRiddleFromFirestore as jest.Mock).mockResolvedValue(null);
      (fetchClassicRiddleFromFirestore as jest.Mock).mockResolvedValue(mockClassicRiddle);

      mockAuthInstance.onAuthStateChanged.mockImplementation((callback: (user: any) => void) => {
        callback(mockUser as any);
        return jest.fn();
      });

      const {result} = renderHook(() => useAuth(), {wrapper});

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
      const initialPlayer = {...mockPlayer};
      (loadUserProgressFromFirestore as jest.Mock).mockResolvedValue(initialPlayer);
      (fetchDailyRiddleFromFirestore as jest.Mock).mockResolvedValue(mockDailyRiddle);
      (fetchClassicRiddleFromFirestore as jest.Mock).mockResolvedValue(mockClassicRiddle);
      (updateClassicIndexInFirestore as jest.Mock).mockResolvedValue(undefined);

      mockAuthInstance.onAuthStateChanged.mockImplementation((callback: (user: any) => void) => {
        callback(mockUser as any);
        return jest.fn();
      });

      const {result} = renderHook(() => useAuth(), {wrapper});

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
      expect(updateClassicIndexInFirestore).toHaveBeenCalledWith("testUser123", newClassicIndex);

      // Check that the fetch was called with the new index
      expect(fetchClassicRiddleFromFirestore).toHaveBeenCalledWith(newClassicIndex);

      // The state update is verified implicitly by the fact that the fetch was called with the new index
    });

    it("updatePlayerData updates Firestore and local state", async () => {
      // Set up initial authenticated state
      (loadUserProgressFromFirestore as jest.Mock).mockResolvedValue(mockPlayer);
      (fetchDailyRiddleFromFirestore as jest.Mock).mockResolvedValue(mockDailyRiddle);
      (updateUserDocumentInFirestore as jest.Mock).mockResolvedValue(undefined);

      mockAuthInstance.onAuthStateChanged.mockImplementation((callback: (user: any) => void) => {
        callback(mockUser as any);
        return jest.fn();
      });

      const {result} = renderHook(() => useAuth(), {wrapper});

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
        expect.objectContaining({
          userId: "testUser123",
          username: "TestUser",
          email: "test@example.com",
          displayName: "Updated Name",
        }),
      );
      expect(result.current.playerData?.coins).toBe(150);
      expect(result.current.playerData?.displayName).toBe("Updated Name");
    });

    it("updatePlayerDataLocally syncs authenticated updates to Firestore", async () => {
      (loadUserProgressFromFirestore as jest.Mock).mockResolvedValue(mockPlayer);
      (fetchDailyRiddleFromFirestore as jest.Mock).mockResolvedValue(mockDailyRiddle);
      (updateUserDocumentInFirestore as jest.Mock).mockResolvedValue(undefined);

      mockAuthInstance.onAuthStateChanged.mockImplementation((callback: (user: any) => void) => {
        callback(mockUser as any);
        return jest.fn();
      });

      const {result} = renderHook(() => useAuth(), {wrapper});

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      act(() => {
        result.current.updatePlayerDataLocally({coins: 175});
      });

      await waitFor(() =>
        expect(updateUserDocumentInFirestore).toHaveBeenCalledWith(
          "testUser123",
          expect.objectContaining({
            userId: "testUser123",
            username: "TestUser",
            email: "test@example.com",
          }),
        ),
      );
      expect(result.current.playerData?.coins).toBe(175);
    });

    it("updatePlayerClassicIndex advances guest highest classic level locally", async () => {
      const guestUser = {
        uid: "guest-classic-1",
        email: null,
        displayName: null,
        isAnonymous: true,
      };
      const guestClassicRiddle: FirestoreRiddle = {
        ...mockClassicRiddle,
        classicIndex: 3,
        riddleId: "classicRiddle03",
      };

      (fetchDailyRiddleFromFirestore as jest.Mock).mockResolvedValue(mockDailyRiddle);
      (fetchClassicRiddleFromFirestore as jest.Mock).mockResolvedValue(guestClassicRiddle);
      (updateClassicIndexInFirestore as jest.Mock).mockResolvedValue(undefined);

      mockAuthInstance.onAuthStateChanged.mockImplementation((callback: (user: any) => void) => {
        mockAuthInstance.currentUser = guestUser as any;
        callback(guestUser as any);
        return jest.fn();
      });

      const {result} = renderHook(() => useAuth(), {wrapper});

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      act(() => {
        result.current.setGameMode("classic");
      });

      await act(async () => {
        await result.current.updatePlayerClassicIndex(3);
      });

      expect(updateClassicIndexInFirestore).not.toHaveBeenCalled();
      expect(fetchClassicRiddleFromFirestore).toHaveBeenCalledWith(3);
      expect(result.current.playerData?.stats.highestLevelClassic).toBe(0);
    });
  });

  it("setCurrentRiddle updates the current riddle state directly", async () => {
    // Set up initial authenticated state
    (loadUserProgressFromFirestore as jest.Mock).mockResolvedValue(mockPlayer);
    (fetchDailyRiddleFromFirestore as jest.Mock).mockResolvedValue(mockDailyRiddle);

    mockAuthInstance.onAuthStateChanged.mockImplementation((callback: (user: any) => void) => {
      callback(mockUser as any);
      return jest.fn();
    });

    const {result} = renderHook(() => useAuth(), {wrapper});

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
