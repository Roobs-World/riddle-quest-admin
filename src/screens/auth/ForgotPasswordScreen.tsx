import { Text } from "react-native";
import React, { useState } from "react";
import PadlockIcon from "@images/padlock.svg";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import ScreenTitle from "../../components/text/ScreenTitle";
import WideButton from "../../components/buttons/WideButton";
import BackButton from "../../components/buttons/BackButton";
import AuthLayout from "../../components/layouts/AuthLayout";
import UserEmailInput from "../../components/inputFields/UserEmailInput";
import { validateEmail } from "../../utils/emailValidation";
import { AuthService } from "../../services/AuthService";
import { AppStrings } from "../../constants/AppStrings";
import Error from "../../components/text/Error";
import { type FirebaseAuthTypes } from "@react-native-firebase/auth";
import HomeBgSvg from "../../../assets/images/home-bg.svg";
/**
 * Forgot password screen for the authentication flow.
 * Allows users to request a password reset link via email.
 */
const ForgotPasswordScreen = () => {
  const navigation = useNavigation();
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string>("");
  const [successMessage, setSuccessMessage] = useState<string>("");
  const [generalError, setGeneralError] = useState<string>("");

  /**
   * Handles the action of resetting the password.
   * Logs the email for which the password reset was requested.
   */
  const handleResetPassword = async () => {
    setEmailError("");
    setSuccessMessage("");
    setGeneralError("");

    const emailValidationError = validateEmail(email);
    setEmailError(emailValidationError);

    if (emailValidationError) {
      return;
    }

    try {
      await AuthService.sendPasswordResetEmail(email);
      console.log("Password reset email sent successfully to:", email);
      setSuccessMessage("Password reset link sent successfully to your email.");
    } catch (error) {
      const firebaseError = error as FirebaseAuthTypes.NativeFirebaseAuthError;
      console.error("Password reset email error:", firebaseError);
      switch (firebaseError.code) {
        case "auth/user-not-found":
          setEmailError(AppStrings.AuthStrings.Login.USER_NOT_FOUND_ERROR);
          break;
        case "auth/invalid-email":
          setEmailError(
            AppStrings.AuthStrings.Login.INVALID_EMAIL_FORMAT_ERROR
          );
          break;
        default:
          setGeneralError(
            firebaseError.message || "An unexpected error occurred."
          );
      }
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-cream-light p-6">
      <HomeBgSvg
        width="120%"
        height="100%"
        style={{
          position: "absolute",
          top: "-5%",
          left: 0,
          bottom: 0,
          right: 0,
          zIndex: -1,
        }}
      />
      <BackButton navigation={navigation} />
      <AuthLayout>
        <PadlockIcon className="w-24 h-24 mb-8 mx-auto" />
        <ScreenTitle title="Forgot Password?" className="text-center" />
        <Text className="text-left text-gray-700 mb-8">
          Enter your email address to receive a password reset link.
        </Text>

        <UserEmailInput
          email={email}
          setEmail={(text) => {
            setEmail(text);
            setEmailError("");
            setSuccessMessage("");
            setGeneralError("");
          }}
          errorMessage={emailError}
        />

        {successMessage ? (
          <Text className="text-green-600 mt-4 text-center">
            {successMessage}
          </Text>
        ) : null}
        {generalError ? <Error message={generalError} /> : null}
      </AuthLayout>

      <WideButton onPress={handleResetPassword} buttonText="Reset Password" />
    </SafeAreaView>
  );
};

export default ForgotPasswordScreen;
