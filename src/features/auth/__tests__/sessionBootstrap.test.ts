/**
 * @fileoverview Comprehensive unit tests for sessionBootstrap module.
 * Tests all exported functions with full branch coverage.
 */

// Mock the Facebook SDK before any imports
jest.mock("react-native-fbsdk-next", () => ({
  AccessToken: {
    getCurrentAccessToken: jest.fn(),
  },
}));

// Mock Sentry to prevent actual error reporting
jest.mock("../../../utils/sentry", () => ({
  captureException: jest.fn(),
}));

// Mock logger to prevent console noise and track calls
jest.mock("../../../utils/logger", () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock global fetch for Facebook Graph API tests
const mockFetch = jest.fn();
global.fetch = mockFetch;

import { AccessToken } from "react-native-fbsdk-next";
import { captureException } from "../../../utils/sentry";
import { logger } from "../../../utils/logger";
import {
  createGuestPlayer,
  isGuestPlayer,
  resolveInitialGameMode,
  resolveLaunchGameMode,
  resolveProviderAvatarUrl,
  resolveProviderUsername,
  resolveUserEmail,
} from "../sessionBootstrap";
import type { FirebaseAuthTypes } from "@react-native-firebase/auth";

describe("sessionBootstrap", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockReset();
  });

  describe("resolveInitialGameMode", () => {
    it("returns 'classic' when hasCompletedToday is true", () => {
      const result = resolveInitialGameMode(true);
      expect(result).toBe("classic");
    });

    it("returns 'daily' when hasCompletedToday is false", () => {
      const result = resolveInitialGameMode(false);
      expect(result).toBe("daily");
    });

    it("handles truthy values correctly", () => {
      // TypeScript enforces boolean, but test runtime behavior
      expect(resolveInitialGameMode(true)).toBe("classic");
    });

    it("handles falsy values correctly", () => {
      expect(resolveInitialGameMode(false)).toBe("daily");
    });
  });

  describe("resolveLaunchGameMode", () => {
    it("uses the default mode when no same-day session mode was restored", () => {
      expect(
        resolveLaunchGameMode({
          defaultMode: "daily",
          restoredMode: null,
          dailyAvailable: true,
        })
      ).toBe("daily");
    });

    it("restores active classic mode even when daily is still available", () => {
      expect(
        resolveLaunchGameMode({
          defaultMode: "daily",
          restoredMode: "classic",
          dailyAvailable: true,
        })
      ).toBe("classic");
    });

    it("falls back to classic when a restored daily mode is no longer available", () => {
      expect(
        resolveLaunchGameMode({
          defaultMode: "daily",
          restoredMode: "daily",
          dailyAvailable: false,
        })
      ).toBe("classic");
    });
  });

  describe("createGuestPlayer", () => {
    const testUid = "test-uid-12345";

    it("creates a player with the correct userId", () => {
      const player = createGuestPlayer(testUid);
      expect(player.userId).toBe(testUid);
    });

    it("creates a player with a guest email format", () => {
      const player = createGuestPlayer(testUid);
      expect(player.email).toBe(`guest_${testUid}@guest.Riddle Quest.com`);
    });

    it("sets username to Guest", () => {
      const player = createGuestPlayer(testUid);
      expect(player.username).toBe("Guest");
    });

    it("initializes coins to 300", () => {
      const player = createGuestPlayer(testUid);
      expect(player.coins).toBe(300);
    });

    it("initializes hasPurchasedApp to false", () => {
      const player = createGuestPlayer(testUid);
      expect(player.hasPurchasedApp).toBe(false);
    });

    it("initializes unlockedAchievements to empty array", () => {
      const player = createGuestPlayer(testUid);
      expect(player.unlockedAchievements).toEqual([]);
    });

    describe("progress initialization", () => {
      it("sets classicIndex to 1", () => {
        const player = createGuestPlayer(testUid);
        expect(player.progress.classicIndex).toBe(1);
      });

      it("sets dailyChallengeIndex to 0", () => {
        const player = createGuestPlayer(testUid);
        expect(player.progress.dailyChallengeIndex).toBe(0);
      });

      it("sets dailyChallengeCurrentQuestion to 0", () => {
        const player = createGuestPlayer(testUid);
        expect(player.progress.dailyChallengeCurrentQuestion).toBe(0);
      });

    });

    describe("stats initialization", () => {
      it("sets xp to 0", () => {
        const player = createGuestPlayer(testUid);
        expect(player.stats.xp).toBe(0);
      });

      it("sets level to 1", () => {
        const player = createGuestPlayer(testUid);
        expect(player.stats.level).toBe(1);
      });

      it("sets dailyPuzzlesCompleted to 0", () => {
        const player = createGuestPlayer(testUid);
        expect(player.stats.dailyPuzzlesCompleted).toBe(0);
      });

      it("sets bestStreak to 0", () => {
        const player = createGuestPlayer(testUid);
        expect(player.stats.bestStreak).toBe(0);
      });

      it("sets totalWordsGuessed to 0", () => {
        const player = createGuestPlayer(testUid);
        expect(player.stats.totalWordsGuessed).toBe(0);
      });

      it("sets winRate to 0", () => {
        const player = createGuestPlayer(testUid);
        expect(player.stats.winRate).toBe(0);
      });

      it("sets averageGuesses to 0", () => {
        const player = createGuestPlayer(testUid);
        expect(player.stats.averageGuesses).toBe(0);
      });

      it("sets totalScore to 0", () => {
        const player = createGuestPlayer(testUid);
        expect(player.stats.totalScore).toBe(0);
      });

      it("sets highestLevelClassic to 0", () => {
        const player = createGuestPlayer(testUid);
        expect(player.stats.highestLevelClassic).toBe(0);
      });

      it("sets gamesPlayed to 0", () => {
        const player = createGuestPlayer(testUid);
        expect(player.stats.gamesPlayed).toBe(0);
      });

      it("sets wins to 0", () => {
        const player = createGuestPlayer(testUid);
        expect(player.stats.wins).toBe(0);
      });

      it("sets challengeWins to 0", () => {
        const player = createGuestPlayer(testUid);
        expect(player.stats.challengeWins).toBe(0);
      });

      it("sets winStreak to 0", () => {
        const player = createGuestPlayer(testUid);
        expect(player.stats.winStreak).toBe(0);
      });

      it("sets totalWins to 0", () => {
        const player = createGuestPlayer(testUid);
        expect(player.stats.totalWins).toBe(0);
      });

      it("sets totalGuessesInWins to 0", () => {
        const player = createGuestPlayer(testUid);
        expect(player.stats.totalGuessesInWins).toBe(0);
      });

      it("sets totalHintsUsed to 0", () => {
        const player = createGuestPlayer(testUid);
        expect(player.stats.totalHintsUsed).toBe(0);
      });
    });

    it("creates deterministic output for the same uid", () => {
      const player1 = createGuestPlayer(testUid);
      const player2 = createGuestPlayer(testUid);
      expect(player1).toEqual(player2);
    });

    it("creates different output for different uids", () => {
      const player1 = createGuestPlayer("uid-1");
      const player2 = createGuestPlayer("uid-2");
      expect(player1.userId).not.toBe(player2.userId);
      expect(player1.email).not.toBe(player2.email);
    });

    it("handles empty string uid", () => {
      const player = createGuestPlayer("");
      expect(player.userId).toBe("");
      expect(player.email).toBe("guest_@guest.Riddle Quest.com");
    });

    it("handles uid with special characters", () => {
      const specialUid = "user-123_abc.xyz";
      const player = createGuestPlayer(specialUid);
      expect(player.userId).toBe(specialUid);
      expect(player.email).toBe(`guest_${specialUid}@guest.Riddle Quest.com`);
    });
  });

  describe("isGuestPlayer", () => {
    it("returns true for guest email pattern", () => {
      expect(
        isGuestPlayer({
          email: "guest_abc123@guest.Riddle Quest.com",
          username: "Whatever",
        })
      ).toBe(true);
    });

    it("returns false for provider users with non-guest email even when username is Guest", () => {
      expect(
        isGuestPlayer({
          email: "player@example.com",
          username: "Guest",
        })
      ).toBe(false);
    });

    it("falls back to Guest username only when email is missing", () => {
      expect(
        isGuestPlayer({
          email: "",
          username: "Guest",
        })
      ).toBe(true);
    });
  });

  describe("resolveUserEmail", () => {
    describe("when user has direct email", () => {
      it("returns user.email when it is a valid non-empty string", async () => {
        const user = {
          email: "test@example.com",
          providerData: [],
        } as unknown as FirebaseAuthTypes.User;

        const result = await resolveUserEmail(user);
        expect(result).toBe("test@example.com");
      });

      it("returns user.email with leading/trailing spaces trimmed check", async () => {
        const user = {
          email: " valid@email.com ",
          providerData: [],
        } as unknown as FirebaseAuthTypes.User;

        // The function checks if trimmed email is not empty, but returns original
        const result = await resolveUserEmail(user);
        expect(result).toBe(" valid@email.com ");
      });

      it("does not use providerData when user.email is valid", async () => {
        const user = {
          email: "direct@example.com",
          providerData: [
            { email: "provider@example.com", providerId: "google.com" },
          ],
        } as unknown as FirebaseAuthTypes.User;

        const result = await resolveUserEmail(user);
        expect(result).toBe("direct@example.com");
      });
    });

    describe("when user.email is null or empty", () => {
      it("falls back to providerData email when user.email is null", async () => {
        const user = {
          email: null,
          providerData: [
            { email: "provider@example.com", providerId: "google.com" },
          ],
        } as unknown as FirebaseAuthTypes.User;

        const result = await resolveUserEmail(user);
        expect(result).toBe("provider@example.com");
        expect(logger.debug).toHaveBeenCalledWith(
          expect.stringContaining("Found email in providerData"),
          "provider@example.com"
        );
      });

      it("falls back to providerData email when user.email is empty string", async () => {
        const user = {
          email: "",
          providerData: [
            { email: "provider@example.com", providerId: "apple.com" },
          ],
        } as unknown as FirebaseAuthTypes.User;

        const result = await resolveUserEmail(user);
        expect(result).toBe("provider@example.com");
      });

      it("falls back to providerData email when user.email is whitespace only", async () => {
        const user = {
          email: "   ",
          providerData: [
            { email: "provider@example.com", providerId: "twitter.com" },
          ],
        } as unknown as FirebaseAuthTypes.User;

        const result = await resolveUserEmail(user);
        expect(result).toBe("provider@example.com");
      });

      it("uses the first provider with a valid email", async () => {
        const user = {
          email: "",
          providerData: [
            { email: "", providerId: "facebook.com" },
            { email: "second@example.com", providerId: "google.com" },
            { email: "third@example.com", providerId: "apple.com" },
          ],
        } as unknown as FirebaseAuthTypes.User;

        const result = await resolveUserEmail(user);
        expect(result).toBe("second@example.com");
      });

      it("skips providers with null email", async () => {
        const user = {
          email: "",
          providerData: [
            { email: null, providerId: "facebook.com" },
            { email: "valid@example.com", providerId: "google.com" },
          ],
        } as unknown as FirebaseAuthTypes.User;

        const result = await resolveUserEmail(user);
        expect(result).toBe("valid@example.com");
      });

      it("skips providers with whitespace-only email", async () => {
        const user = {
          email: "",
          providerData: [
            { email: "   ", providerId: "facebook.com" },
            { email: "valid@example.com", providerId: "google.com" },
          ],
        } as unknown as FirebaseAuthTypes.User;

        const result = await resolveUserEmail(user);
        expect(result).toBe("valid@example.com");
      });
    });

    describe("Facebook Graph API fallback", () => {
      it("fetches email from Facebook Graph API when no other email is available", async () => {
        const user = {
          email: "",
          providerData: [{ email: "", providerId: "facebook.com" }],
        } as unknown as FirebaseAuthTypes.User;

        (AccessToken.getCurrentAccessToken as jest.Mock).mockResolvedValue({
          accessToken: "mock-fb-token",
        });

        mockFetch.mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({ email: "facebook@example.com" }),
        });

        const result = await resolveUserEmail(user);
        expect(result).toBe("facebook@example.com");
        expect(logger.debug).toHaveBeenCalledWith(
          "Successfully retrieved email from Facebook Graph API:",
          "facebook@example.com"
        );
      });

      it("constructs correct Graph API URL with access token", async () => {
        const user = {
          email: "",
          providerData: [{ email: null, providerId: "facebook.com" }],
        } as unknown as FirebaseAuthTypes.User;

        (AccessToken.getCurrentAccessToken as jest.Mock).mockResolvedValue({
          accessToken: "test-token-123",
        });

        mockFetch.mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({ email: "fb@example.com" }),
        });

        await resolveUserEmail(user);

        expect(mockFetch).toHaveBeenCalledWith(
          "https://graph.facebook.com/me?fields=id,name,email&access_token=test-token-123"
        );
      });

      it("throws when Facebook access token is not available", async () => {
        const user = {
          email: "",
          providerData: [{ email: "", providerId: "facebook.com" }],
        } as unknown as FirebaseAuthTypes.User;

        (AccessToken.getCurrentAccessToken as jest.Mock).mockResolvedValue(
          null
        );

        await expect(resolveUserEmail(user)).rejects.toThrow(
          "Email is required but not provided by authentication provider"
        );
        expect(logger.error).toHaveBeenCalledWith(
          "Facebook Graph API call failed:",
          expect.any(Error)
        );
        expect(captureException).toHaveBeenCalled();
      });

      it("throws when Facebook Graph API returns non-ok response", async () => {
        const user = {
          email: "",
          providerData: [{ email: "", providerId: "facebook.com" }],
        } as unknown as FirebaseAuthTypes.User;

        (AccessToken.getCurrentAccessToken as jest.Mock).mockResolvedValue({
          accessToken: "mock-token",
        });

        mockFetch.mockResolvedValue({
          ok: false,
          status: 401,
          statusText: "Unauthorized",
        });

        await expect(resolveUserEmail(user)).rejects.toThrow(
          "Email is required but not provided by authentication provider"
        );
        expect(logger.error).toHaveBeenCalledWith(
          "Facebook Graph API call failed:",
          expect.any(Error)
        );
        expect(captureException).toHaveBeenCalled();
      });

      it("throws when Facebook Graph API response does not include email", async () => {
        const user = {
          email: "",
          providerData: [{ email: "", providerId: "facebook.com" }],
        } as unknown as FirebaseAuthTypes.User;

        (AccessToken.getCurrentAccessToken as jest.Mock).mockResolvedValue({
          accessToken: "mock-token",
        });

        mockFetch.mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({ id: "123", name: "Test User" }), // No email
        });

        await expect(resolveUserEmail(user)).rejects.toThrow(
          "Email is required but not provided by authentication provider"
        );
      });

      it("handles fetch network errors gracefully", async () => {
        const user = {
          email: "",
          providerData: [{ email: "", providerId: "facebook.com" }],
        } as unknown as FirebaseAuthTypes.User;

        (AccessToken.getCurrentAccessToken as jest.Mock).mockResolvedValue({
          accessToken: "mock-token",
        });

        const networkError = new Error("Network request failed");
        mockFetch.mockRejectedValue(networkError);

        await expect(resolveUserEmail(user)).rejects.toThrow(
          "Email is required but not provided by authentication provider"
        );
        expect(logger.error).toHaveBeenCalledWith(
          "Facebook Graph API call failed:",
          networkError
        );
        expect(captureException).toHaveBeenCalledWith(networkError);
      });

      it("handles JSON parsing errors gracefully", async () => {
        const user = {
          email: "",
          providerData: [{ email: "", providerId: "facebook.com" }],
        } as unknown as FirebaseAuthTypes.User;

        (AccessToken.getCurrentAccessToken as jest.Mock).mockResolvedValue({
          accessToken: "mock-token",
        });

        const jsonError = new Error("Invalid JSON");
        mockFetch.mockResolvedValue({
          ok: true,
          json: () => Promise.reject(jsonError),
        });

        await expect(resolveUserEmail(user)).rejects.toThrow(
          "Email is required but not provided by authentication provider"
        );
        expect(captureException).toHaveBeenCalledWith(jsonError);
      });
    });

    describe("error cases", () => {
      it("throws when no email is available from any source", async () => {
        const user = {
          email: "",
          providerData: [],
        } as unknown as FirebaseAuthTypes.User;

        await expect(resolveUserEmail(user)).rejects.toThrow(
          "Email is required but not provided by authentication provider"
        );
      });

      it("throws when user.email is null and providerData is empty", async () => {
        const user = {
          email: null,
          providerData: [],
        } as unknown as FirebaseAuthTypes.User;

        await expect(resolveUserEmail(user)).rejects.toThrow(
          "Email is required but not provided by authentication provider. Please ensure email permission is granted."
        );
      });

      it("throws when user.email is null and providerData is undefined", async () => {
        const user = {
          email: null,
          providerData: undefined,
        } as unknown as FirebaseAuthTypes.User;

        await expect(resolveUserEmail(user)).rejects.toThrow(
          "Email is required"
        );
      });

      it("throws when all providers have empty emails and no Facebook provider", async () => {
        const user = {
          email: "",
          providerData: [
            { email: "", providerId: "google.com" },
            { email: null, providerId: "apple.com" },
          ],
        } as unknown as FirebaseAuthTypes.User;

        await expect(resolveUserEmail(user)).rejects.toThrow(
          "Email is required but not provided by authentication provider"
        );
      });
    });

    describe("provider priority", () => {
      it("does not call Facebook Graph API when providerData has valid email", async () => {
        const user = {
          email: "",
          providerData: [
            { email: "provider@example.com", providerId: "google.com" },
            { email: "", providerId: "facebook.com" },
          ],
        } as unknown as FirebaseAuthTypes.User;

        const result = await resolveUserEmail(user);
        expect(result).toBe("provider@example.com");
        expect(mockFetch).not.toHaveBeenCalled();
        expect(AccessToken.getCurrentAccessToken).not.toHaveBeenCalled();
      });

      it("skips Facebook Graph API when Facebook provider exists but email is in providerData", async () => {
        const user = {
          email: "",
          providerData: [
            { email: "fb@example.com", providerId: "facebook.com" },
          ],
        } as unknown as FirebaseAuthTypes.User;

        const result = await resolveUserEmail(user);
        expect(result).toBe("fb@example.com");
        expect(mockFetch).not.toHaveBeenCalled();
      });
    });
  });

  describe("resolveProviderAvatarUrl", () => {
    it("returns user.photoURL when valid for Google provider", async () => {
      const user = {
        photoURL: "https://lh3.googleusercontent.com/avatar-main",
        providerData: [
          {
            providerId: "google.com",
            photoURL: "https://lh3.googleusercontent.com/avatar-provider",
          },
        ],
      } as unknown as FirebaseAuthTypes.User;

      await expect(resolveProviderAvatarUrl(user)).resolves.toBe(
        "https://lh3.googleusercontent.com/avatar-main"
      );
    });

    it("falls back to Google provider photoURL when user.photoURL is missing", async () => {
      const user = {
        photoURL: null,
        providerData: [
          {
            providerId: "google.com",
            photoURL: "https://lh3.googleusercontent.com/avatar-provider",
          },
        ],
      } as unknown as FirebaseAuthTypes.User;

      await expect(resolveProviderAvatarUrl(user)).resolves.toBe(
        "https://lh3.googleusercontent.com/avatar-provider"
      );
    });

    it("fetches current Facebook avatar from Graph API", async () => {
      const user = {
        photoURL: null,
        providerData: [
          {
            providerId: "facebook.com",
            photoURL: "https://platform-lookaside.fbsbx.com/profile.jpg?stale=1",
          },
        ],
      } as unknown as FirebaseAuthTypes.User;

      (AccessToken.getCurrentAccessToken as jest.Mock).mockResolvedValue({
        accessToken: "fb-access-token",
      });
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            data: {
              url: "https://platform-lookaside.fbsbx.com/current-avatar.jpg",
              is_silhouette: false,
            },
          }),
      });

      await expect(resolveProviderAvatarUrl(user)).resolves.toBe(
        "https://platform-lookaside.fbsbx.com/current-avatar.jpg"
      );
    });

    it("returns undefined for Facebook silhouette avatar", async () => {
      const user = {
        photoURL: "https://platform-lookaside.fbsbx.com/profile.jpg",
        providerData: [{ providerId: "facebook.com", photoURL: null }],
      } as unknown as FirebaseAuthTypes.User;

      (AccessToken.getCurrentAccessToken as jest.Mock).mockResolvedValue({
        accessToken: "fb-access-token",
      });
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            data: {
              url: "https://platform-lookaside.fbsbx.com/silhouette.jpg",
              is_silhouette: true,
            },
          }),
      });

      await expect(resolveProviderAvatarUrl(user)).resolves.toBeUndefined();
    });

    it("returns undefined when avatar URLs are missing or invalid", async () => {
      const user = {
        photoURL: "not-a-url",
        providerData: [
          {
            providerId: "google.com",
            photoURL: "also-not-a-url",
          },
        ],
      } as unknown as FirebaseAuthTypes.User;

      await expect(resolveProviderAvatarUrl(user)).resolves.toBeUndefined();
    });

    it("handles Facebook Graph API failures gracefully", async () => {
      const user = {
        photoURL: null,
        providerData: [{ providerId: "facebook.com", photoURL: null }],
      } as unknown as FirebaseAuthTypes.User;

      const graphError = new Error("Graph unavailable");
      (AccessToken.getCurrentAccessToken as jest.Mock).mockResolvedValue({
        accessToken: "fb-access-token",
      });
      mockFetch.mockRejectedValue(graphError);

      await expect(resolveProviderAvatarUrl(user)).resolves.toBeUndefined();
      expect(captureException).toHaveBeenCalledWith(graphError);
    });
  });

  describe("resolveProviderUsername", () => {
    it("returns user.displayName when present", () => {
      const user = {
        displayName: "Provider Name",
        providerData: [{ providerId: "google.com", displayName: "Fallback Name" }],
      } as unknown as FirebaseAuthTypes.User;

      expect(resolveProviderUsername(user)).toBe("Provider Name");
    });

    it("falls back to providerData displayName when user.displayName is missing", () => {
      const user = {
        displayName: null,
        providerData: [{ providerId: "google.com", displayName: "Google Name" }],
      } as unknown as FirebaseAuthTypes.User;

      expect(resolveProviderUsername(user)).toBe("Google Name");
    });

    it("returns undefined when no provider display name exists", () => {
      const user = {
        displayName: "   ",
        providerData: [{ providerId: "google.com", displayName: "   " }],
      } as unknown as FirebaseAuthTypes.User;

      expect(resolveProviderUsername(user)).toBeUndefined();
    });
  });
});
