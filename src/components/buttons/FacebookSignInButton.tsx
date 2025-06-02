import React from "react";
import { TouchableOpacity, Text } from "react-native";
import FacebookIcon from "../icons/FacebookIcon";
import { styles } from "../../styles/styles";

interface FacebookSignInButtonProps {
  onPress: () => void;
  disabled?: boolean;
}

const FacebookSignInButton: React.FC<FacebookSignInButtonProps> = ({
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
      <FacebookIcon width={24} height={24} />
      <Text
        className={`text-base font-medium ml-2 ${
          disabled ? "text-gray-400" : "text-gray-700"
        }`}
        style={styles.socialButtonText}
      >
        Continue with Facebook
      </Text>
    </TouchableOpacity>
  );
};

export default FacebookSignInButton;
