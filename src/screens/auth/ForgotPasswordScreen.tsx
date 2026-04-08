import { Text, TouchableOpacity } from "react-native";
import React, { useState } from "react";
import PadlockIcon from "@images/padlock.svg";
import SafeAreaView from "../../components/layouts/CustomSafeAreaView";
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
import StarryBackground from "../../components/background/StarryBackground";
import PulsingSpinner from "../../components/loading/PulsingSpinner";
import { LOADING_SPINNER_SIZE } from "../../constants/loading";
import { SPACING } from "../../styles";
import { AUTH_ICON_SIZE } from "../../constants/layout";
import { logger } from "../../utils/logger";
import { captureException } from "../../utils/sentry";

type RootStackParamList = {
  Landing: object | undefined;
  Login: object | undefined;
  SignUp: object | undefined;
  ForgotPassword: object | undefined;
  NewPassword: object | undefined;
  Game: object | undefined;
  Credits: object | undefined;
};

interface ForgotPasswordScreenProps {
  navigation: NativeStackNavigationProp<RootStackParamList>;
}

const ForgotPasswordScreen = ({ navigation }: ForgotPasswordScreenProps) => {
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string>("");
  const [generalError, setGeneralError] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);

  /**
   * Handles the password reset flow by validating the email and delegating
   * to `AuthService.sendPasswordResetEmail`, surfacing any Firebase errors
   * to the user via inline messaging.
   */
  const handleResetPassword = async () => {
    logger.debug("Password reset requested for email:", email);

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
      logger.debug("Password reset email sent successfully.");
    } catch (error) {
      const firebaseError = error as FirebaseAuthTypes.NativeFirebaseAuthError;
      logger.error("Password reset error:", firebaseError);
      captureException(error);

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
    <SafeAreaView className="flex-1 bg-cream-light" style={{ padding: SPACING.lg }}>
      <StarryBackground />
      <BackButton navigation={navigation} />
      <AuthLayout>
        <PadlockIcon width={AUTH_ICON_SIZE} height={AUTH_ICON_SIZE} />
        <ScreenTitle title="Reset Password" />
        <UserEmailInput
          email={email}
          setEmail={setEmail}
          errorMessage={emailError}
        />
        {successMessage && (
          <Text className="text-green-400 text-center">{successMessage}</Text>
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
        style={{ marginTop: SPACING.md }}
      >
        <Text className="text-center text-blue-300 underline">
          Back to Login
        </Text>
      </TouchableOpacity>

      <PulsingSpinner visible={isLoading} size={LOADING_SPINNER_SIZE} />
    </SafeAreaView>
  );
};

export default ForgotPasswordScreen;
