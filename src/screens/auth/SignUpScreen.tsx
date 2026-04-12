/* istanbul ignore file */
/**
 * @fileoverview
 * Account creation screen for Qwordly.
 *
 * This screen collects username, email, and password inputs, enforces
 * validation via Zod schemas, and requires users to agree to the terms
 * of service and privacy policy before attempting sign-up. On success
 * it delegates to `AuthService` to create the Firebase Auth account.
 */
import React, { useReducer, useState, useMemo, useCallback } from "react";
import { View, Text, TouchableOpacity, ScrollView, Linking, Alert } from "react-native";
import ProgressBar from "../../components/shared/ProgressBar";
import CheckboxIcon from "../../components/icons/CheckboxIcon";
import CustomSafeAreaView from "../../components/layouts/CustomSafeAreaView";
import { AppStrings } from "../../constants/AppStrings";
import ScreenTitle from "../../components/text/ScreenTitle";
import WideButton from "../../components/buttons/WideButton";
import AuthLayout from "../../components/layouts/AuthLayout";
import UserEmailInput from "../../components/inputFields/UserEmailInput";
import UserPasswordInput from "../../components/inputFields/UserPasswordInput";
import UserUsernameInput from "../../components/inputFields/UserUsernameInput";
import PasswordMatch from "../../components/text/PasswordMatch";
import Error from "../../components/text/Error";
import BackButton from "../../components/buttons/BackButton";
import PulsingSpinner from "../../components/loading/PulsingSpinner";
import { LOADING_SPINNER_SIZE } from "../../constants/loading";
import { AuthService } from "../../services/AuthService";
import { signUpSchema, SignUpFormData } from "../../validation/authSchemas";
import { ZodError, ZodFormattedError } from "zod";
import StarryBackground from "../../components/background/StarryBackground";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { styles, SPACING, TYPOGRAPHY } from "../../styles";
import { verticalScale } from "../../utils/responsive";
import { logger } from "../../utils/logger";
import { captureException } from "../../utils/sentry";

/**
 * Defines the structure of the password state managed by the reducer.
 * @property {string} password - The user's entered password.
 * @property {string} confirmPassword - The user's entered confirm password.
 * @property {boolean} passwordsMatch - Indicates if the password and confirm password match and the password is long enough.
 * @property {boolean} confirmPasswordHasInput - Indicates if the confirm password field has any input.
 * @property {boolean} isPasswordLongEnough - Indicates if the password meets the minimum length requirement.
 */
interface PasswordState {
  password: string;
  confirmPassword: string;
  passwordsMatch: boolean;
  confirmPasswordHasInput: boolean;
  isPasswordLongEnough: boolean;
}

/**
 * Defines the types of actions that can be dispatched to the password reducer.
 * @property {'SET_PASSWORD'} type - Action type for setting the password.
 * @property {string} payload - The password string.
 * @property {'SET_CONFIRM_PASSWORD'} type - Action type for setting the confirm password.
 * @property {string} payload - The confirm password string.
 */
type PasswordAction =
  | { type: "SET_PASSWORD"; payload: string }
  | { type: "SET_CONFIRM_PASSWORD"; payload: string };

/**
 * The initial state for the password reducer.
 */
const initialPasswordState: PasswordState = {
  password: "",
  confirmPassword: "",
  passwordsMatch: false,
  confirmPasswordHasInput: false,
  isPasswordLongEnough: true,
};

/**
 * Defines the structure of Firebase error objects
 */
interface FirebaseError {
  code: string;
  message: string;
}

/**
 * Navigation prop type for React Navigation
 */
type NavigationProp = NativeStackNavigationProp<
  Record<string, object | undefined>
>;

/**
 * Reducer function to manage the password state for sign-up.
 * Handles setting password and confirm password, and updating related validation flags.
 *
 * @param {PasswordState} state - The current password state.
 * @param {PasswordAction} action - The dispatched action.
 * @returns {PasswordState} The new password state.
 */
function passwordReducer(
  state: PasswordState,
  action: PasswordAction
): PasswordState {
  switch (action.type) {
    case "SET_PASSWORD": {
      const isPasswordLongEnough = action.payload.length >= 6;
      return {
        ...state,
        password: action.payload,
        passwordsMatch:
          action.payload === state.confirmPassword && isPasswordLongEnough,
        isPasswordLongEnough: isPasswordLongEnough,
      };
    }
    case "SET_CONFIRM_PASSWORD": {
      const confirmPasswordHasInput = action.payload.length > 0;
      return {
        ...state,
        confirmPassword: action.payload,
        passwordsMatch:
          state.password === action.payload && state.isPasswordLongEnough,
        confirmPasswordHasInput: confirmPasswordHasInput,
      };
    }
    default:
      return state;
  }
}

/**
 * Sign-up screen component for the authentication flow.
 *
 * Manages username/email/password form state, including password matching
 * and length checks via a reducer, applies Zod-based validation, and wires
 * in legal links for the terms of service and privacy policy. When the
 * form is valid and terms are accepted, it calls `AuthService.signUpWithEmail`.
 *
 * @param navigation React Navigation stack navigation prop.
 */
