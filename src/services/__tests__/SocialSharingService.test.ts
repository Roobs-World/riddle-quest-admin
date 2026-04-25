/**
 * @fileoverview Unit tests for SocialSharingService.
 *
 * Tests social media sharing functionality including Facebook, X (Twitter),
 * and system share methods.
 */

// Mock React Native Share and Linking before imports
jest.mock("react-native", () => ({
  Share: {
    share: jest.fn(),
    sharedAction: "sharedAction",
    dismissedAction: "dismissedAction",
  },
  Linking: {
    canOpenURL: jest.fn(),
    openURL: jest.fn(),
  },
}));

// Mock Facebook SDK
jest.mock("react-native-fbsdk-next", () => ({
  ShareDialog: {
    canShow: jest.fn(),
    show: jest.fn(),
  },
}));

// Mock logger and sentry
jest.mock("../../utils/logger", () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock("../../utils/sentry", () => ({
  captureException: jest.fn(),
}));

import { Share, Linking } from "react-native";
import { ShareDialog } from "react-native-fbsdk-next";
import { SocialSharingService, ShareContent } from "../SocialSharingService";
import { logger } from "../../utils/logger";
import { captureException } from "../../utils/sentry";

describe("SocialSharingService", () => {
  const mockShareContent: ShareContent = {
    attempts: 3,
    emojiGrid: "🟩🟨🟩🟩🟩\n🟩🟩🟩🟩🟩",
    gameMode: "daily",
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("generateShareText", () => {
    it("should generate share text for daily challenge mode", () => {
      const content: ShareContent = {
        attempts: 3,
        emojiGrid: "🟩🟨🟩🟩🟩",
        gameMode: "daily",
      };

      const result = SocialSharingService.generateShareText(content);

      expect(result).toContain("Daily Challenge");
      expect(result).toContain("3 attempts");
      expect(result).toContain("🟩🟨🟩🟩🟩");
      expect(result).toContain("#Riddle Quest");
    });

    it("should generate share text for classic mode", () => {
      const content: ShareContent = {
        attempts: 2,
        emojiGrid: "🟨🟩🟩🟩🟩\n🟩🟩🟩🟩🟩",
        gameMode: "classic",
      };

      const result = SocialSharingService.generateShareText(content);

      expect(result).toContain("Classic Mode");
      expect(result).toContain("2 attempts");
    });

    it("should use singular 'attempt' for single attempt", () => {
      const content: ShareContent = {
        attempts: 1,
        emojiGrid: "🟩🟩🟩🟩🟩",
        gameMode: "daily",
      };

      const result = SocialSharingService.generateShareText(content);

      expect(result).toContain("1 attempt!");
      expect(result).not.toContain("1 attempts");
    });

    it("should default to daily mode if not specified", () => {
      const content: ShareContent = {
        attempts: 4,
        emojiGrid: "🟨🟨🟨🟨🟨",
      };

      const result = SocialSharingService.generateShareText(content);

      expect(result).toContain("Daily Challenge");
    });

    it("should include all required hashtags", () => {
      const content: ShareContent = {
        attempts: 3,
        emojiGrid: "🟩🟩🟩🟩🟩",
      };

      const result = SocialSharingService.generateShareText(content);

      expect(result).toContain("#Riddle Quest");
      expect(result).toContain("#WordPuzzle");
      expect(result).toContain("#BrainGame");
    });

    it("should handle zero attempts", () => {
      const content: ShareContent = {
        attempts: 0,
        emojiGrid: "",
      };

      const result = SocialSharingService.generateShareText(content);

      expect(result).toContain("0 attempts");
    });

    it("should handle large number of attempts", () => {
      const content: ShareContent = {
        attempts: 100,
        emojiGrid: "🟩🟩🟩🟩🟩",
      };

      const result = SocialSharingService.generateShareText(content);

      expect(result).toContain("100 attempts");
    });

    it("should handle empty emoji grid", () => {
      const content: ShareContent = {
        attempts: 3,
        emojiGrid: "",
      };

      const result = SocialSharingService.generateShareText(content);

      expect(result).toBeDefined();
      expect(result).toContain("3 attempts");
    });
  });

  describe("shareViaSystem", () => {
    it("should successfully share via system share", async () => {
      (Share.share as jest.Mock).mockResolvedValueOnce({
        action: Share.sharedAction,
      });

      const result = await SocialSharingService.shareViaSystem(mockShareContent);

      expect(result).toBe(true);
      expect(Share.share).toHaveBeenCalledWith({
        message: expect.stringContaining("Daily Challenge"),
        title: "Check out my Riddle Quest result!",
      });
    });

    it("should return false when share is dismissed", async () => {
      (Share.share as jest.Mock).mockResolvedValueOnce({
        action: Share.dismissedAction,
      });

      const result = await SocialSharingService.shareViaSystem(mockShareContent);

      expect(result).toBe(false);
    });

    it("should return false and log error when share fails", async () => {
      const error = new Error("Share failed");
      (Share.share as jest.Mock).mockRejectedValueOnce(error);

      const result = await SocialSharingService.shareViaSystem(mockShareContent);

      expect(result).toBe(false);
      expect(logger.error).toHaveBeenCalledWith(
        "Error sharing via system:",
        error
      );
      expect(captureException).toHaveBeenCalledWith(error);
    });

    it("should handle network errors gracefully", async () => {
      const networkError = new Error("Network request failed");
      (Share.share as jest.Mock).mockRejectedValueOnce(networkError);

      const result = await SocialSharingService.shareViaSystem(mockShareContent);

      expect(result).toBe(false);
      expect(captureException).toHaveBeenCalledWith(networkError);
    });
  });

  describe("shareToFacebook", () => {
    it("should share via Facebook ShareDialog when available", async () => {
      (ShareDialog.canShow as jest.Mock).mockResolvedValueOnce(true);
      (ShareDialog.show as jest.Mock).mockResolvedValueOnce({
        isCancelled: false,
      });

      const result = await SocialSharingService.shareToFacebook(mockShareContent);

      expect(result).toBe(true);
      expect(ShareDialog.canShow).toHaveBeenCalledWith({
        contentType: "link",
        contentUrl: "https://Riddle Quest.app",
        quote: expect.stringContaining("Daily Challenge"),
      });
      expect(ShareDialog.show).toHaveBeenCalled();
    });

    it("should return false when user cancels Facebook share", async () => {
      (ShareDialog.canShow as jest.Mock).mockResolvedValueOnce(true);
      (ShareDialog.show as jest.Mock).mockResolvedValueOnce({
        isCancelled: true,
      });

      const result = await SocialSharingService.shareToFacebook(mockShareContent);

      expect(result).toBe(false);
    });

    it("should fallback to system share when Facebook not available", async () => {
      (ShareDialog.canShow as jest.Mock).mockResolvedValueOnce(false);
      (Share.share as jest.Mock).mockResolvedValueOnce({
        action: Share.sharedAction,
      });

      const result = await SocialSharingService.shareToFacebook(mockShareContent);

      expect(result).toBe(true);
      expect(ShareDialog.show).not.toHaveBeenCalled();
      expect(Share.share).toHaveBeenCalled();
    });

    it("should fallback to system share on error", async () => {
      const error = new Error("Facebook SDK error");
      (ShareDialog.canShow as jest.Mock).mockRejectedValueOnce(error);
      (Share.share as jest.Mock).mockResolvedValueOnce({
        action: Share.sharedAction,
      });

      const result = await SocialSharingService.shareToFacebook(mockShareContent);

      expect(result).toBe(true);
      expect(logger.error).toHaveBeenCalledWith(
        "Error sharing to Facebook:",
        error
      );
      expect(captureException).toHaveBeenCalledWith(error);
    });

    it("should handle ShareDialog.show throwing an error", async () => {
      const error = new Error("ShareDialog show failed");
      (ShareDialog.canShow as jest.Mock).mockResolvedValueOnce(true);
      (ShareDialog.show as jest.Mock).mockRejectedValueOnce(error);
      (Share.share as jest.Mock).mockResolvedValueOnce({
        action: Share.sharedAction,
      });

      const result = await SocialSharingService.shareToFacebook(mockShareContent);

      expect(result).toBe(true);
      expect(logger.error).toHaveBeenCalledWith(
        "Error sharing to Facebook:",
        error
      );
    });
  });

  describe("shareToX", () => {
    it("should open X app when available", async () => {
      (Linking.canOpenURL as jest.Mock).mockResolvedValueOnce(true);
      (Linking.openURL as jest.Mock).mockResolvedValueOnce(undefined);

      const result = await SocialSharingService.shareToX(mockShareContent);

      expect(result).toBe(true);
      expect(Linking.canOpenURL).toHaveBeenCalledWith(
        expect.stringContaining("twitter://post")
      );
      expect(Linking.openURL).toHaveBeenCalledWith(
        expect.stringContaining("twitter://post")
      );
    });

    it("should fallback to X web when app not available", async () => {
      (Linking.canOpenURL as jest.Mock)
        .mockResolvedValueOnce(false) // X app not available
        .mockResolvedValueOnce(true); // Web available
      (Linking.openURL as jest.Mock).mockResolvedValueOnce(undefined);

      const result = await SocialSharingService.shareToX(mockShareContent);

      expect(result).toBe(true);
      expect(Linking.openURL).toHaveBeenCalledWith(
        expect.stringContaining("https://twitter.com/intent/tweet")
      );
    });

    it("should fallback to system share when X web not available", async () => {
      (Linking.canOpenURL as jest.Mock)
        .mockResolvedValueOnce(false) // X app not available
        .mockResolvedValueOnce(false); // Web not available
      (Share.share as jest.Mock).mockResolvedValueOnce({
        action: Share.sharedAction,
      });

      const result = await SocialSharingService.shareToX(mockShareContent);

      expect(result).toBe(true);
      expect(Share.share).toHaveBeenCalled();
    });

    it("should fallback to system share on error", async () => {
      const error = new Error("Linking error");
      (Linking.canOpenURL as jest.Mock).mockRejectedValueOnce(error);
      (Share.share as jest.Mock).mockResolvedValueOnce({
        action: Share.sharedAction,
      });

      const result = await SocialSharingService.shareToX(mockShareContent);

      expect(result).toBe(true);
      expect(logger.error).toHaveBeenCalledWith("Error sharing to X:", error);
      expect(captureException).toHaveBeenCalledWith(error);
    });

    it("should encode text properly for URL", async () => {
      (Linking.canOpenURL as jest.Mock).mockResolvedValueOnce(true);
      (Linking.openURL as jest.Mock).mockResolvedValueOnce(undefined);

      await SocialSharingService.shareToX(mockShareContent);

      const openURLCall = (Linking.openURL as jest.Mock).mock.calls[0][0];
      expect(openURLCall).toContain(encodeURIComponent("Daily Challenge"));
    });

    it("should handle openURL failure", async () => {
      const error = new Error("Failed to open URL");
      (Linking.canOpenURL as jest.Mock).mockResolvedValueOnce(true);
      (Linking.openURL as jest.Mock).mockRejectedValueOnce(error);
      (Share.share as jest.Mock).mockResolvedValueOnce({
        action: Share.sharedAction,
      });

      const result = await SocialSharingService.shareToX(mockShareContent);

      expect(result).toBe(true);
      expect(logger.error).toHaveBeenCalledWith("Error sharing to X:", error);
    });
  });

  describe("share", () => {
    it("should call shareToFacebook for facebook platform", async () => {
      (ShareDialog.canShow as jest.Mock).mockResolvedValueOnce(true);
      (ShareDialog.show as jest.Mock).mockResolvedValueOnce({
        isCancelled: false,
      });

      const result = await SocialSharingService.share("facebook", mockShareContent);

      expect(result).toBe(true);
      expect(ShareDialog.canShow).toHaveBeenCalled();
    });

    it("should call shareToX for x platform", async () => {
      (Linking.canOpenURL as jest.Mock).mockResolvedValueOnce(true);
      (Linking.openURL as jest.Mock).mockResolvedValueOnce(undefined);

      const result = await SocialSharingService.share("x", mockShareContent);

      expect(result).toBe(true);
      expect(Linking.canOpenURL).toHaveBeenCalled();
    });

    it("should call shareViaSystem for system platform", async () => {
      (Share.share as jest.Mock).mockResolvedValueOnce({
        action: Share.sharedAction,
      });

      const result = await SocialSharingService.share("system", mockShareContent);

      expect(result).toBe(true);
      expect(Share.share).toHaveBeenCalled();
    });

    it("should default to system share for unknown platform", async () => {
      (Share.share as jest.Mock).mockResolvedValueOnce({
        action: Share.sharedAction,
      });

      // Cast to any to test the default case
      const result = await SocialSharingService.share(
        "unknown" as any,
        mockShareContent
      );

      expect(result).toBe(true);
      expect(Share.share).toHaveBeenCalled();
    });
  });

  describe("ShareContent interface", () => {
    it("should accept valid ShareContent with all properties", () => {
      const content: ShareContent = {
        attempts: 5,
        emojiGrid: "🟩🟩🟩🟩🟩",
        gameMode: "daily",
      };

      expect(content.attempts).toBe(5);
      expect(content.emojiGrid).toBe("🟩🟩🟩🟩🟩");
      expect(content.gameMode).toBe("daily");
    });

    it("should accept ShareContent without optional gameMode", () => {
      const content: ShareContent = {
        attempts: 3,
        emojiGrid: "🟨🟩🟩🟩🟩",
      };

      expect(content.gameMode).toBeUndefined();
    });

    it("should accept classic game mode", () => {
      const content: ShareContent = {
        attempts: 2,
        emojiGrid: "🟩🟩🟩🟩🟩",
        gameMode: "classic",
      };

      expect(content.gameMode).toBe("classic");
    });
  });

  describe("edge cases", () => {
    it("should handle special characters in emoji grid", async () => {
      const contentWithSpecialChars: ShareContent = {
        attempts: 2,
        emojiGrid: "🟥🟧🟨🟩🟦\n⬜⬛",
      };

      (Share.share as jest.Mock).mockResolvedValueOnce({
        action: Share.sharedAction,
      });

      const result = await SocialSharingService.shareViaSystem(
        contentWithSpecialChars
      );

      expect(result).toBe(true);
    });

    it("should handle multi-line emoji grids", async () => {
      const multiLineContent: ShareContent = {
        attempts: 5,
        emojiGrid: "🟨🟨🟨🟨🟨\n🟨🟩🟨🟨🟨\n🟩🟩🟨🟨🟨\n🟩🟩🟩🟨🟨\n🟩🟩🟩🟩🟩",
      };

      const result = SocialSharingService.generateShareText(multiLineContent);

      expect(result).toContain("🟨🟨🟨🟨🟨\n");
      expect(result).toContain("🟩🟩🟩🟩🟩");
    });

    it("should handle concurrent share calls", async () => {
      (Share.share as jest.Mock).mockResolvedValue({
        action: Share.sharedAction,
      });

      const promises = [
        SocialSharingService.shareViaSystem(mockShareContent),
        SocialSharingService.shareViaSystem(mockShareContent),
        SocialSharingService.shareViaSystem(mockShareContent),
      ];

      const results = await Promise.all(promises);

      expect(results).toEqual([true, true, true]);
      expect(Share.share).toHaveBeenCalledTimes(3);
    });
  });
});
