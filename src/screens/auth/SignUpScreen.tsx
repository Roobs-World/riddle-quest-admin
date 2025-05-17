import React, { useState } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import ProgressBar from "../../components/shared/ProgressBar";
import BackIcon from "../../components/icons/BackIcon";
import CheckboxIcon from "../../components/icons/CheckboxIcon";
import CustomSafeAreaView from "../../components/CustomSafeAreaView";
import { AppStrings } from "../../constants/AppStrings";
import ScreenTitle from "../../components/shared/ScreenTitle";
import WideButton from "../../components/buttons/WideButton";
import AuthLayout from "../../components/layouts/AuthLayout";
import ReusableTextInput from "../../components/ReusableTextInput";
import UserEmailInput from "../../components/inputFields/UserEmailInput";
import UserPasswordInput from "../../components/inputFields/UserPasswordInput";
import UserUsernameInput from "../../components/inputFields/UserUsernameInput";

const SignUpScreen = ({ navigation }: { navigation: any }) => {
  const [username, setUsername] = useState("Jane Doe");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [agreedToTerms, setAgreedToTerms] = useState(true);

  return (
    <CustomSafeAreaView>
      <TouchableOpacity
        onPress={() => navigation.goBack()}
        className="self-start"
      >
        <BackIcon />
      </TouchableOpacity>

      <AuthLayout>
        <ProgressBar activeStep={1} totalSteps={3} />

        <ScreenTitle title={AppStrings.AuthStrings.SignUp.TITLE} />

        <UserUsernameInput username={username} setUsername={setUsername} />

        <UserEmailInput email={email} setEmail={setEmail} />

        <UserPasswordInput password={password} setPassword={setPassword} />

        <UserPasswordInput
          label={AppStrings.AuthStrings.SignUp.CONFIRM_PASSWORD_LABEL}
          password={confirmPassword}
          setPassword={setConfirmPassword}
        />

        <Text className="text-xs text-green-600 ml-1 mb-4">
          {AppStrings.AuthStrings.SignUp.PASSWORD_VALIDATION_GOOD}
        </Text>

        <TouchableOpacity
          className="flex-row items-center mb-6"
          onPress={() => setAgreedToTerms(!agreedToTerms)}
        >
          <CheckboxIcon checked={agreedToTerms} />
          <Text className="text-sm text-gray-600 flex-1">
            {AppStrings.AuthStrings.SignUp.TERMS_AGREEMENT_PART1}
            <Text className="text-red-500 font-semibold">
              {AppStrings.AuthStrings.SignUp.TERMS_USER_AGREEMENT}
            </Text>{" "}
            {AppStrings.AuthStrings.SignUp.TERMS_AGREEMENT_PART2}
            <Text className="text-red-500 font-semibold">
              {AppStrings.AuthStrings.SignUp.TERMS_PRIVACY_POLICY}
            </Text>
          </Text>
        </TouchableOpacity>

        <WideButton
          onPress={() => console.log("Sign up pressed")} // Replace with actual sign up logic
          buttonText={AppStrings.AuthStrings.SignUp.NEXT_BUTTON}
        />

        <View className="flex-row items-center justify-center">
          <Text className="text-sm text-gray-600">
            {AppStrings.AuthStrings.SignUp.HAS_ACCOUNT_PROMPT}{" "}
          </Text>
          <TouchableOpacity
            onPress={() => navigation.navigate(AppStrings.Navigation.LOGIN)}
          >
            <Text className="text-sm text-red-500 font-semibold">
              {AppStrings.AuthStrings.SignUp.LOGIN_NOW}
            </Text>
          </TouchableOpacity>
        </View>
      </AuthLayout>
    </CustomSafeAreaView>
  );
};

export default SignUpScreen;
