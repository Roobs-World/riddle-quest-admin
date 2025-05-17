import React from "react";
import { TouchableOpacity, Text } from "react-native";

interface SignInButtonProps {
  onPress: () => void;
}

const SignInButton: React.FC<SignInButtonProps> = ({ onPress }) => {
  return (
    <TouchableOpacity
      className="bg-primary-orange w-full py-4 rounded-lg shadow-md mb-4"
      onPress={onPress}
    >
      <Text className="text-white text-lg font-semibold text-center">
        Sign In
      </Text>
    </TouchableOpacity>
  );
};

export default SignInButton;
