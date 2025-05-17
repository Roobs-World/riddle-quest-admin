import * as React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { NavigationContainer } from "@react-navigation/native";
import LandingScreen from "../screens/LandingScreen";
import LoginScreen from "../screens/auth/LoginScreen";
import SignUpScreen from "../screens/auth/SignUpScreen";
import { AppStrings } from "../constants/AppStrings";

const Stack = createNativeStackNavigator();

export const Navigation = () => {
  console.log("Navigation component rendering...");
  return (
    <NavigationContainer>
      <Stack.Navigator>
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
      </Stack.Navigator>
    </NavigationContainer>
  );
};
