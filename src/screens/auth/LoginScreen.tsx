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
import ScreenTitle from "../../components/shared/ScreenTitle";

const LoginScreen = ({ navigation }: { navigation: any }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isPasswordFocused, setIsPasswordFocused] = useState(false);

  return (
    <CustomSafeAreaView>
      <TouchableOpacity
        onPress={() => navigation.goBack()}
        className="self-start"
      >
        <BackIcon />
      </TouchableOpacity>

      <View className="flex-1 justify-center items-center w-full py-8">
        <ScreenTitle title={AppStrings.AuthStrings.Login.TITLE} />

        <View className="w-full">
          <Text
            className="text-sm text-gray-600 mb-2 text-left"
            style={{ fontFamily: "PoppinsSemiBold" }}
          >
            {AppStrings.AuthStrings.Login.EMAIL_LABEL}
          </Text>
        </View>
        <View className="flex-row items-center bg-[#F8F5EE] border border-gray-300 rounded-lg mb-2 overflow-hidden">
          <TextInput
            className="flex-1 text-gray-700 p-3 text-base font-poppins-regular h-12"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            placeholder={AppStrings.AuthStrings.Login.EMAIL_PLACEHOLDER}
          />
        </View>

        <View className="w-full">
          <Text
            className="text-sm text-gray-600 mb-2 text-left mt-4"
            style={{ fontFamily: "PoppinsSemiBold" }}
          >
            {AppStrings.AuthStrings.Login.PASSWORD_LABEL}
          </Text>
        </View>
        <View
          className={`flex-row items-center bg-[#F8F5EE] border ${
            isPasswordFocused ? "border-red-500" : "border-gray-300"
          } rounded-lg mb-2 overflow-hidden`}
        >
          <TextInput
            className="flex-1 text-gray-700 p-3 text-base font-poppins-regular h-12"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!isPasswordVisible}
            placeholder={AppStrings.AuthStrings.Login.PASSWORD_PLACEHOLDER}
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
        <TouchableOpacity className="self-end mb-8">
          <Text className="text-sm text-gray-500 font-medium">
            {AppStrings.AuthStrings.Login.FORGOT_PASSWORD}
          </Text>
        </TouchableOpacity>

        <WideButton
          onPress={() => console.log("Log in pressed")} // Replace with actual login logic
          buttonText={AppStrings.AuthStrings.Login.LOGIN_BUTTON}
        />

        <View className="flex-row items-center justify-center mt-6">
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
      </View>
    </CustomSafeAreaView>
  );
};

export default LoginScreen;
