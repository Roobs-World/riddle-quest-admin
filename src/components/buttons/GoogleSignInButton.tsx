import React from "react";
import { TouchableOpacity, Text } from "react-native";
import GoogleIcon from "../icons/GoogleIcon";
import { styles, SIZING, SPACING } from "../../styles";
import { scale } from "../../utils/responsive";

interface GoogleSignInButtonProps {
  onPress: () => void;
  disabled?: boolean;
}

const GoogleSignInButton: React.FC<GoogleSignInButtonProps> = ({
  onPress,
  disabled = false,
}) => {
  return (
    <TouchableOpacity
      className={`w-full rounded-lg shadow-sm flex-row items-center justify-center border ${
        disabled ? "bg-gray-100 border-gray-200" : "bg-white border-gray-300"
      }`}
      style={{ paddingVertical: scale(12) }}
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
    >
      <GoogleIcon width={SIZING.icon.md} height={SIZING.icon.md} />
      <Text
        className={`font-medium ${
          disabled ? "text-gray-400" : "text-gray-700"
        }`}
        style={[styles.socialButtonText, { marginLeft: SPACING.sm }]}
      >
        Continue with Google
      </Text>
    </TouchableOpacity>
  );
};

export default GoogleSignInButton;
