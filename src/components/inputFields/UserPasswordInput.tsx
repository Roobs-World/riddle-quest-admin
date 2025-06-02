import React, { useState } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { AppStrings } from "../../constants/AppStrings";
import ReusableTextInput from "../shared/ReusableTextInput";
import PasswordVisibilityIcon from "../icons/PasswordVisibilityIcon";
import Error from "../text/Error";
import { styles } from "../../styles";

interface UserPasswordInputProps {
  password: string;
  setPassword: (password: string) => void;
  errorMessage?: string | null;
  label?: string;
  placeholder?: string;
}

const UserPasswordInput: React.FC<UserPasswordInputProps> = ({
  password,
  setPassword,
  errorMessage,
  label,
  placeholder,
}) => {
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  const togglePasswordVisibility = () => {
    setIsPasswordVisible(!isPasswordVisible);
  };

  const passwordLabel = label || AppStrings.AuthStrings.Login.PASSWORD_LABEL;
  const passwordPlaceholder =
    placeholder || AppStrings.AuthStrings.Login.PASSWORD_PLACEHOLDER;

  return (
    <View className="w-full">
      <Text
        className="text-sm text-gray-600 mb-2 text-left"
        style={styles.labelText}
      >
        {passwordLabel}
      </Text>
      <View className="flex-row items-center bg-input-background rounded-lg border border-gray-300">
        <ReusableTextInput
          value={password}
          onChangeText={setPassword}
          placeholder={passwordPlaceholder}
          secureTextEntry={!isPasswordVisible}
        />
        <TouchableOpacity onPress={togglePasswordVisibility} className="p-3">
          <PasswordVisibilityIcon visible={isPasswordVisible} />
        </TouchableOpacity>
      </View>
      {errorMessage && <Error message={errorMessage} />}
    </View>
  );
};

export default UserPasswordInput;
