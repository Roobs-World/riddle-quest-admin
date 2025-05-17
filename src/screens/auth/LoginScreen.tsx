import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
} from "react-native";
import BackIcon from "../../components/icons/BackIcon";
import PasswordVisibilityIcon from "../../components/icons/PasswordVisibilityIcon";
import CustomSafeAreaView from "../../components/CustomSafeAreaView";
import { AppStrings } from "../../constants/AppStrings";
import WideButton from "../../components/buttons/WideButton";

const LoginScreen = ({ navigation }: { navigation: any }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  return (
    <CustomSafeAreaView>
      <TouchableOpacity
        onPress={() => navigation.goBack()}
        className="mb-8 self-start"
      >
        <BackIcon />
      </TouchableOpacity>

      <Text className="text-3xl font-bold text-gray-800 mb-8">
        {AppStrings.AuthStrings.Login.TITLE}
      </Text>

      <Text className="text-sm text-gray-600 mb-1">
        {AppStrings.AuthStrings.Login.EMAIL_LABEL}
      </Text>
      <TextInput
        className="bg-[#F8F5EE] border border-gray-300 text-gray-700 p-3 rounded-lg mb-4 text-base"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        placeholder={AppStrings.AuthStrings.Login.EMAIL_PLACEHOLDER}
      />

      <Text className="text-sm text-gray-600 mb-1">
        {AppStrings.AuthStrings.Login.PASSWORD_LABEL}
      </Text>
      <View className="flex-row items-center bg-white border border-gray-300 rounded-lg mb-2 overflow-hidden">
        <TextInput
          className="flex-1 text-gray-700 p-3 text-base"
          value={password}
          onChangeText={setPassword}
          secureTextEntry={!isPasswordVisible}
          placeholder={AppStrings.AuthStrings.Login.PASSWORD_PLACEHOLDER}
        />
        <TouchableOpacity
          onPress={() => setIsPasswordVisible(!isPasswordVisible)}
          className="p-3"
        >
          <PasswordVisibilityIcon visible={isPasswordVisible} />
        </TouchableOpacity>
      </View>
      <TouchableOpacity className="self-end mb-8">
        <Text className="text-sm text-gray-500 font-medium">
          {AppStrings.AuthStrings.Login.FORGOT_PASSWORD}
        </Text>
      </TouchableOpacity>

      <WideButton
        onPress={() => console.log("Log in pressed")} // Replace with actual login logic
        buttonText={AppStrings.AuthStrings.Login.LOGIN_BUTTON}
      />

      <View className="flex-row items-center justify-center">
        <Text className="text-sm text-gray-600">
          {AppStrings.AuthStrings.Login.NO_ACCOUNT_PROMPT}
        </Text>
        <TouchableOpacity
          onPress={() => navigation.navigate(AppStrings.Navigation.SIGN_UP)}
        >
          <Text className="text-sm text-red-500 font-semibold">
            {AppStrings.AuthStrings.Login.REGISTER_NOW}
          </Text>
        </TouchableOpacity>
      </View>
    </CustomSafeAreaView>
  );
};

export default LoginScreen;
