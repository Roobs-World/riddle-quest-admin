import {getAuth} from "@react-native-firebase/auth";
import {getApp} from "@react-native-firebase/app";
import {Player} from "../../validation/firestoreSchemas";

export const GUEST_PROGRESS_STORAGE_KEY = "@guest_player_progress_v1";

export const sanitizePlayerUpdates = (updates: Partial<Player>): Partial<Player> =>
  Object.fromEntries(Object.entries(updates).filter(([, value]) => value !== undefined)) as Partial<Player>;

export const isAnonymousAuthSession = (): boolean => getAuth(getApp()).currentUser?.isAnonymous === true;

export const buildFirestoreUserUpdates = (basePlayer: Player, updates: Partial<Player>): Partial<Player> => {
  const sanitizedUpdates = sanitizePlayerUpdates(updates);
  const resolvedUsername =
    typeof sanitizedUpdates.username === "string" && sanitizedUpdates.username.trim() !== ""
      ? sanitizedUpdates.username
      : basePlayer.username;
  const resolvedEmail =
    typeof sanitizedUpdates.email === "string" && sanitizedUpdates.email.trim() !== ""
      ? sanitizedUpdates.email
      : basePlayer.email;
  const clientEditableUpdates = {...sanitizedUpdates};
  delete clientEditableUpdates.coins;
  delete clientEditableUpdates.progress;
  delete clientEditableUpdates.stats;
  delete clientEditableUpdates.hasPurchasedApp;
  delete clientEditableUpdates.unlockedAchievements;
  delete clientEditableUpdates.lastDailyChallengeCompletedAt;
  delete clientEditableUpdates.preferredLanguage;

  return {
    ...clientEditableUpdates,
    userId: basePlayer.userId,
    username: resolvedUsername,
    email: resolvedEmail,
  };
};
