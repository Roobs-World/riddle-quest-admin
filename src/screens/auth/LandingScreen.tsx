import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
} from "react-native";
import QwordlyLogo from "../../components/logos/QwordlyLogo";
import GoogleIcon from "../../components/icons/GoogleIcon";

const LandingScreen = ({ navigation }: { navigation: any }) => {
  return (
    <SafeAreaView className="flex-1 bg-cream-light justify-center items-center p-6">
      <StatusBar barStyle="dark-content" backgroundColor="#FAF3E0" />

      <QwordlyLogo />

      <Text className="text-2xl font-bold text-gray-800 text-center mb-2">
        Join millions of people to play QWORDLY.
      </Text>
      <Text className="text-base text-gray-600 text-center mb-10">
        Ready to have fun while training your mind?
      </Text>

      <TouchableOpacity
        className="bg-primary-orange w-full py-4 rounded-lg shadow-md mb-4"
        onPress={() => navigation.navigate("Login")}
      >
        <Text className="text-white text-lg font-semibold text-center">
          Sign in
        </Text>
      </TouchableOpacity>

      <Text className="text-sm text-gray-500 my-4">or Sign in with</Text>

      <TouchableOpacity
        className="bg-white border border-gray-300 w-full py-3 rounded-lg shadow-sm mb-4 flex-row items-center justify-center"
        onPress={() => console.log("Continue with Google")} // Replace with actual Google sign-in logic
      >
        <GoogleIcon width={24} height={24} />
        <Text className="text-gray-700 text-base font-medium">
          Continue with google
        </Text>
      </TouchableOpacity>

      <View className="flex-row items-center">
        <Text className="text-sm text-gray-600">Don't have an account? </Text>
        <TouchableOpacity onPress={() => navigation.navigate("SignUp")}>
          <Text className="text-sm text-primary-orange font-semibold">
            Sign up
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

export default LandingScreen;
