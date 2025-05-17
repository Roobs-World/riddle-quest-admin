import React, { useState } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import BackIcon from "../../components/icons/BackIcon";
import PasswordVisibilityIcon from "../../components/icons/PasswordVisibilityIcon";
import CustomSafeAreaView from "../../components/CustomSafeAreaView";
import { AppStrings } from "../../constants/AppStrings";
import WideButton from "../../components/buttons/WideButton";
import ScreenTitle from "../../components/shared/ScreenTitle";
import AuthLayout from "../../components/layouts/AuthLayout";
import ReusableTextInput from "../../components/ReusableTextInput";
import UserEmailInput from "../../components/inputFields/UserEmailInput";
import UserPasswordInput from "../../components/inputFields/UserPasswordInput";

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

      <AuthLayout>
        <ScreenTitle title={AppStrings.AuthStrings.Login.TITLE} />

        <UserEmailInput email={email} setEmail={setEmail} />

        <UserPasswordInput password={password} setPassword={setPassword} />

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
      </AuthLayout>
    </CustomSafeAreaView>
  );
};

export default LoginScreen;
