/* istanbul ignore file */
/**
 * @fileoverview Thin authentication provider — orchestration lives in `application/auth/`.
 */
import React, {createContext, useContext} from "react";
import {Player, FirestoreRiddle} from "../validation/firestoreSchemas";
import {useAuthProviderController} from "../application/auth/useAuthProviderController";
import type {GameMode} from "../application/auth/authTypes";

export type {GameMode};

interface AuthContextType {
  isAuthenticated: boolean;
  playerData: Player | null;
  isLoading: boolean;
  isRiddlesInitializing: boolean;
  currentRiddle: FirestoreRiddle | null;
  isDailyChallengeAvailable: boolean | undefined;
  gameMode: GameMode;
  setGameMode: (mode: GameMode) => void;
  pendingStreakBreak: {previousStreak: number} | null;
  consumePendingStreakBreak: () => void;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  updatePlayerClassicIndex: (newIndex: number) => Promise<void>;
  updatePlayerData: (updates: Partial<Player>) => Promise<void>;
  updatePlayerDataLocally: (updates: Partial<Player>, options?: {syncToFirestore?: boolean}) => void;
  setCurrentRiddle: React.Dispatch<React.SetStateAction<FirestoreRiddle | null>>;
  fetchCurrentRiddle: (player: Player | null, mode: GameMode, completedDailyOverride?: boolean) => Promise<void>;
}

type AuthSessionContextType = Pick<AuthContextType, "isAuthenticated" | "isLoading" | "login" | "logout">;
type PlayerContextType = Pick<
  AuthContextType,
  | "playerData"
  | "updatePlayerClassicIndex"
  | "updatePlayerData"
  | "updatePlayerDataLocally"
  | "pendingStreakBreak"
  | "consumePendingStreakBreak"
>;
type RiddleContextType = Pick<
  AuthContextType,
  | "currentRiddle"
  | "setCurrentRiddle"
  | "fetchCurrentRiddle"
  | "isDailyChallengeAvailable"
  | "gameMode"
  | "setGameMode"
  | "isRiddlesInitializing"
>;

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const AuthSessionContext = createContext<AuthSessionContextType | undefined>(undefined);
const PlayerContext = createContext<PlayerContextType | undefined>(undefined);
const RiddleContext = createContext<RiddleContextType | undefined>(undefined);

export const AuthProvider: React.FC<{children: React.ReactNode}> = ({children}) => {
  const {sessionValue, playerValue, riddleValue, contextValue} = useAuthProviderController();

  return (
    <AuthSessionContext.Provider value={sessionValue}>
      <PlayerContext.Provider value={playerValue}>
        <RiddleContext.Provider value={riddleValue}>
          <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
        </RiddleContext.Provider>
      </PlayerContext.Provider>
    </AuthSessionContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export const useAuthSession = () => {
  const context = useContext(AuthSessionContext);
  if (context === undefined) {
    throw new Error("useAuthSession must be used within an AuthProvider");
  }
  return context;
};

export const usePlayer = () => {
  const context = useContext(PlayerContext);
  if (context === undefined) {
    throw new Error("usePlayer must be used within an AuthProvider");
  }
  return context;
};

export const useRiddleState = () => {
  const context = useContext(RiddleContext);
  if (context === undefined) {
    throw new Error("useRiddleState must be used within an AuthProvider");
  }
  return context;
};
