import { View, Text, TouchableOpacity, Image } from "react-native";
import React from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import ReusableTextInput from "../../components/ReusableTextInput";
import ScreenTitle from "../../components/text/ScreenTitle";
import PadlockIcon from "../../../assets/images/padlock.svg";
import WideButton from "../../components/buttons/WideButton";

const ForgotPasswordScreen = () => {
  const navigation = useNavigation();
  const [email, setEmail] = React.useState("");

  const handleResetPassword = () => {
    console.log("Reset password for:", email);
  };

  return (
    <SafeAreaView className="flex-1 bg-cream-light p-6">
      <View className="flex-1 justify-center items-center">
        <PadlockIcon className="w-24 h-24 mb-8" />
        <ScreenTitle title="Forgot Password" />
        <Text className="text-center text-gray-700 mb-8">
          Enter your email address to receive a password reset link.
        </Text>

        <View className="w-full mb-4">
          <ReusableTextInput
            placeholder="Enter your email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </View>

        <WideButton onPress={handleResetPassword} buttonText="Reset Password" />

        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text className="text-primary-orange underline">Back to Login</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

export default ForgotPasswordScreen;
