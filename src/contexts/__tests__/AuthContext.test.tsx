import React from "react";
import {renderHook} from "@testing-library/react-native";
import type {FirestoreRiddle, Player} from "../../validation/firestoreSchemas";
import {AuthProvider, useAuth, useAuthSession, usePlayer, useRiddleState} from "../AuthContext";
import {useAuthProviderController} from "../../application/auth/useAuthProviderController";

jest.mock("../../validation/firestoreSchemas", () => ({
  __esModule: true,
  Player: {},
  FirestoreRiddle: {},
}));

jest.mock("../../application/auth/useAuthProviderController", () => ({
  useAuthProviderController: jest.fn(),
}));

const mockedUseAuthProviderController = useAuthProviderController as jest.MockedFunction<
  typeof useAuthProviderController
>;

const mockLogin = jest.fn();
const mockLogout = jest.fn();
const mockUpdatePlayerClassicIndex = jest.fn();
const mockUpdatePlayerData = jest.fn();
const mockUpdatePlayerDataLocally = jest.fn();
const mockConsumePendingStreakBreak = jest.fn();
const mockSetCurrentRiddle = jest.fn();
const mockFetchCurrentRiddle = jest.fn();
const mockSetGameMode = jest.fn();

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

const controllerState = {
  sessionValue: {
    isAuthenticated: true,
    isLoading: false,
    login: mockLogin,
    logout: mockLogout,
  },
  playerValue: {
    playerData: mockPlayer,
    updatePlayerClassicIndex: mockUpdatePlayerClassicIndex,
    updatePlayerData: mockUpdatePlayerData,
    updatePlayerDataLocally: mockUpdatePlayerDataLocally,
    pendingStreakBreak: null,
    consumePendingStreakBreak: mockConsumePendingStreakBreak,
  },
  riddleValue: {
    currentRiddle: mockDailyRiddle,
    setCurrentRiddle: mockSetCurrentRiddle,
    fetchCurrentRiddle: mockFetchCurrentRiddle,
    isDailyChallengeAvailable: true,
    gameMode: "daily" as const,
    setGameMode: mockSetGameMode,
    isRiddlesInitializing: false,
  },
};

const mergedContextValue = {
  ...controllerState.sessionValue,
  ...controllerState.playerValue,
  ...controllerState.riddleValue,
};

const wrapper: React.FC<{children: React.ReactNode}> = ({children}) => <AuthProvider>{children}</AuthProvider>;

describe("AuthContext", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedUseAuthProviderController.mockReturnValue({
      sessionValue: {...controllerState.sessionValue},
      playerValue: {...controllerState.playerValue},
      riddleValue: {...controllerState.riddleValue},
      contextValue: {...mergedContextValue},
    });
  });

  it("throws when useAuthSession is used outside AuthProvider", () => {
    expect(() => renderHook(() => useAuthSession())).toThrow("useAuthSession must be used within an AuthProvider");
  });

  it("throws when usePlayer is used outside AuthProvider", () => {
    expect(() => renderHook(() => usePlayer())).toThrow("usePlayer must be used within an AuthProvider");
  });

  it("throws when useRiddleState is used outside AuthProvider", () => {
    expect(() => renderHook(() => useRiddleState())).toThrow("useRiddleState must be used within an AuthProvider");
  });

  it("exposes the auth session slice through useAuthSession", () => {
    const {result} = renderHook(() => useAuthSession(), {wrapper});

    expect(result.current).toEqual(controllerState.sessionValue);
  });

  it("exposes the player slice through usePlayer", () => {
    const {result} = renderHook(() => usePlayer(), {wrapper});

    expect(result.current).toEqual(controllerState.playerValue);
  });

  it("exposes the riddle slice through useRiddleState", () => {
    const {result} = renderHook(() => useRiddleState(), {wrapper});

    expect(result.current).toEqual(controllerState.riddleValue);
  });

  it("keeps useAuth as the merged compatibility hook", () => {
    const {result} = renderHook(() => useAuth(), {wrapper});

    expect(result.current).toEqual(mergedContextValue);
    expect(result.current.login).toBe(mockLogin);
    expect(result.current.logout).toBe(mockLogout);
    expect(result.current.playerData).toBe(mockPlayer);
    expect(result.current.currentRiddle).toBe(mockDailyRiddle);
  });
});
