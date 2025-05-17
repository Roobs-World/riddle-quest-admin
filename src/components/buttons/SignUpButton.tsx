import React from "react";
import { View, Text, TouchableOpacity } from "react-native";

interface SignUpButtonProps {
  onPress: () => void;
}

const SignUpButton: React.FC<SignUpButtonProps> = ({ onPress }) => {
  return (
    <View className="flex-row items-center mt-8">
      <TouchableOpacity
        onPress={onPress}
        className="px-8 py-2 border border-gray-300 rounded-xl"
      >
        <Text
          className="text-sm text-gray-800 font-semibold"
          style={{ fontFamily: "PoppinsSemiBold" }}
        >
          Sign up
        </Text>
      </TouchableOpacity>
    </View>
  );
};

export default SignUpButton;
