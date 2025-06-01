import { Text, StyleSheet, TouchableOpacity } from "react-native";
import React, { useState } from "react";
import PadlockIcon from "@images/padlock.svg";
import SafeAreaView from "../../components/CustomSafeAreaView";
import AuthLayout from "../../components/layouts/AuthLayout";
import { AuthService } from "../../services/AuthService";
import { validateEmail } from "../../utils/emailValidation";
import BackButton from "../../components/buttons/BackButton";
import ScreenTitle from "../../components/text/ScreenTitle";
import UserEmailInput from "../../components/inputFields/UserEmailInput";
import WideButton from "../../components/buttons/WideButton";
import { AppStrings } from "../../constants/AppStrings";
import Error from "../../components/text/Error";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { type FirebaseAuthTypes } from "@react-native-firebase/auth";
import HomeBgSvg from "../../../assets/images/home-bg.svg";
import PulsingSpinner from "../../components/PulsingSpinner";

/**
 * Forgot password screen for the authentication flow.
 */

type RootStackParamList = {
  Landing: undefined;
  Login: undefined;
  SignUp: undefined;
  ForgotPassword: undefined;
  NewPassword: undefined;
  Game: undefined;
  Credits: undefined;
};

type ForgotPasswordScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  "ForgotPassword"
>;

const ForgotPasswordScreen = ({
  navigation,
}: {
  navigation: ForgotPasswordScreenNavigationProp;
}) => {
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string>("");
  const [generalError, setGeneralError] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);

  /**
   * Handles the password reset flow.
   */
  const handleResetPassword = async () => {
    console.log("Password reset requested for email:", email);

    setEmailError(null);
    setSuccessMessage("");
    setGeneralError("");
    setIsLoading(true);

    const emailValidationError = validateEmail(email);
    setEmailError(emailValidationError);

    if (emailValidationError) {
      setIsLoading(false);
      return;
    }

    try {
      await AuthService.sendPasswordResetEmail(email);
      setSuccessMessage("Password reset email sent! Check your inbox.");
      console.log("Password reset email sent successfully.");
    } catch (error) {
      const firebaseError = error as FirebaseAuthTypes.NativeFirebaseAuthError;
      console.error("Password reset error:", firebaseError);

      // Handle specific Firebase errors
      if (firebaseError.code === "auth/user-not-found") {
        setGeneralError(
          "No account found with this email address. Please check your email or sign up for a new account."
        );
      } else {
        setGeneralError(
          firebaseError.message ||
            "An error occurred while sending the reset email. Please try again."
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-cream-light p-6">
      <HomeBgSvg width="120%" height="100%" style={styles.backgroundImage} />
      <BackButton navigation={navigation} />
      <AuthLayout>
        <PadlockIcon width={80} height={80} />
        <ScreenTitle title="Reset Password" />
        <UserEmailInput
          email={email}
          setEmail={setEmail}
          errorMessage={emailError}
        />
        {successMessage && (
          <Text className="text-green-500 text-center">{successMessage}</Text>
        )}
        {generalError && <Error message={generalError} />}
      </AuthLayout>

      <WideButton
        buttonText="Reset Password"
        onPress={handleResetPassword}
        disabled={isLoading}
      />

      <TouchableOpacity
        onPress={() => navigation.navigate(AppStrings.Navigation.LOGIN)}
        className="mt-4"
      >
        <Text className="text-center text-blue-500 underline">
          Back to Login
        </Text>
      </TouchableOpacity>

      <PulsingSpinner visible={isLoading} size={120} />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  backgroundImage: {
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
    top: "-5%",
    zIndex: -1,
  },
});

export default ForgotPasswordScreen;
