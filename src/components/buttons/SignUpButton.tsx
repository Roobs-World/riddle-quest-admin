import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { styles, SPACING } from "../../styles";

interface SignUpButtonProps {
  onPress: () => void;
}

const SignUpButton: React.FC<SignUpButtonProps> = ({ onPress }) => {
  return (
    <View className="flex-row items-center">
      <TouchableOpacity
        onPress={onPress}
        className="border border-white rounded-xl"
        style={{ paddingHorizontal: SPACING.xl, paddingVertical: SPACING.sm }}
      >
        <Text
          className="text-white font-semibold"
          style={styles.signUpButtonText}
        >
          Sign up
        </Text>
      </TouchableOpacity>
    </View>
  );
};

export default SignUpButton;
