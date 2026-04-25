/**
 * @fileoverview Auth bootstrap helpers for guest profiles and provider email resolution.
 */
import { AccessToken } from "react-native-fbsdk-next";
import type { FirebaseAuthTypes } from "@react-native-firebase/auth";
import { Player } from "../../validation/firestoreSchemas";
import { captureException } from "../../utils/sentry";
import { logger } from "../../utils/logger";
import { INITIAL_COINS } from "@/constants/game";

/**
 * Resolves initial gameplay mode after auth bootstrap.
 *
 * @param hasCompletedToday Whether daily challenge was already completed.
 * @returns `"classic"` when completed; otherwise `"daily"`.
 */
export const resolveInitialGameMode = (
  hasCompletedToday: boolean
): "classic" | "daily" => (hasCompletedToday ? "classic" : "daily");

/**
 * Builds the default in-memory player profile for anonymous users.
 *
 * @param uid Anonymous Firebase user ID.
 * @returns Minimal guest `Player` profile.
 */
export const createGuestPlayer = (uid: string): Player => ({
  userId: uid,
  email: `guest_${uid}@guest.Riddle Quest.com`,
  username: "Guest",
  coins: INITIAL_COINS,
  progress: {
    classicIndex: 1,
    dailyChallengeIndex: 0,
    dailyChallengeCurrentQuestion: 0,
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
  unlockedAchievements: [],
  hasPurchasedApp: false,
});

/**
 * True when a player profile represents guest mode.
 */
export const isGuestPlayer = (
  player: Pick<Player, "email" | "username"> | null | undefined
): boolean => {
  const email =
    typeof player?.email === "string" ? player.email.trim().toLowerCase() : "";
  const username =
    typeof player?.username === "string"
      ? player.username.trim().toLowerCase()
      : "";

  if (email.endsWith("@guest.Riddle Quest.com")) {
    return true;
  }

  if (email !== "") {
    return false;
  }

  return username === "guest";
};

/**
 * Resolves a user's email across direct auth payload, providerData fallback,
 * and Facebook Graph API fallback.
 *
 * @param user Firebase auth user.
 * @returns Resolved email address.
 * @throws When no email can be resolved.
 */
export const resolveUserEmail = async (
  user: FirebaseAuthTypes.User
): Promise<string> => {
  const userEmail = user.email ?? "";

  if (userEmail.trim() !== "") {
    return userEmail;
  }

  const providerWithEmail = user.providerData?.find(
    (provider) => provider.email && provider.email.trim() !== ""
  );

  if (providerWithEmail?.email) {
    logger.debug(
      `Found email in providerData (${providerWithEmail.providerId}):`,
      providerWithEmail.email
    );
    return providerWithEmail.email;
  }

  const facebookProvider = user.providerData?.find(
    (provider) => provider.providerId === "facebook.com"
  );

  if (facebookProvider) {
    try {
      const currentToken = await AccessToken.getCurrentAccessToken();
      if (!currentToken) {
        throw new Error(
          "No Facebook access token available for Graph API call"
        );
      }

      const graphResponse = await fetch(
        `https://graph.facebook.com/me?fields=id,name,email&access_token=${currentToken.accessToken}`
      );

      if (!graphResponse.ok) {
        throw new Error(
          `Facebook Graph API error: ${graphResponse.status} ${graphResponse.statusText}`
        );
      }

      const userData = await graphResponse.json();
      if (userData.email) {
        logger.debug("Successfully retrieved email from Facebook Graph API:", userData.email);
        return userData.email;
      }
    } catch (graphError) {
      logger.error("Facebook Graph API call failed:", graphError);
      captureException(graphError);
    }
  }

  throw new Error(
    "Email is required but not provided by authentication provider. Please ensure email permission is granted."
  );
};

const isValidAvatarUrl = (value: string | null | undefined): value is string => {
  if (!value || value.trim() === "") return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
};

/**
 * Resolves provider avatar URL from Firebase auth user and provider data.
 *
 * @param user Firebase auth user.
 * @returns A valid avatar URL when available.
 */
export const resolveProviderAvatarUrl = async (
  user: FirebaseAuthTypes.User
): Promise<string | undefined> => {
  const hasFacebookProvider = Boolean(
    user.providerData?.some((provider) => provider.providerId === "facebook.com")
  );

  if (hasFacebookProvider) {
    try {
      const currentToken = await AccessToken.getCurrentAccessToken();
      if (currentToken?.accessToken) {
        const graphResponse = await fetch(
          `https://graph.facebook.com/me/picture?type=large&redirect=false&access_token=${currentToken.accessToken}`
        );

        if (!graphResponse.ok) {
          throw new Error(
            `Facebook avatar Graph API error: ${graphResponse.status} ${graphResponse.statusText}`
          );
        }

        const avatarData = await graphResponse.json();
        const graphAvatarUrl = avatarData?.data?.url as string | undefined;
        const isSilhouette = avatarData?.data?.is_silhouette === true;

        if (!isSilhouette && isValidAvatarUrl(graphAvatarUrl)) {
          return graphAvatarUrl;
        }
      }
    } catch (graphError) {
      logger.warn("Unable to fetch Facebook avatar from Graph API:", graphError);
      captureException(graphError);
    }
  }

  const hasGoogleProvider = Boolean(
    user.providerData?.some((provider) => provider.providerId === "google.com")
  );

  if (hasGoogleProvider && isValidAvatarUrl(user.photoURL)) {
    return user.photoURL;
  }

  const providerAvatar = user.providerData?.find((provider) => {
    if (provider.providerId !== "google.com") {
      return false;
    }
    return isValidAvatarUrl(provider.photoURL);
  })?.photoURL;

  if (isValidAvatarUrl(providerAvatar)) {
    return providerAvatar;
  }

  return undefined;
};

/**
 * Resolves a provider-sourced username for upgraded accounts.
 *
 * Priority:
 * 1) `user.displayName`
 * 2) first providerData displayName
 *
 * Returns `undefined` when no provider username is available.
 */
export const resolveProviderUsername = (
  user: FirebaseAuthTypes.User
): string | undefined => {
  const displayName =
    typeof user.displayName === "string" ? user.displayName.trim() : "";
  if (displayName !== "") {
    return displayName;
  }

  const providerDisplayName = user.providerData?.find(
    (provider) =>
      typeof provider.displayName === "string" &&
      provider.displayName.trim() !== ""
  )?.displayName;

  if (typeof providerDisplayName === "string") {
    const normalized = providerDisplayName.trim();
    return normalized !== "" ? normalized : undefined;
  }

  return undefined;
};
