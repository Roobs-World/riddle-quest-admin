import React, { useState } from "react";
import { View, Text, TouchableOpacity, Image, ScrollView } from "react-native";
import CustomSafeAreaView from "../../components/CustomSafeAreaView";
import { AppStrings } from "../../constants/AppStrings";
import WideButton from "../../components/buttons/WideButton";
import ScreenTitle from "../../components/text/ScreenTitle";
import AuthLayout from "../../components/layouts/AuthLayout";
import UserEmailInput from "../../components/inputFields/UserEmailInput";
import UserPasswordInput from "../../components/inputFields/UserPasswordInput";
import BackButton from "../../components/buttons/BackButton";
import { AuthService } from "../../services/AuthService";
import { useAuth } from "../../contexts/AuthContext";
import Error from "../../components/text/Error";

import GoogleSignInButton from "../../components/buttons/GoogleSignInButton";
import FacebookSignInButton from "../../components/buttons/FacebookSignInButton";
import { loginSchema, LoginFormData } from "../../validation/authSchemas";
import { ZodError, ZodFormattedError } from "zod";

/**
 * Login screen for the authentication flow.
 * Allows users to sign in with their email and password.
 *
 * @param {object} navigation - The navigation prop from React Navigation.
 */
const LoginScreen = ({ navigation }: { navigation: any }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const { login } = useAuth();

  const [authError, setAuthError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

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
        const firebaseError = error as any;
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
      <BackButton navigation={navigation} />

      <AuthLayout>
        <ScreenTitle title={AppStrings.AuthStrings.Login.TITLE} />

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
          className="self-end mb-8"
          onPress={() =>
            navigation.navigate(AppStrings.Navigation.FORGOT_PASSWORD)
          }
        >
          <Text
            className="text-sm text-gray-500"
            style={{ fontFamily: "Poppins" }}
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
        <GoogleSignInButton
          onPress={async () => {
            setAuthError("");
            setEmailError("");
            setPasswordError("");
            try {
              const userCredential = await AuthService.signInWithGoogle();
              console.log("Google login success:", userCredential);
              if (userCredential.user?.uid) {
                login(userCredential.user.uid);
              }
            } catch (error: any) {
              console.error("Google login error:", error);
              switch (error.code) {
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
                    error.message ||
                      "An unexpected error occurred during Google login."
                  );
              }
            }
          }}
        />
        <FacebookSignInButton
          onPress={async () => {
            setAuthError("");
            setEmailError("");
            setPasswordError("");
            try {
              const userCredential = await AuthService.signInWithFacebook();
              console.log("Facebook login success:", userCredential);
              if (userCredential.user?.uid) {
                login(userCredential.user.uid);
              }
            } catch (error: any) {
              console.error("Facebook login error:", error);
              switch (error.code) {
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
                    error.message ||
                      "An unexpected error occurred during Facebook login."
                  );
              }
            }
          }}
        />
      </View>

      <View className="flex-row items-center justify-center mt-6">
        <Text className="text-sm text-gray-600">
          {AppStrings.AuthStrings.Login.NO_ACCOUNT_PROMPT}
        </Text>
        <TouchableOpacity
          onPress={() => navigation.navigate(AppStrings.Navigation.SIGN_UP)}
        >
          <Text className="text-sm text-red-500 font-semibold">
            {AppStrings.AuthStrings.Login.REGISTER_NOW}
          </Text>
        </TouchableOpacity>
      </View>
    </CustomSafeAreaView>
  );
};

export default LoginScreen;
