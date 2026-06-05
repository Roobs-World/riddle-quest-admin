/**
 * @fileoverview SocialSharingService - Social media sharing functionality.
 *
 * This service provides methods for sharing game results to social media platforms
 * including Facebook and Twitter. It handles the generation of shareable content
 * and platform-specific sharing mechanisms.
 *
 * @author Riddle Quest Development Team
 * @version 1.0.0
 * @since 2024
 */

import {Linking, Share} from "react-native";
import {ShareDialog} from "react-native-fbsdk-next";
import {t} from "../i18n";
import {captureException} from "../utils/sentry";
import {logger} from "../utils/logger";

export interface ShareContent {
  attempts: number;
  emojiGrid: string;
  gameMode?: "daily" | "classic";
}

const APP_SHARE_URL = "https://Riddle Quest.app";

export class SocialSharingService {
  /**
   * Generate shareable text content for game results
   */
  static generateShareText(content: ShareContent): string {
    const {attempts, emojiGrid, gameMode = "daily"} = content;
    const gameTypeText =
      gameMode === "daily"
        ? t("VictoryModal.SHARE_DAILY_CHALLENGE_LABEL")
        : t("VictoryModal.SHARE_CLASSIC_MODE_LABEL");
    const attemptText =
      attempts === 1 ? t("VictoryModal.SHARE_ATTEMPT_SINGULAR") : t("VictoryModal.SHARE_ATTEMPT_PLURAL");

    return t("VictoryModal.SHARE_MESSAGE_TEMPLATE", {
      attempts,
      attemptLabel: attemptText,
      emojiGrid,
      gameType: gameTypeText,
    });
  }

  /**
   * Share via React Native's built-in Share API (works on all platforms)
   */
  static async shareViaSystem(content: ShareContent): Promise<boolean> {
    try {
      const shareText = this.generateShareText(content);

      const result = await Share.share({
        message: shareText,
        title: t("VictoryModal.SHARE_RESULT_TITLE"),
      });

      return result.action === Share.sharedAction;
    } catch (error) {
      logger.error("Error sharing via system:", error);
      captureException(error);
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
        contentUrl: APP_SHARE_URL,
        quote: shareText,
      });

      if (canShow) {
        const result = await ShareDialog.show({
          contentType: "link",
          contentUrl: APP_SHARE_URL,
          quote: shareText,
        });

        return !result.isCancelled;
      }

      // Fallback to system share if Facebook app not available
      return this.shareViaSystem(content);
    } catch (error) {
      logger.error("Error sharing to Facebook:", error);
      captureException(error);
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
      }

      // Fallback to X web (still uses twitter.com)
      const xWebUrl = `https://twitter.com/intent/tweet?text=${encodedText}`;
      const canOpenWeb = await Linking.canOpenURL(xWebUrl);

      if (canOpenWeb) {
        await Linking.openURL(xWebUrl);
        return true;
      }

      // Final fallback to system share
      return this.shareViaSystem(content);
    } catch (error) {
      logger.error("Error sharing to X:", error);
      captureException(error);
      return this.shareViaSystem(content);
    }
  }

  /**
   * Generic share function that tries platform-specific sharing first,
   * then falls back to system share
   */
  static async share(platform: "facebook" | "x" | "system", content: ShareContent): Promise<boolean> {
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
