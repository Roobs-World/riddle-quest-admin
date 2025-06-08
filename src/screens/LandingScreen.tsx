import React, { useState } from "react";
import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import CustomSafeAreaView from "../components/layouts/CustomSafeAreaView";
import GoogleSignInButton from "../components/buttons/GoogleSignInButton";
import FacebookSignInButton from "../components/buttons/FacebookSignInButton";
import WideButton from "../components/buttons/WideButton";
import HomeBgSvg from "../../assets/images/home-bg.svg";
import SignUpButton from "../components/buttons/SignUpButton";
import PulsingSpinner from "../components/loading/PulsingSpinner";
import { AppStrings } from "../constants/AppStrings";
import Subtitle from "../components/text/Subtitle";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { AuthService } from "../services/AuthService";
import { useAuth } from "../contexts/AuthContext";
import Error from "../components/text/Error";
import { type FirebaseAuthTypes } from "@react-native-firebase/auth";
import { styles } from "../styles";

type RootStackParamList = {
  Landing: undefined;
  Login: undefined;
  SignUp: undefined;
  ForgotPassword: undefined;
  NewPassword: undefined;
  Game: undefined;
  Credits: undefined;
};

type LandingScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  "Landing"
>;

/**
 * Landing screen for the authentication flow.
 * Allows users to navigate to sign in or sign up, or sign in with social providers.
 *
 * @param {object} navigation - The navigation prop from React Navigation.
 */
const LandingScreen = ({
  navigation,
}: {
  navigation: LandingScreenNavigationProp;
}) => {
  const [authError, setAuthError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setAuthError(null);

    try {
      const userCredential = await AuthService.signInWithGoogle();
      console.log("Google login success:", userCredential);
      if (userCredential.user?.uid) {
        login();
      }
    } catch (error) {
      const firebaseError = error as FirebaseAuthTypes.NativeFirebaseAuthError;
      console.error("Google login error:", firebaseError);
      switch (firebaseError.code) {
        case "auth/account-exists-with-different-credential":
          setAuthError(
            "Account exists with different credential. Please use a different login method."
          );
          break;
        case "auth/auth-popup-closed-by-user":
          console.log("Auth popup closed by user.");
          break;
        default:
          setAuthError(
            firebaseError.message ||
              "An unexpected error occurred during Google login."
          );
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleFacebookSignIn = async () => {
    setIsLoading(true);
    setAuthError(null);

    try {
      const userCredential = await AuthService.signInWithFacebook();
      console.log("Facebook login success:", userCredential);
      if (userCredential.user?.uid) {
        login();
      }
    } catch (error: unknown) {
      console.error("Facebook login error:", error);

      // Check if the error is a user cancellation first (more specific matching)
      if (error instanceof Error) {
        const errorMessage = (error as Error).message;

        // Check for exact cancellation messages
        if (
          errorMessage === "User cancelled the login process" ||
          errorMessage === "Facebook login cancelled."
        ) {
          console.log("Facebook login cancelled by user.");
          // Don't show error for cancellation - it's expected behavior
          return;
        }

        // Handle specific Facebook SDK errors
        if (errorMessage.includes("access token")) {
          console.error("Facebook access token error detected");
          setAuthError(
            "Facebook login configuration issue. Please try again or contact support."
          );
          return;
        }

        if (errorMessage.includes("Facebook permission request timed out")) {
          console.error("Facebook login timeout detected");
          setAuthError(
            "Facebook login timed out. This may indicate a configuration issue. Please try again."
          );
          return;
        }

        if (errorMessage.includes("Facebook SDK not properly initialized")) {
          console.error("Facebook SDK initialization error detected");
          setAuthError(
            "Facebook login is not properly configured. Please restart the app and try again."
          );
          return;
        }
      }

      // Handle Firebase auth errors
      if (error && typeof error === "object" && "code" in error) {
        const firebaseError =
          error as FirebaseAuthTypes.NativeFirebaseAuthError;
        switch (firebaseError.code) {
          case "auth/account-exists-with-different-credential":
            setAuthError(
              "Account exists with different credential. Please use a different login method."
            );
            break;
          case "auth/auth-popup-closed-by-user":
            console.log("Auth popup closed by user.");
            break;
          case "auth/operation-not-supported-in-this-environment":
            setAuthError(
              "Facebook login is not supported in this environment."
            );
            break;
          case "auth/network-request-failed":
            setAuthError(
              "Network error during Facebook login. Please check your connection and try again."
            );
            break;
          case "auth/invalid-credential":
            setAuthError("Invalid Facebook credentials. Please try again.");
            break;
          default:
            setAuthError(
              firebaseError.message ||
                "An unexpected error occurred during Facebook login."
            );
        }
      } else {
        // Handle other types of errors with better fallback
        const errorMessage =
          error instanceof Error
            ? (error as Error).message
            : "An unexpected error occurred during Facebook login.";

        console.error("Non-Firebase Facebook error:", errorMessage);
        setAuthError(errorMessage);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <CustomSafeAreaView className="justify-start">
      <HomeBgSvg width="120%" height="100%" style={styles.backgroundImage} />

      <ScrollView
        className="w-full"
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: "center",
          alignItems: "center",
          paddingVertical: 20,
        }}
        showsVerticalScrollIndicator={false}
      >
        <Text
          className="text-2xl font-bold text-gray-800 text-center mb-8"
          style={styles.title}
        >
          {AppStrings.AuthStrings.Landing.TAGLINE_1}
        </Text>
        <Subtitle text={AppStrings.AuthStrings.Landing.TAGLINE_2} />

        <WideButton
          buttonText={AppStrings.AuthStrings.Landing.SIGN_IN_BUTTON}
          onPress={() => navigation.navigate(AppStrings.Navigation.LOGIN)}
          disabled={isLoading}
        />

        <View className="flex-row items-center mt-4 mb-8">
          <View className="flex-1 h-px bg-gray-400 mr-2" />
          <Text className="text-sm text-black-400" style={styles.separatorText}>
            {AppStrings.AuthStrings.Landing.OR_SIGN_IN_WITH}
          </Text>
          <View className="flex-1 h-px bg-gray-400 ml-2" />
        </View>

        <GoogleSignInButton onPress={handleGoogleSignIn} disabled={isLoading} />

        <FacebookSignInButton
          onPress={handleFacebookSignIn}
          disabled={isLoading}
        />

        {authError && <Error message={authError} />}

        <View className="flex-row items-center mt-8">
          <View className="flex-1 h-px bg-gray-400 mr-2" />
          <Text className="text-sm text-black-400" style={styles.separatorText}>
            {AppStrings.AuthStrings.Landing.NO_ACCOUNT_PROMPT}{" "}
          </Text>
          <View className="flex-1 h-px bg-gray-400 ml-2" />
        </View>

        <SignUpButton
          onPress={() => navigation.navigate(AppStrings.Navigation.SIGN_UP)}
        />

        <TouchableOpacity
          onPress={() => navigation.navigate(AppStrings.Navigation.CREDITS)}
          className="mt-6 mb-4"
        >
          <Text
            className="text-center text-sm text-gray-500 underline"
            style={styles.creditsLink}
          >
            Credits
          </Text>
        </TouchableOpacity>
      </ScrollView>

      <PulsingSpinner visible={isLoading} size={120} />
    </CustomSafeAreaView>
  );
};

export default LandingScreen;
