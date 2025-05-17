import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ScrollView,
} from "react-native";
import ProgressBar from "../../components/shared/ProgressBar";
import BackIcon from "../../components/icons/BackIcon";
import PasswordVisibilityIcon from "../../components/icons/PasswordVisibilityIcon";
import CheckboxIcon from "../../components/icons/CheckboxIcon";
import CustomSafeAreaView from "../../components/CustomSafeAreaView";
import { AppStrings } from "../../constants/AppStrings";
import ScreenTitle from "../../components/shared/ScreenTitle";
import WideButton from "../../components/buttons/WideButton";
import AuthLayout from "../../components/layouts/AuthLayout";

const SignUpScreen = ({ navigation }: { navigation: any }) => {
  const [username, setUsername] = useState("Jane Doe");
  const [email, setEmail] = useState("janDoe@gmail.com");
  const [password, setPassword] = useState("************");
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
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

        <Text className="text-sm text-gray-600 mb-1">
          {AppStrings.AuthStrings.SignUp.USERNAME_LABEL}
        </Text>
        <TextInput
          className="bg-white border border-gray-300 text-gray-700 p-3 rounded-lg mb-4 text-base"
          value={username}
          onChangeText={setUsername}
          placeholder={AppStrings.AuthStrings.SignUp.USERNAME_PLACEHOLDER}
        />

        <Text className="text-sm text-gray-600 mb-1">
          {AppStrings.AuthStrings.SignUp.EMAIL_LABEL}
        </Text>
        <TextInput
          className="bg-white border border-gray-300 text-gray-700 p-3 rounded-lg mb-4 text-base"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          placeholder={AppStrings.AuthStrings.SignUp.EMAIL_PLACEHOLDER}
        />

        <Text className="text-sm text-gray-600 mb-1">
          {AppStrings.AuthStrings.SignUp.PASSWORD_LABEL}
        </Text>
        <View className="flex-row items-center bg-white border border-gray-300 rounded-lg mb-1 overflow-hidden">
          <TextInput
            className="flex-1 text-gray-700 p-3 text-base"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!isPasswordVisible}
            placeholder={AppStrings.AuthStrings.SignUp.PASSWORD_PLACEHOLDER}
          />
          <TouchableOpacity
            onPress={() => setIsPasswordVisible(!isPasswordVisible)}
            className="p-3"
          >
            <PasswordVisibilityIcon visible={isPasswordVisible} />
          </TouchableOpacity>
        </View>
        {/* "Looks Good" validation message - logic to be added */}
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
            <Text className="text-primary-orange font-semibold">
              {AppStrings.AuthStrings.SignUp.TERMS_USER_AGREEMENT}
            </Text>{" "}
            {AppStrings.AuthStrings.SignUp.TERMS_AGREEMENT_PART2}
            <Text className="text-primary-orange font-semibold">
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

// Ensure primary-orange and cream-light are defined in your tailwind.config.js
// e.g., primary-orange: '#FDBA74', cream-light: '#FAF3E0'

export default SignUpScreen;
