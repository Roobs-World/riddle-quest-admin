import React from "react";
import { TouchableOpacity, Text } from "react-native";
import GoogleIcon from "./icons/GoogleIcon";

interface GoogleSignInButtonProps {
  onPress: () => void;
}

const GoogleSignInButton: React.FC<GoogleSignInButtonProps> = ({ onPress }) => {
  return (
    <TouchableOpacity
      className="bg-white border border-gray-300 w-full py-3 rounded-lg shadow-sm mb-4 flex-row items-center justify-center"
      onPress={onPress}
    >
      <GoogleIcon width={24} height={24} />
      <Text className="text-gray-700 text-base font-medium ml-2">
        Continue with Google
      </Text>
    </TouchableOpacity>
  );
};

export default GoogleSignInButton;
