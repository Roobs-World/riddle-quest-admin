/**
 * @fileoverview SocialSharingService - Social media sharing functionality.
 *
 * This service provides methods for sharing game results to social media platforms
 * including Facebook and Twitter. It handles the generation of shareable content
 * and platform-specific sharing mechanisms.
 *
 * @author Qwordly Development Team
 * @version 1.0.0
 * @since 2024
 */

import { Share, Linking } from "react-native";
import { ShareDialog } from "react-native-fbsdk-next";

export interface ShareContent {
  attempts: number;
  emojiGrid: string;
  gameMode?: "daily" | "classic";
}

export class SocialSharingService {
  /**
   * Generate shareable text content for game results
   */
  static generateShareText(content: ShareContent): string {
    const { attempts, emojiGrid, gameMode = "daily" } = content;

    const gameTypeText =
      gameMode === "daily" ? "Daily Challenge" : "Classic Mode";
    const attemptText = attempts === 1 ? "attempt" : "attempts";

    return `🎯 I solved today's Qwordly ${gameTypeText} in ${attempts} ${attemptText}!\n\n${emojiGrid}\n\nCan you beat my score? 🤔\n\n#Qwordly #WordPuzzle #BrainGame`;
  }

  /**
   * Share via React Native's built-in Share API (works on all platforms)
   */
  static async shareViaSystem(content: ShareContent): Promise<boolean> {
    try {
      const shareText = this.generateShareText(content);

      const result = await Share.share({
        message: shareText,
        title: "Check out my Qwordly result!",
      });

      return result.action === Share.sharedAction;
    } catch (error) {
      console.error("Error sharing via system:", error);
      return false;
    }
  }

  /**
   * Share to Facebook using Facebook SDK
   */
  static async shareToFacebook(content: ShareContent): Promise<boolean> {
    try {
      const shareText = this.generateShareText(content);

      // Check if ShareDialog is available
      const canShow = await ShareDialog.canShow({
        contentType: "link",
        contentUrl: "https://qwordly.app", // Replace with your actual app URL
        quote: shareText,
      });

      if (canShow) {
        const result = await ShareDialog.show({
          contentType: "link",
          contentUrl: "https://qwordly.app", // Replace with your actual app URL
          quote: shareText,
        });

        return !result.isCancelled;
      } else {
        // Fallback to system share if Facebook app not available
        return this.shareViaSystem(content);
      }
    } catch (error) {
      console.error("Error sharing to Facebook:", error);
      // Fallback to system share
      return this.shareViaSystem(content);
    }
  }

  /**
   * Share to X (formerly Twitter) via URL scheme or web
   */
  static async shareToX(content: ShareContent): Promise<boolean> {
    try {
      const shareText = this.generateShareText(content);
      const encodedText = encodeURIComponent(shareText);

      // Try to open X/Twitter app first
      const xAppUrl = `twitter://post?message=${encodedText}`;
      const canOpenXApp = await Linking.canOpenURL(xAppUrl);

      if (canOpenXApp) {
        await Linking.openURL(xAppUrl);
        return true;
      } else {
        // Fallback to X web (still uses twitter.com)
        const xWebUrl = `https://twitter.com/intent/tweet?text=${encodedText}`;
        const canOpenWeb = await Linking.canOpenURL(xWebUrl);

        if (canOpenWeb) {
          await Linking.openURL(xWebUrl);
          return true;
        } else {
          // Final fallback to system share
          return this.shareViaSystem(content);
        }
      }
    } catch (error) {
      console.error("Error sharing to X:", error);
      // Fallback to system share
      return this.shareViaSystem(content);
    }
  }

  /**
   * Generic share function that tries platform-specific sharing first,
   * then falls back to system share
   */
  static async share(
    platform: "facebook" | "x" | "system",
    content: ShareContent
  ): Promise<boolean> {
    switch (platform) {
      case "facebook":
        return this.shareToFacebook(content);
      case "x":
        return this.shareToX(content);
      case "system":
      default:
        return this.shareViaSystem(content);
    }
  }
}
