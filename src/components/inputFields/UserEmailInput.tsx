import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { AppStrings } from "../../constants/AppStrings";
import ReusableTextInput from "../shared/ReusableTextInput";
import Error from "../text/Error";

interface UserEmailInputProps {
  email: string;
  setEmail: (email: string) => void;
  errorMessage?: string | null;
}

const UserEmailInput: React.FC<UserEmailInputProps> = ({
  email,
  setEmail,
  errorMessage,
}) => {
  return (
    <View className="w-full">
      <Text
        className="text-sm text-gray-600 mb-2 text-left"
        style={styles.textInput}
      >
        {AppStrings.AuthStrings.Login.EMAIL_LABEL}
      </Text>
      <View className="flex-row items-center bg-input-background rounded-lg border border-gray-300">
        <ReusableTextInput
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          placeholder={AppStrings.AuthStrings.Login.EMAIL_PLACEHOLDER}
        />
      </View>
      {errorMessage && <Error message={errorMessage} />}
    </View>
  );
};

const styles = StyleSheet.create({
  textInput: {
    fontFamily: "PoppinsSemiBold",
    textAlignVertical: "center",
  },
});

export default UserEmailInput;
