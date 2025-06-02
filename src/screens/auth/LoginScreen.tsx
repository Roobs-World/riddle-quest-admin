import React, { useState } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import CustomSafeAreaView from "../../components/layouts/CustomSafeAreaView";
import { AppStrings } from "../../constants/AppStrings";
import ScreenTitle from "../../components/text/ScreenTitle";
import AuthLayout from "../../components/layouts/AuthLayout";
import BackButton from "../../components/buttons/BackButton";
import UserEmailInput from "../../components/inputFields/UserEmailInput";
import UserPasswordInput from "../../components/inputFields/UserPasswordInput";
import WideButton from "../../components/buttons/WideButton";
import GoogleSignInButton from "../../components/buttons/GoogleSignInButton";
import FacebookSignInButton from "../../components/buttons/FacebookSignInButton";
import Error from "../../components/text/Error";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { AuthService } from "../../services/AuthService";
import { useAuth } from "../../contexts/AuthContext";
import PulsingSpinner from "../../components/loading/PulsingSpinner";
import { type FirebaseAuthTypes } from "@react-native-firebase/auth";
import HomeBgSvg from "../../../assets/images/home-bg.svg";
import { loginSchema, LoginFormData } from "../../validation/authSchemas";
import { ZodError, ZodFormattedError } from "zod";
import { styles } from "../../styles";

type AuthStackParamList = {
  Login: object | undefined;
  SignUp: object | undefined;
  ForgotPassword: object | undefined;
  Landing: object | undefined;
};

type LoginScreenNavigationProp = NativeStackNavigationProp<
  AuthStackParamList,
  "Login"
>;

/**
 * Login screen for the authentication flow.
 * Allows users to sign in with their email and password.
 *
 * @param {object} navigation - The navigation prop from React Navigation.
 */
const LoginScreen = ({
  navigation,
}: {
  navigation: LoginScreenNavigationProp;
}) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const { login } = useAuth();

  const [authError, setAuthError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setAuthError("");
    setEmailError("");
    setPasswordError("");

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
            AppStrings.AuthStrings.Login
              .ACCOUNT_EXISTS_WITH_DIFFERENT_CREDENTIAL
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
    setAuthError("");
    setEmailError("");
    setPasswordError("");

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
            AppStrings.AuthStrings.Login
              .ACCOUNT_EXISTS_WITH_DIFFERENT_CREDENTIAL
          );
          break;
        case "auth/auth-popup-closed-by-user":
          console.log("Auth popup closed by user.");
          break;
        case "auth/operation-not-supported-in-this-environment":
          setAuthError(
            AppStrings.AuthStrings.Login.OPERATION_NOT_SUPPORTED_ERROR
          );
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

  const handleLogin = async () => {
    setIsLoading(true);
    setEmailError(null);
    setPasswordError(null);
    setAuthError(null);

    try {
      loginSchema.parse({ email, password });

      await AuthService.loginWithEmail(email, password);
    } catch (error) {
      if (error instanceof ZodError) {
        const formattedErrors: ZodFormattedError<LoginFormData> =
          error.format();
        if (formattedErrors.email?._errors) {
          setEmailError(formattedErrors.email._errors[0]);
        }
        if (formattedErrors.password?._errors) {
          setPasswordError(formattedErrors.password._errors[0]);
        }
      } else if (error && typeof error === "object" && "code" in error) {
        const firebaseError =
          error as FirebaseAuthTypes.NativeFirebaseAuthError;
        console.error("Firebase login error:", firebaseError);
        switch (firebaseError.code) {
          case "auth/user-not-found":
            setEmailError(AppStrings.AuthStrings.Login.USER_NOT_FOUND_ERROR);
            break;
          case "auth/wrong-password":
            setPasswordError(AppStrings.AuthStrings.Login.WRONG_PASSWORD_ERROR);
            break;
          case "auth/invalid-email":
            setEmailError(
              AppStrings.AuthStrings.Login.INVALID_EMAIL_FORMAT_ERROR
            );
            break;
          case "auth/user-disabled":
            setAuthError(AppStrings.AuthStrings.Login.USER_DISABLED_ERROR);
            break;
          default:
            setAuthError(
              firebaseError.message ||
                AppStrings.AuthStrings.Login.LOGIN_FAILED_GENERIC
            );
        }
      } else {
        console.error("Unexpected login error:", error);
        setAuthError(AppStrings.AuthStrings.Login.LOGIN_FAILED_GENERIC);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <CustomSafeAreaView>
      <HomeBgSvg width="120%" height="100%" style={styles.backgroundImage} />

      <AuthLayout>
        <View className="relative w-full mb-8">
          <BackButton navigation={navigation} />
          <ScreenTitle
            title={AppStrings.AuthStrings.Login.TITLE}
            className="mt-7"
          />
        </View>

        <UserEmailInput
          email={email}
          setEmail={(text) => {
            setEmail(text);
            setEmailError("");
          }}
          errorMessage={emailError}
        />

        <UserPasswordInput
          password={password}
          setPassword={(text) => {
            setPassword(text);
            setPasswordError("");
          }}
          errorMessage={passwordError}
        />

        <TouchableOpacity
          className="self-center"
          onPress={() =>
            navigation.navigate(AppStrings.Navigation.FORGOT_PASSWORD)
          }
        >
          <Text
            className="text-sm text-black"
            style={styles.forgotPasswordText}
          >
            {AppStrings.AuthStrings.Login.FORGOT_PASSWORD}
          </Text>
        </TouchableOpacity>
      </AuthLayout>

      <WideButton
        buttonText={AppStrings.AuthStrings.Login.LOGIN_BUTTON}
        onPress={handleLogin}
        disabled={isLoading}
      />

      {authError && <Error message={authError} />}

      <View className="mt-8 w-full items-center">
        <Text className="text-center text-gray-500 mb-4">
          {AppStrings.AuthStrings.Login.OR_LOGIN_WITH}
        </Text>
        <GoogleSignInButton onPress={handleGoogleSignIn} disabled={isLoading} />
        <FacebookSignInButton
          onPress={handleFacebookSignIn}
          disabled={isLoading}
        />
      </View>

      <View className="flex-row items-center justify-center mt-6">
        <Text className="text-sm text-gray-600">
          {AppStrings.AuthStrings.Login.NO_ACCOUNT_PROMPT}
        </Text>
        <TouchableOpacity
          onPress={() => navigation.navigate(AppStrings.Navigation.SIGN_UP)}
        >
          <Text className="text-sm text-blue-600 font-semibold">
            {AppStrings.AuthStrings.Login.REGISTER_NOW}
          </Text>
        </TouchableOpacity>
      </View>

      <PulsingSpinner visible={isLoading} size={120} />
    </CustomSafeAreaView>
  );
};

export default LoginScreen;
