import React, { useReducer, useState, useMemo } from "react";
import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import ProgressBar from "../../components/shared/ProgressBar";
import CheckboxIcon from "../../components/icons/CheckboxIcon";
import CustomSafeAreaView from "../../components/CustomSafeAreaView";
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
import { AuthService } from "../../services/AuthService";
import { signUpSchema, SignUpFormData } from "../../validation/authSchemas";
import { ZodError, ZodFormattedError } from "zod";
import HomeBgSvg from "../../../assets/images/home-bg.svg";
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
interface NavigationProp {
  navigate: (screen: string) => void;
}

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
 * Sign Up screen for the authentication flow.
 * Allows users to create a new account with username, email, and password.
 *
 * @param {object} navigation - The navigation prop from React Navigation.
 */
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
        setAuthError("Please agree to the terms and privacy policy.");
        setIsLoading(false);
        return;
      }

      console.log("Validation successful. Attempting sign up...");

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
        console.error("Sign up error:", firebaseError);
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
                "An unexpected error occurred during sign up."
            );
        }
      } else {
        console.error("Unexpected sign up error:", error);
        setAuthError("An unexpected error occurred during sign up.");
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
    <View style={{ flex: 1 }}>
      <HomeBgSvg
        width="120%"
        height="100%"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: -1,
        }}
      />
      <CustomSafeAreaView style={{ backgroundColor: "transparent" }}>
        <AuthLayout>
          <View className="relative w-full mb-8">
            <BackButton navigation={navigation} />
            <ScreenTitle
              title={AppStrings.AuthStrings.SignUp.TITLE}
              className="mt-7"
            />
          </View>

          <ScrollView
            className="w-full px-4"
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
              className="flex-row items-center my-4"
              onPress={() => setAgreedToTerms(!agreedToTerms)}
            >
              <CheckboxIcon checked={agreedToTerms} />
              <View className="flex-row flex-wrap ml-2">
                <Text>
                  {AppStrings.AuthStrings.SignUp.TERMS_AGREEMENT_PART1}
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    console.log("Navigate to terms - Placeholder");
                    // TODO: Implement actual navigation to terms page
                  }}
                >
                  <Text className="text-blue-600 underline">
                    {AppStrings.AuthStrings.SignUp.TERMS_USER_AGREEMENT}
                  </Text>
                </TouchableOpacity>
                <Text>
                  {AppStrings.AuthStrings.SignUp.TERMS_AGREEMENT_PART2}
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    console.log("Navigate to privacy policy - Placeholder");
                    // TODO: Implement actual navigation to privacy policy page
                  }}
                >
                  <Text className="text-blue-600 underline">
                    {AppStrings.AuthStrings.SignUp.TERMS_PRIVACY_POLICY}
                  </Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>

            {authError && <Error message={authError} />}
          </ScrollView>

          <View className="w-full px-4 mt-auto">
            <WideButton
              buttonText={AppStrings.AuthStrings.SignUp.NEXT_BUTTON}
              onPress={handleNextPress}
              disabled={isSignUpButtonDisabled || isLoading}
            />
            <TouchableOpacity
              onPress={() => navigation.navigate(AppStrings.Navigation.LOGIN)}
              className="mb-4"
            >
              <Text className="text-center  text-sm text-gray-600">
                {AppStrings.AuthStrings.SignUp.HAS_ACCOUNT_PROMPT}
                <Text className="text-sm text-blue-600 font-semibold">
                  {AppStrings.AuthStrings.SignUp.LOGIN_NOW}
                </Text>
              </Text>
            </TouchableOpacity>
          </View>
        </AuthLayout>
      </CustomSafeAreaView>
    </View>
  );
};

export default SignUpScreen;
