/**
 * @fileoverview
 * Email/password and social login screen for Riddle Quest.
 *
 * This screen allows existing users to authenticate via email + password
 * or via Google/Facebook OAuth, handling validation, error messaging, and
 * navigation to password reset and registration flows.
 */
import React, { useState } from "react";
import { View, Text, TouchableOpacity, ScrollView } from "react-native";
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
import TwitterSignInButton from "../../components/buttons/TwitterSignInButton";
import Error from "../../components/text/Error";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  AuthService,
  isFacebookLoginCancellation,
} from "../../services/AuthService";
import { useAuth } from "../../contexts/AuthContext";
import PulsingSpinner from "../../components/loading/PulsingSpinner";
import { LOADING_SPINNER_SIZE } from "../../constants/loading";
import { type FirebaseAuthTypes } from "@react-native-firebase/auth";
import StarryBackground from "../../components/background/StarryBackground";
import { loginSchema, LoginFormData } from "../../validation/authSchemas";
import { ZodError, ZodFormattedError } from "zod";
import { styles, SPACING, TYPOGRAPHY } from "../../styles";
import { dimensions, verticalScale } from "../../utils/responsive";
import { logger } from "../../utils/logger";
import { captureException } from "../../utils/sentry";

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
 * Login screen component for the authentication flow.
 *
 * Validates user credentials with Zod, calls `AuthService` to perform
 * Firebase Auth sign-in, and on success delegates to `AuthContext` to
 * drive the rest of the app. Also exposes Google and Facebook login
 * options and routes to the password reset and sign-up screens.
 *
 * @param navigation React Navigation stack navigation prop.
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
  const isWideAuthLayout =
    dimensions.screenWidth >= 760 &&
    dimensions.screenWidth > dimensions.screenHeight;
  const wideAuthLayoutMaxWidth = Math.min(
    dimensions.screenWidth - SPACING.lg * 2,
    760
  );

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setAuthError("");
    setEmailError("");
    setPasswordError("");

    try {
      const userCredential = await AuthService.signInWithGoogle();
      logger.debug("Google login success:", userCredential);
      if (userCredential.user?.uid) {
        login();
      }
    } catch (error) {
      const firebaseError = error as FirebaseAuthTypes.NativeFirebaseAuthError;
      logger.error("Google login error:", firebaseError);
      captureException(error);
      switch (firebaseError.code) {
        case "auth/account-exists-with-different-credential":
          setAuthError(
            AppStrings.AuthStrings.Login
              .ACCOUNT_EXISTS_WITH_DIFFERENT_CREDENTIAL
          );
          break;
        case "auth/auth-popup-closed-by-user":
          logger.debug("Auth popup closed by user.");
          break;
        default:
          setAuthError(
            firebaseError.message ||
              AppStrings.AuthStrings.Login.GOOGLE_UNEXPECTED_ERROR
          );
      }
    } finally {
      setIsLoading(false);
    }
  };

  /* istanbul ignore next */
  const handleTwitterSignIn = async () => {
    setIsLoading(true);
    setAuthError("");
    setEmailError("");
    setPasswordError("");

    try {
      const userCredential = await AuthService.signInWithTwitter();
      logger.debug("Twitter login success:", userCredential);
      if (userCredential.user?.uid) {
        login();
      }
    } catch (error) {
      const firebaseError = error as FirebaseAuthTypes.NativeFirebaseAuthError;
      logger.error("Twitter login error:", firebaseError);
      captureException(error);
      switch (firebaseError.code) {
        case "auth/account-exists-with-different-credential":
          setAuthError(
            AppStrings.AuthStrings.Login.ACCOUNT_EXISTS_WITH_DIFFERENT_CREDENTIAL
          );
          break;
        case "auth/auth-popup-closed-by-user":
        case "auth/cancelled-popup-request":
          logger.debug("Twitter auth cancelled by user.");
          break;
        default:
          setAuthError(
            firebaseError.message ||
              AppStrings.AuthStrings.Login.TWITTER_UNEXPECTED_ERROR
          );
      }
    } finally {
      setIsLoading(false);
    }
  };

  /* istanbul ignore next */
  const handleFacebookSignIn = async () => {
    setIsLoading(true);
    setAuthError("");
    setEmailError("");
    setPasswordError("");

    try {
      const userCredential = await AuthService.signInWithFacebook();
      logger.debug("Facebook login success:", userCredential);
      if (userCredential?.user?.uid) {
        login();
      }
    } catch (error: unknown) {
      if (isFacebookLoginCancellation(error)) {
        return;
      }

      logger.error("Facebook login error:", error);
      captureException(error);

      if (error instanceof Error) {
        const errorMessage = (error as Error).message;

        // Handle specific Facebook SDK errors
        if (errorMessage.includes("access token")) {
          logger.error("Facebook access token error detected");
          setAuthError(AppStrings.AuthStrings.Login.FACEBOOK_CONFIG_ERROR);
          return;
        }

        if (errorMessage.includes("Facebook permission request timed out")) {
          logger.error("Facebook login timeout detected");
          setAuthError(AppStrings.AuthStrings.Login.FACEBOOK_TIMEOUT_ERROR);
          return;
        }

        if (errorMessage.includes("Facebook SDK not properly initialized")) {
          logger.error("Facebook SDK initialization error detected");
          setAuthError(AppStrings.AuthStrings.Login.FACEBOOK_SDK_ERROR);
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
              AppStrings.AuthStrings.Login
                .ACCOUNT_EXISTS_WITH_DIFFERENT_CREDENTIAL
            );
            break;
          case "auth/auth-popup-closed-by-user":
            logger.debug("Auth popup closed by user.");
            break;
          case "auth/operation-not-supported-in-this-environment":
            setAuthError(
              AppStrings.AuthStrings.Login.OPERATION_NOT_SUPPORTED_ERROR
            );
            break;
          case "auth/network-request-failed":
            setAuthError(AppStrings.AuthStrings.Login.FACEBOOK_NETWORK_ERROR);
            break;
          case "auth/invalid-credential":
            setAuthError(AppStrings.AuthStrings.Login.FACEBOOK_INVALID_CREDENTIAL_ERROR);
            break;
          default:
            setAuthError(
              firebaseError.message ||
                AppStrings.AuthStrings.Login.FACEBOOK_UNEXPECTED_ERROR
            );
        }
      } else {
        // Handle other types of errors with better fallback
        const errorMessage =
          error instanceof Error
            ? (error as Error).message
            : AppStrings.AuthStrings.Login.FACEBOOK_UNEXPECTED_ERROR;

        logger.error("Non-Firebase Facebook error:", errorMessage);
        setAuthError(errorMessage);
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
        /* istanbul ignore next */
        if (formattedErrors.password?._errors) {
          setPasswordError(formattedErrors.password._errors[0]);
        }
      } else if (error && typeof error === "object" && "code" in error) {
        const firebaseError =
          error as FirebaseAuthTypes.NativeFirebaseAuthError;
        logger.error("Firebase login error:", firebaseError);
        captureException(error);
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
        logger.error("Unexpected login error:", error);
        captureException(error);
        setAuthError(AppStrings.AuthStrings.Login.LOGIN_FAILED_GENERIC);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <CustomSafeAreaView>
      <StarryBackground />

      <AuthLayout
        style={isWideAuthLayout ? { maxWidth: wideAuthLayoutMaxWidth } : undefined}
      >
        <ScrollView
          className="w-full"
          contentContainerStyle={{
            alignItems: "center",
            paddingBottom: isWideAuthLayout ? SPACING.md : SPACING.xl,
            paddingHorizontal: SPACING.md,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View
            className="relative w-full"
            style={{ marginBottom: isWideAuthLayout ? SPACING.lg : SPACING.xl }}
          >
            <BackButton navigation={navigation} />
            <View style={{ marginTop: verticalScale(28) }}>
              <ScreenTitle title={AppStrings.AuthStrings.Login.TITLE} />
            </View>
          </View>

          <View
            className="w-full"
            style={
              isWideAuthLayout
                ? { flexDirection: "row", alignItems: "flex-start" }
                : undefined
            }
          >
            <View
              className="w-full"
              style={
                isWideAuthLayout
                  ? { flex: 1, marginRight: SPACING.lg }
                  : undefined
              }
            >
              <View className="w-full" style={{ marginBottom: SPACING.md }}>
                <UserEmailInput
                  email={email}
                  setEmail={(text) => {
                    setEmail(text);
                    setEmailError("");
                  }}
                  errorMessage={emailError}
                />
              </View>

              <View className="w-full" style={{ marginBottom: SPACING.sm }}>
                <UserPasswordInput
                  password={password}
                  setPassword={(text) => {
                    setPassword(text);
                    setPasswordError("");
                  }}
                  errorMessage={passwordError}
                />
              </View>

              <TouchableOpacity
                className="self-center"
                onPress={() =>
                  navigation.navigate(AppStrings.Navigation.FORGOT_PASSWORD)
                }
                style={{ marginBottom: SPACING.md }}
              >
                <Text
                  className="text-white"
                  style={styles.forgotPasswordText}
                >
                  {AppStrings.AuthStrings.Login.FORGOT_PASSWORD}
                </Text>
              </TouchableOpacity>

              <View className="w-full" style={{ marginBottom: SPACING.md }}>
                <WideButton
                  buttonText={AppStrings.AuthStrings.Login.LOGIN_BUTTON}
                  onPress={handleLogin}
                  disabled={isLoading}
                />
              </View>

              {authError && <Error message={authError} />}
            </View>

            <View
              className="w-full items-center"
              style={
                isWideAuthLayout
                  ? { flex: 1 }
                  : { marginTop: SPACING.lg }
              }
            >
              <Text className="text-center text-white" style={{ marginBottom: SPACING.md }}>
                {AppStrings.AuthStrings.Login.OR_LOGIN_WITH}
              </Text>
              <View className="w-full" style={{ marginBottom: SPACING.md }}>
                <GoogleSignInButton onPress={handleGoogleSignIn} disabled={isLoading} />
              </View>
              <TwitterSignInButton onPress={handleTwitterSignIn} disabled={isLoading} />
              <FacebookSignInButton
                onPress={handleFacebookSignIn}
                disabled={isLoading}
              />

              <View
                className="flex-row items-center justify-center"
                style={{ marginTop: SPACING.lg }}
              >
                <Text className="text-white" style={{ fontSize: TYPOGRAPHY.fontSize.sm }}>
                  {AppStrings.AuthStrings.Login.NO_ACCOUNT_PROMPT}
                </Text>
                <TouchableOpacity
                  onPress={() => navigation.navigate(AppStrings.Navigation.SIGN_UP)}
                >
                  <Text className="text-blue-300 font-semibold" style={{ fontSize: TYPOGRAPHY.fontSize.sm }}>
                    {AppStrings.AuthStrings.Login.REGISTER_NOW}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </ScrollView>
      </AuthLayout>

      <PulsingSpinner visible={isLoading} size={LOADING_SPINNER_SIZE} />
    </CustomSafeAreaView>
  );
};

export default LoginScreen;
