import React, { useState } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import CustomSafeAreaView from "../../components/CustomSafeAreaView";
import { AppStrings } from "../../constants/AppStrings";
import WideButton from "../../components/buttons/WideButton";
import ScreenTitle from "../../components/text/ScreenTitle";
import AuthLayout from "../../components/layouts/AuthLayout";
import UserEmailInput from "../../components/inputFields/UserEmailInput";
import UserPasswordInput from "../../components/inputFields/UserPasswordInput";
import BackButton from "../../components/buttons/BackButton";

const LoginScreen = ({ navigation }: { navigation: any }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <CustomSafeAreaView>
      <BackButton navigation={navigation} />

      <AuthLayout>
        <ScreenTitle title={AppStrings.AuthStrings.Login.TITLE} />

        <UserEmailInput email={email} setEmail={setEmail} />

        <UserPasswordInput password={password} setPassword={setPassword} />

        <TouchableOpacity
          className="self-end mb-8"
          onPress={() =>
            navigation.navigate(AppStrings.Navigation.FORGOT_PASSWORD)
          }
        >
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
