import * as React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { NavigationContainer } from "@react-navigation/native";
import LandingScreen from "../screens/auth/LandingScreen";
import LoginScreen from "../screens/auth/LoginScreen";
import SignUpScreen from "../screens/auth/SignUpScreen";

const Stack = createNativeStackNavigator();

export const Navigation = () => {
  return (
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen
          name="Landing"
          component={LandingScreen}
          options={{ title: "Welcome" }}
        />

        <Stack.Screen
          name="Login"
          component={LoginScreen}
          options={{ title: "Login" }}
        />

        <Stack.Screen
          name="Sign Up"
          component={SignUpScreen}
          options={{ title: "Sign Up" }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
};
