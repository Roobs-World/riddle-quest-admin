import React, { useState } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import CustomSafeAreaView from "../components/layouts/CustomSafeAreaView";
import QwordlyLogo from "../components/logos/QwordlyLogo";
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
import { styles } from "../styles/styles";

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
    } catch (error) {
      const firebaseError = error as FirebaseAuthTypes.NativeFirebaseAuthError;
      console.error("Facebook login error:", firebaseError);
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
          setAuthError("Facebook login is not supported in this environment.");
          break;
        default:
          setAuthError(
            firebaseError.message ||
              "An unexpected error occurred during Facebook login."
          );
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <CustomSafeAreaView>
      <HomeBgSvg width="120%" height="100%" style={styles.backgroundImage} />

      <View className="mb-10">
        <QwordlyLogo />
      </View>

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

      <PulsingSpinner visible={isLoading} size={120} />
    </CustomSafeAreaView>
  );
};

export default LandingScreen;
