import * as React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import LandingScreen from "../screens/LandingScreen";
import LoginScreen from "../screens/auth/LoginScreen";
import SignUpScreen from "../screens/auth/SignUpScreen";
import { AppStrings } from "../constants/AppStrings";
import ForgotPasswordScreen from "../screens/auth/ForgotPasswordScreen";
import NewPasswordScreen from "../screens/auth/NewPasswordScreen";
import GameScreen from "../screens/game/GameScreen";
const Stack = createNativeStackNavigator();

/**
 * Component responsible for setting up the main application navigation stack.
 * It defines the different screens available in the authentication and main application flows.
 */
export const Navigation = () => {
  console.log("Navigation component rendering...");
  return (
    <Stack.Navigator initialRouteName={AppStrings.Navigation.GAME}>
      <Stack.Screen
        name={AppStrings.Navigation.LANDING}
        component={LandingScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name={AppStrings.Navigation.LOGIN}
        component={LoginScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name={AppStrings.Navigation.SIGN_UP}
        component={SignUpScreen}
        options={{ headerShown: false }}
      />

      <Stack.Screen
        name={AppStrings.Navigation.FORGOT_PASSWORD}
        component={ForgotPasswordScreen}
        options={{ headerShown: false }}
      />

      <Stack.Screen
        name={AppStrings.Navigation.NEW_PASSWORD}
        component={NewPasswordScreen}
        options={{ headerShown: false }}
      />

      <Stack.Screen
        name={AppStrings.Navigation.GAME}
        component={GameScreen}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
};
