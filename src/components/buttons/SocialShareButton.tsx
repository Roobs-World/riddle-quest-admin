/**
 * @fileoverview SocialShareButton - Reusable social media sharing button component.
 *
 * This component provides a consistent design for social media sharing buttons
 * with platform-specific icons and styling. It follows the existing button
 * design patterns established in the app.
 *
 * @author Qwordly Development Team
 * @version 1.0.0
 * @since 2024
 */

import React from "react";
import { TouchableOpacity, Text, ViewStyle } from "react-native";
import FacebookIcon from "../icons/FacebookIcon";
import XIcon from "../icons/XIcon";
import { COLORS } from "../../styles/tokens/colors";
import { SPACING } from "../../styles/tokens/spacing";
import { BORDER_RADIUS } from "../../styles/tokens/borderRadius";
import { TYPOGRAPHY } from "../../styles/tokens/typography";
import { moderateScale } from "../../utils/responsive";
import {
  SOCIAL_BUTTON_MIN_WIDTH_SM,
  SOCIAL_BUTTON_MIN_WIDTH_MD,
  SOCIAL_BUTTON_MIN_WIDTH_LG,
} from "../../constants/layout";

interface SocialShareButtonProps {
  platform: "facebook" | "x" | "system";
  onPress: () => void;
  disabled?: boolean;
  size?: "small" | "medium" | "large";
  fullWidth?: boolean;
}

const SocialShareButton: React.FC<SocialShareButtonProps> = ({
  platform,
  onPress,
  disabled = false,
  size = "medium",
  fullWidth = false,
}) => {
  const iconSize = size === "small" ? moderateScale(20) : size === "medium" ? moderateScale(24) : moderateScale(32);

  const getIcon = () => {
    switch (platform) {
      case "facebook":
        return <FacebookIcon width={iconSize} height={iconSize} />;
      case "x":
        return <XIcon width={iconSize} tintColor="#FFFFFF" />;
      default:
        return null;
    }
  };

  const getButtonStyle = (): ViewStyle => {
    const sizeStyles = {
      small: { paddingHorizontal: SPACING.sm, paddingVertical: SPACING.xs, minWidth: SOCIAL_BUTTON_MIN_WIDTH_SM },
      medium: { paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, minWidth: SOCIAL_BUTTON_MIN_WIDTH_MD },
      large: { paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md, minWidth: SOCIAL_BUTTON_MIN_WIDTH_LG },
    };

    const platformBg = {
      facebook: disabled ? COLORS.gray200 : "#1877F2",
      x: disabled ? COLORS.gray200 : "#000000",
      system: disabled ? COLORS.gray200 : "#5856D6",
    };

    return {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      borderRadius: BORDER_RADIUS.lg,
      shadowColor: COLORS.shadowColor,
      shadowOffset: { width: 0, height: moderateScale(2) },
      shadowOpacity: 0.1,
      shadowRadius: moderateScale(4),
      elevation: 3,
      backgroundColor: platformBg[platform],
      ...(fullWidth ? { width: "100%" } : {}),
      ...sizeStyles[size],
    };
  };

  const textColor = disabled ? COLORS.gray400 : "#FFFFFF";
  const textStyle = {
    fontFamily: TYPOGRAPHY.fontSecondary,
    fontWeight: "600" as const,
    marginLeft: platform === "facebook" ? SPACING.xs : 0,
    color: textColor,
    fontSize: size === "small" ? TYPOGRAPHY.fontSize.xs : size === "medium" ? TYPOGRAPHY.fontSize.sm : TYPOGRAPHY.fontSize.base,
  };

  const platformLabel = platform === "facebook" ? "Facebook" : platform === "x" ? "X" : "Share";

  return (
    <TouchableOpacity
      style={getButtonStyle()}
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      activeOpacity={0.8}
      accessibilityLabel={`Share to ${platformLabel}`}
      accessibilityRole="button"
    >
      {getIcon()}
      {platform !== "x" && <Text style={textStyle}>{platformLabel}</Text>}
    </TouchableOpacity>
  );
};

export default SocialShareButton;

