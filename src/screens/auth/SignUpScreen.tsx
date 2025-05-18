import React, { useReducer, useState, useMemo } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import ProgressBar from "../../components/shared/ProgressBar";
import BackIcon from "../../components/icons/BackIcon";
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
    case "SET_PASSWORD":
      const isPasswordLongEnough = action.payload.length >= 6;
      return {
        ...state,
        password: action.payload,
        passwordsMatch:
          action.payload === state.confirmPassword && isPasswordLongEnough,
        isPasswordLongEnough: isPasswordLongEnough,
      };
    case "SET_CONFIRM_PASSWORD":
      const confirmPasswordHasInput = action.payload.length > 0;
      return {
        ...state,
        confirmPassword: action.payload,
        passwordsMatch:
          state.password === action.payload && state.isPasswordLongEnough,
        confirmPasswordHasInput: confirmPasswordHasInput,
      };
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
const SignUpScreen = ({ navigation }: { navigation: any }) => {
  const [username, setUsername] = useState("");
  // Use the reducer for password state
  const [passwordState, dispatch] = useReducer(
    passwordReducer,
    initialPasswordState
  );
  const [email, setEmail] = useState("");
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  const stepColors = useMemo(() => {
    const totalSteps = 3;
    const colors = Array(totalSteps).fill("bg-gray-300"); // Default gray color

    // Step 1 is complete if username, email, and password have input
    const isStep1InputComplete =
      username.length > 0 &&
      email.length > 0 &&
      passwordState.password.length > 0;

    // Step 2 is complete if step 1 input is complete AND passwords match
    const isStep2InputComplete =
      isStep1InputComplete && passwordState.passwordsMatch;

    // Step 3 is complete if step 2 input is complete AND terms are agreed
    const isStep3Complete = isStep2InputComplete && agreedToTerms;

    // Color Step 1: Always orange as it's the current/first step
    colors[0] = "bg-primary-orange";

    // Color Step 2: primary-orange if Step 1 input is complete, otherwise gray
    if (isStep1InputComplete) {
      colors[1] = "bg-primary-orange";
    } else {
      colors[1] = "bg-gray-300";
    }

    // Color Step 3: primary-orange if all steps are complete, otherwise gray
    if (isStep3Complete) {
      colors[2] = "bg-primary-orange";
    } else {
      colors[2] = "bg-gray-300";
    }

    return colors;
  }, [username, email, passwordState, agreedToTerms]);

  return (
    <CustomSafeAreaView>
      <View className="flex-row items-center mt-8">
        <BackButton navigation={navigation} />

        <View className="flex-1 self-center">
          <ProgressBar activeStep={1} totalSteps={3} stepColors={stepColors} />
        </View>
      </View>

      <AuthLayout>
        <ScreenTitle title={AppStrings.AuthStrings.SignUp.TITLE} />
        <UserUsernameInput username={username} setUsername={setUsername} />

        <UserEmailInput email={email} setEmail={setEmail} />

        <UserPasswordInput
          password={passwordState.password}
          setPassword={(text) =>
            dispatch({ type: "SET_PASSWORD", payload: text })
          }
        />

        <UserPasswordInput
          label={AppStrings.AuthStrings.SignUp.CONFIRM_PASSWORD_LABEL}
          password={passwordState.confirmPassword}
          placeholder={
            AppStrings.AuthStrings.SignUp.CONFIRM_PASSWORD_PLACEHOLDER
          }
          setPassword={(text) =>
            dispatch({ type: "SET_CONFIRM_PASSWORD", payload: text })
          }
        />

        {/* Display password validation feedback */}
        {passwordState.password.length > 0 &&
        !passwordState.isPasswordLongEnough ? (
          <Error
            message={
              AppStrings.AuthStrings.SignUp.PASSWORD_DOES_NOT_LONG_ENOUGH
            }
          />
        ) : passwordState.confirmPasswordHasInput &&
          !passwordState.passwordsMatch ? (
          <Error
            message={AppStrings.AuthStrings.SignUp.PASSWORD_DOES_NOT_MATCH}
          />
        ) : passwordState.confirmPasswordHasInput &&
          passwordState.passwordsMatch ? (
          <PasswordMatch />
        ) : null}

        <TouchableOpacity
          className="flex-row items-center px-8"
          onPress={() => setAgreedToTerms(!agreedToTerms)}
        >
          <CheckboxIcon checked={agreedToTerms} />
          <Text
            className="text-sm text-black-400 flex-1"
            style={{ fontFamily: "PoppinsSemiBold" }}
          >
            {AppStrings.AuthStrings.SignUp.TERMS_AGREEMENT_PART1}
            <Text
              className="text-red-500 font-semibold"
              style={{ fontFamily: "PoppinsSemiBold" }}
            >
              {AppStrings.AuthStrings.SignUp.TERMS_USER_AGREEMENT}
            </Text>{" "}
            {AppStrings.AuthStrings.SignUp.TERMS_AGREEMENT_PART2}
            <Text
              className="text-red-500 font-semibold"
              style={{ fontFamily: "PoppinsSemiBold" }}
            >
              {AppStrings.AuthStrings.SignUp.TERMS_PRIVACY_POLICY}
            </Text>
          </Text>
        </TouchableOpacity>
      </AuthLayout>
      <WideButton
        onPress={() => {
          // Use the state from the reducer
          if (passwordState.passwordsMatch) {
            console.log("Sign up pressed"); // Replace with actual sign up logic
          } else {
            console.log("Passwords do not match or confirm password is empty");
          }
        }}
        buttonText={AppStrings.AuthStrings.SignUp.NEXT_BUTTON}
      />

      <View className="flex-row items-center justify-center mt-4">
        <Text
          className="text-sm text-black-400"
          style={{ fontFamily: "PoppinsSemiBold" }}
        >
          {AppStrings.AuthStrings.SignUp.HAS_ACCOUNT_PROMPT}{" "}
        </Text>
        <TouchableOpacity
          onPress={() => navigation.navigate(AppStrings.Navigation.LOGIN)}
        >
          <Text
            className="text-sm text-red-500 font-semibold"
            style={{ fontFamily: "PoppinsSemiBold" }}
          >
            {AppStrings.AuthStrings.SignUp.LOGIN_NOW}
          </Text>
        </TouchableOpacity>
      </View>
    </CustomSafeAreaView>
  );
};

export default SignUpScreen;
