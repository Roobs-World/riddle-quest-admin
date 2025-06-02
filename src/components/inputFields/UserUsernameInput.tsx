import React from "react";
import { View, Text } from "react-native";
import { AppStrings } from "../../constants/AppStrings";
import ReusableTextInput from "../shared/ReusableTextInput";
import Error from "../text/Error";
import { styles } from "../../styles/styles";

interface UserUsernameInputProps {
  username: string;
  setUsername: (username: string) => void;
  errorMessage?: string | null;
}

const UserUsernameInput: React.FC<UserUsernameInputProps> = ({
  username,
  setUsername,
  errorMessage,
}) => {
  return (
    <View className="w-full">
      <Text
        className="text-sm text-gray-600 mb-2 text-left"
        style={styles.labelText}
      >
        {AppStrings.AuthStrings.SignUp.USERNAME_LABEL}
      </Text>
      <View className="flex-row items-center bg-input-background rounded-lg border border-gray-300">
        <ReusableTextInput
          value={username}
          onChangeText={setUsername}
          placeholder={AppStrings.AuthStrings.SignUp.USERNAME_PLACEHOLDER}
          autoCapitalize="none"
        />
      </View>
      {errorMessage && <Error message={errorMessage} />}
    </View>
  );
};

export default UserUsernameInput;
