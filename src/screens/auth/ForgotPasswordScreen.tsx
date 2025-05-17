import { View, Text, TouchableOpacity, Image } from "react-native";
import React from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import ReusableTextInput from "../../components/ReusableTextInput";
import ScreenTitle from "../../components/text/ScreenTitle";
import PadlockIcon from "../../../assets/images/padlock.svg";
import WideButton from "../../components/buttons/WideButton";
import BackButton from "../../components/buttons/BackButton";
import AuthLayout from "../../components/layouts/AuthLayout";
import UserEmailInput from "../../components/inputFields/UserEmailInput";

const ForgotPasswordScreen = () => {
  const navigation = useNavigation();
  const [email, setEmail] = React.useState("");

  const handleResetPassword = () => {
    console.log("Reset password for:", email);
  };

  return (
    <SafeAreaView className="flex-1 bg-cream-light p-6">
      <BackButton navigation={navigation} />
      <AuthLayout>
        <PadlockIcon className="w-24 h-24 mb-8 mx-auto" />
        <ScreenTitle title="Forgot Password?" className="text-center" />
        <Text className="text-left text-gray-700 mb-8">
          Enter your email address to receive a password reset link.
        </Text>

        <UserEmailInput email={email} setEmail={setEmail} />
      </AuthLayout>

      <WideButton onPress={handleResetPassword} buttonText="Reset Password" />

      <TouchableOpacity onPress={() => navigation.goBack()}>
        <Text className="text-primary-orange underline text-center">
          Back to Login
        </Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
};

export default ForgotPasswordScreen;
