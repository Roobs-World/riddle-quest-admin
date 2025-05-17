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

// Define types for the password state and actions
interface PasswordState {
  password: string;
  confirmPassword: string;
  passwordsMatch: boolean;
  confirmPasswordHasInput: boolean;
  isPasswordLongEnough: boolean;
}

type PasswordAction =
  | { type: "SET_PASSWORD"; payload: string }
  | { type: "SET_CONFIRM_PASSWORD"; payload: string };

// Define the initial state for the password reducer
const initialPasswordState: PasswordState = {
  password: "",
  confirmPassword: "",
  passwordsMatch: false,
  confirmPasswordHasInput: false,
  isPasswordLongEnough: true,
};

// Define the reducer function
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

const SignUpScreen = ({ navigation }: { navigation: any }) => {
  const [username, setUsername] = useState("");
  // Use the reducer for password state
  const [passwordState, dispatch] = useReducer(
    passwordReducer,
    initialPasswordState
  );
  const [email, setEmail] = useState("");
  const [agreedToTerms, setAgreedToTerms] = useState(true);

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
        <TouchableOpacity onPress={() => navigation.goBack()} className="">
          <BackIcon />
        </TouchableOpacity>

        <View className="flex-1 self-center">
          <ProgressBar activeStep={1} totalSteps={3} stepColors={stepColors} />
        </View>
      </View>

      <AuthLayout>
        <ScreenTitle
          title={AppStrings.AuthStrings.SignUp.TITLE}
          className="-mt-4"
        />
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
          className="flex-row items-center mb-6"
          onPress={() => setAgreedToTerms(!agreedToTerms)}
        >
          <CheckboxIcon checked={agreedToTerms} />
          <Text className="text-sm text-gray-600 flex-1">
            {AppStrings.AuthStrings.SignUp.TERMS_AGREEMENT_PART1}
            <Text className="text-red-500 font-semibold">
              {AppStrings.AuthStrings.SignUp.TERMS_USER_AGREEMENT}
            </Text>{" "}
            {AppStrings.AuthStrings.SignUp.TERMS_AGREEMENT_PART2}
            <Text className="text-red-500 font-semibold">
              {AppStrings.AuthStrings.SignUp.TERMS_PRIVACY_POLICY}
            </Text>
          </Text>
        </TouchableOpacity>

        <WideButton
          onPress={() => {
            // Use the state from the reducer
            if (passwordState.passwordsMatch) {
              console.log("Sign up pressed"); // Replace with actual sign up logic
            } else {
              console.log(
                "Passwords do not match or confirm password is empty"
              );
            }
          }}
          buttonText={AppStrings.AuthStrings.SignUp.NEXT_BUTTON}
        />

        <View className="flex-row items-center justify-center">
          <Text className="text-sm text-gray-600">
            {AppStrings.AuthStrings.SignUp.HAS_ACCOUNT_PROMPT}{" "}
          </Text>
          <TouchableOpacity
            onPress={() => navigation.navigate(AppStrings.Navigation.LOGIN)}
          >
            <Text className="text-sm text-red-500 font-semibold">
              {AppStrings.AuthStrings.SignUp.LOGIN_NOW}
            </Text>
          </TouchableOpacity>
        </View>
      </AuthLayout>
    </CustomSafeAreaView>
  );
};

export default SignUpScreen;
