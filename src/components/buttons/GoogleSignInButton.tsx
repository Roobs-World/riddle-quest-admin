import React from "react";
import { TouchableOpacity, Text } from "react-native";
import GoogleIcon from "../icons/GoogleIcon";
import { styles } from "../../styles";

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
      className={`w-full py-3 rounded-lg shadow-sm mb-4 flex-row items-center justify-center border ${
        disabled ? "bg-gray-100 border-gray-200" : "bg-white border-gray-300"
      }`}
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
    >
      <GoogleIcon width={24} height={24} />
      <Text
        className={`text-base font-medium ml-2 ${
          disabled ? "text-gray-400" : "text-gray-700"
        }`}
        style={styles.socialButtonText}
      >
        Continue with Google
      </Text>
    </TouchableOpacity>
  );
};

export default GoogleSignInButton;
