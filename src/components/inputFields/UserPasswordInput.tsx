import { View, Text, TouchableOpacity } from "react-native";
import { AppStrings } from "../../constants/AppStrings";
import ReusableTextInput from "../ReusableTextInput";
import PasswordVisibilityIcon from "../icons/PasswordVisibilityIcon";
import { useState } from "react";

export default function UserPasswordInput({
  password,
  setPassword,
  label,
  placeholder,
}: {
  password: string;
  setPassword: (password: string) => void;
  label?: string;
  placeholder?: string;
}) {
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isPasswordFocused, setIsPasswordFocused] = useState(false);

  const passwordLabel = label || AppStrings.AuthStrings.Login.PASSWORD_LABEL;
  const passwordPlaceholder =
    placeholder || AppStrings.AuthStrings.Login.PASSWORD_PLACEHOLDER;

  return (
    <View className="w-full py-2">
      <Text
        className="text-sm text-gray-600 mb-2 text-left mt-4"
        style={{ fontFamily: "PoppinsSemiBold" }}
      >
        {passwordLabel}
      </Text>

      <View
        className={`flex-row items-center border ${
          isPasswordFocused ? "border-red-500" : "border-gray-300"
        } rounded-lg mb-2`}
      >
        <ReusableTextInput
          value={password}
          onChangeText={setPassword}
          secureTextEntry={!isPasswordVisible}
          placeholder={passwordPlaceholder}
          onFocus={() => setIsPasswordFocused(true)}
          onBlur={() => setIsPasswordFocused(false)}
        />
        <TouchableOpacity
          onPress={() => setIsPasswordVisible(!isPasswordVisible)}
          className="p-3"
        >
          <PasswordVisibilityIcon visible={isPasswordVisible} />
        </TouchableOpacity>
      </View>
    </View>
  );
}
