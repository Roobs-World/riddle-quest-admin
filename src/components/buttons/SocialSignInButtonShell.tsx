import React from "react";
import {StyleSheet, Text, TouchableOpacity, type StyleProp, type TextStyle, type ViewStyle} from "react-native";
import {SPACING, styles} from "../../styles";
import {scale} from "../../utils/responsive";
import {t, type TranslationKey} from "../../i18n";

interface SocialSignInButtonShellProps {
  icon: React.ReactNode;
  labelKey: TranslationKey;
  onPress: () => void;
  disabled?: boolean;
  buttonStyle?: StyleProp<ViewStyle>;
  iconSpacing?: number;
  testID?: string;
  textStyle?: StyleProp<TextStyle>;
}

const SocialSignInButtonShell: React.FC<SocialSignInButtonShellProps> = ({
  icon,
  labelKey,
  onPress,
  disabled = false,
  buttonStyle,
  iconSpacing = SPACING.sm,
  testID,
  textStyle,
}) => {
  return (
    <TouchableOpacity
      testID={testID}
      className={`w-full rounded-lg shadow-sm flex-row items-center justify-center border ${
        disabled ? "bg-gray-100 border-gray-200" : "bg-white border-gray-300"
      }`}
      style={StyleSheet.flatten([{paddingVertical: scale(12)}, buttonStyle])}
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
    >
      {icon}
      <Text
        className={`font-medium ${disabled ? "text-gray-400" : "text-gray-700"}`}
        style={[styles.socialButtonText, {marginLeft: iconSpacing}, textStyle]}
      >
        {t(labelKey)}
      </Text>
    </TouchableOpacity>
  );
};

export default SocialSignInButtonShell;