// URLs for legal pages - update these with your actual URLs
const TERMS_OF_SERVICE_URL = "https://qwordly.com/terms";
const PRIVACY_POLICY_URL = "https://qwordly.com/privacy";

const SignUpScreen = ({ navigation }: { navigation: NavigationProp }) => {
  const [username, setUsername] = useState("");
  const [passwordState, dispatch] = useReducer(
    passwordReducer,
    initialPasswordState
  );
  const [email, setEmail] = useState("");
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [confirmPasswordError, setConfirmPasswordError] = useState<
    string | null
  >(null);

  /**
   * Opens an external URL in the device's default browser.
   * Shows an error alert if the URL cannot be opened.
   */
  const openExternalUrl = useCallback(async (url: string, pageName: string) => {
    try {
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
      } else {
        Alert.alert(
          AppStrings.CommonAlerts.UNABLE_TO_OPEN_TITLE,
          `${AppStrings.CommonAlerts.CANNOT_OPEN_PREFIX}${pageName}${AppStrings.CommonAlerts.CANNOT_OPEN_VISIT_SUFFIX}${url}${AppStrings.CommonAlerts.CANNOT_OPEN_BROWSER_SUFFIX}`
        );
      }
    } catch (error) {
      logger.error(`Error opening ${pageName}:`, error);
      captureException(error);
      Alert.alert(
        AppStrings.CommonAlerts.ERROR_TITLE,
        `${AppStrings.CommonAlerts.COULD_NOT_OPEN_PREFIX}${pageName}${AppStrings.CommonAlerts.COULD_NOT_OPEN_TRY_AGAIN}`
      );
    }
  }, []);

  const handleNextPress = async () => {
    setIsLoading(true);
    setUsernameError(null);
    setEmailError(null);
    setPasswordError(null);
    setConfirmPasswordError(null);
    setAuthError(null);

    try {
      const formData: SignUpFormData = {
        username: username,
        email: email,
        password: passwordState.password,
        confirmPassword: passwordState.confirmPassword,
      };
      signUpSchema.parse(formData);

      if (!agreedToTerms) {
        setAuthError(AppStrings.AuthStrings.SignUp.MUST_AGREE_TO_TERMS);
        setIsLoading(false);
        return;
      }

      logger.debug("Validation successful. Attempting sign up...");

      await AuthService.signUpWithEmail(email, passwordState.password);
    } catch (error) {
      if (error instanceof ZodError) {
        const formattedErrors: ZodFormattedError<SignUpFormData> =
          error.format();
        if (formattedErrors.username?._errors) {
          setUsernameError(formattedErrors.username._errors[0]);
        }
        if (formattedErrors.email?._errors) {
          setEmailError(formattedErrors.email._errors[0]);
        }
        if (formattedErrors.password?._errors) {
          setPasswordError(formattedErrors.password._errors[0]);
        }
        if (formattedErrors.confirmPassword?._errors) {
          setConfirmPasswordError(formattedErrors.confirmPassword._errors[0]);
        }
      } else if (error && typeof error === "object" && "code" in error) {
        const firebaseError = error as FirebaseError;
        logger.error("Sign up error:", firebaseError);
        captureException(error);
        switch (firebaseError.code) {
          case "auth/email-already-in-use":
            setEmailError(
              AppStrings.AuthStrings.SignUp.EMAIL_ALREADY_IN_USE_ERROR
            );
            break;
          case "auth/invalid-email":
            setEmailError(AppStrings.AuthStrings.SignUp.INVALID_EMAIL_ERROR);
            break;
          case "auth/operation-not-allowed":
            setAuthError(
              AppStrings.AuthStrings.SignUp.OPERATION_NOT_ALLOWED_ERROR
            );
            break;
          case "auth/weak-password":
            setAuthError(AppStrings.AuthStrings.SignUp.WEAK_PASSWORD_ERROR);
            break;
          default:
            setAuthError(
              firebaseError.message ||
                AppStrings.AuthStrings.SignUp.SIGNUP_UNEXPECTED_ERROR
            );
        }
      } else {
        logger.error("Unexpected sign up error:", error);
        captureException(error);
        setAuthError(AppStrings.AuthStrings.SignUp.SIGNUP_UNEXPECTED_ERROR);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const activeStep = useMemo(() => {
    if (
      agreedToTerms &&
      passwordState.passwordsMatch &&
      passwordState.isPasswordLongEnough &&
      username.trim().length > 0 &&
      email.trim().length > 0
    ) {
      return 3;
    } else if (
      passwordState.passwordsMatch &&
      passwordState.isPasswordLongEnough &&
      username.trim().length > 0 &&
      email.trim().length > 0
    ) {
      return 2;
    } else if (
      username.trim().length > 0 &&
      email.trim().length > 0 &&
      passwordState.password.length > 0
    ) {
      return 1;
    } else {
      return 0;
    }
  }, [
    username,
    email,
    passwordState.password,
    passwordState.passwordsMatch,
    passwordState.isPasswordLongEnough,
    agreedToTerms,
  ]);

  const isSignUpButtonDisabled = useMemo(() => {
    const isFormValid = signUpSchema.safeParse({
      username: username,
      email: email,
      password: passwordState.password,
      confirmPassword: passwordState.confirmPassword,
    }).success;

    return isLoading || !isFormValid || !agreedToTerms;
  }, [
    username,
    email,
    passwordState.password,
    passwordState.confirmPassword,
    agreedToTerms,
    isLoading,
  ]);

  return (
    <View style={styles.signUpContainer}>
      <StarryBackground />
      <CustomSafeAreaView style={styles.signUpSafeArea}>
        <AuthLayout>
          <View className="relative w-full" style={{ marginBottom: SPACING.xl }}>
            <BackButton navigation={navigation} />
            <View style={{ marginTop: verticalScale(28) }}>
              <ScreenTitle title={AppStrings.AuthStrings.SignUp.TITLE} />
            </View>
          </View>

          <ScrollView
            className="w-full"
            style={{ paddingHorizontal: SPACING.md }}
            showsVerticalScrollIndicator={false}
          >
            <ProgressBar activeStep={activeStep} totalSteps={3} />

            <UserUsernameInput
              username={username}
              setUsername={setUsername}
              errorMessage={usernameError}
            />
            <UserEmailInput
              email={email}
              setEmail={setEmail}
              errorMessage={emailError}
            />
            <UserPasswordInput
              password={passwordState.password}
              setPassword={(text) =>
                dispatch({ type: "SET_PASSWORD", payload: text })
              }
              errorMessage={passwordError}
            />
            <UserPasswordInput
              password={passwordState.confirmPassword}
              setPassword={(text) =>
                dispatch({ type: "SET_CONFIRM_PASSWORD", payload: text })
              }
              placeholder={
                AppStrings.AuthStrings.SignUp.CONFIRM_PASSWORD_PLACEHOLDER
              }
              label={AppStrings.AuthStrings.SignUp.CONFIRM_PASSWORD_LABEL}
              errorMessage={confirmPasswordError}
            />

            {passwordState.confirmPasswordHasInput && (
              <PasswordMatch
                passwordsMatch={passwordState.passwordsMatch}
                isPasswordLongEnough={passwordState.isPasswordLongEnough}
              />
            )}

            <TouchableOpacity
              className="flex-row items-center"
              style={{ marginVertical: SPACING.md }}
              onPress={() => setAgreedToTerms(!agreedToTerms)}
            >
              <CheckboxIcon checked={agreedToTerms} />
              <View className="flex-row flex-wrap" style={{ marginLeft: SPACING.sm }}>
                <Text className="text-white">
                  {AppStrings.AuthStrings.SignUp.TERMS_AGREEMENT_PART1}
                </Text>
                <TouchableOpacity
                  onPress={() => openExternalUrl(TERMS_OF_SERVICE_URL, AppStrings.AuthStrings.SignUp.TERMS_PAGE_NAME)}
                >
                  <Text className="text-blue-300 underline">
                    {AppStrings.AuthStrings.SignUp.TERMS_USER_AGREEMENT}
                  </Text>
                </TouchableOpacity>
                <Text className="text-white">
                  {AppStrings.AuthStrings.SignUp.TERMS_AGREEMENT_PART2}
                </Text>
                <TouchableOpacity
                  onPress={() => openExternalUrl(PRIVACY_POLICY_URL, AppStrings.AuthStrings.SignUp.PRIVACY_POLICY_PAGE_NAME)}
                >
                  <Text className="text-blue-300 underline">
                    {AppStrings.AuthStrings.SignUp.TERMS_PRIVACY_POLICY}
                  </Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>

            {authError && <Error message={authError} />}
          </ScrollView>

          <View className="w-full mt-auto" style={{ paddingHorizontal: SPACING.md }}>
            <WideButton
              buttonText={AppStrings.AuthStrings.SignUp.NEXT_BUTTON}
              onPress={handleNextPress}
              disabled={isSignUpButtonDisabled || isLoading}
            />
            <TouchableOpacity
              onPress={() => navigation.navigate(AppStrings.Navigation.LOGIN)}
              style={{ marginBottom: SPACING.md }}
            >
              <Text className="text-center text-white" style={{ fontSize: TYPOGRAPHY.fontSize.sm }}>
                {AppStrings.AuthStrings.SignUp.HAS_ACCOUNT_PROMPT}
                <Text className="text-blue-300 font-semibold" style={{ fontSize: TYPOGRAPHY.fontSize.sm }}>
                  {AppStrings.AuthStrings.SignUp.LOGIN_NOW}
                </Text>
              </Text>
            </TouchableOpacity>
          </View>
        </AuthLayout>
      </CustomSafeAreaView>

      <PulsingSpinner visible={isLoading} size={LOADING_SPINNER_SIZE} />
    </View>
  );
};

export default SignUpScreen;
