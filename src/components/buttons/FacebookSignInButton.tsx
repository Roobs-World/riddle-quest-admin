import React from "react";
import { TouchableOpacity, Text } from "react-native";
import FacebookIcon from "../icons/FacebookIcon";

interface FacebookSignInButtonProps {
  onPress: () => void;
}

const FacebookSignInButton: React.FC<FacebookSignInButtonProps> = ({
  onPress,
}) => {
  return (
    <TouchableOpacity
      className="bg-white border border-gray-300 w-full py-3 rounded-lg shadow-sm mb-4 flex-row items-center justify-center"
      onPress={onPress}
    >
      <FacebookIcon width={24} height={24} />
      <Text className="text-gray-700 text-base font-medium ml-2">
        Continue with Facebook
      </Text>
    </TouchableOpacity>
  );
};

export default FacebookSignInButton;
