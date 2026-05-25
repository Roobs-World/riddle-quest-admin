import React from "react";
import {TouchableOpacity, Text} from "react-native";
import TwitterXIcon from "../icons/TwitterXIcon";
import {styles, SIZING, SPACING} from "../../styles";
import {scale} from "../../utils/responsive";
import {AppStrings} from "../../constants/AppStrings";

interface TwitterSignInButtonProps {
  onPress: () => void;
  disabled?: boolean;
}

const TwitterSignInButton: React.FC<TwitterSignInButtonProps> = ({onPress, disabled = false}) => {
  return (
    <TouchableOpacity
      className={`w-full rounded-lg shadow-sm flex-row items-center justify-center border ${
        disabled ? "bg-gray-100 border-gray-200" : "bg-white border-gray-300"
      }`}
      style={{paddingVertical: scale(12), marginBottom: SPACING.md}}
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
    >
      <TwitterXIcon width={SIZING.icon.md} height={SIZING.icon.md} />
      <Text
        className={`font-medium ${disabled ? "text-gray-400" : "text-gray-700"}`}
        style={[styles.socialButtonText, {marginLeft: SPACING.sm}]}
      >
        {AppStrings.AuthStrings.Login.CONTINUE_WITH_TWITTER}
      </Text>
    </TouchableOpacity>
  );
};

export default TwitterSignInButton;
