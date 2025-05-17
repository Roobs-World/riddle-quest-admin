import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  // SafeAreaView,
  StatusBar,
} from "react-native";
import CustomSafeAreaView from "../../components/CustomSafeAreaView";
import QwordlyLogo from "../../components/logos/QwordlyLogo";
import GoogleSignInButton from "../../components/GoogleSignInButton";
import FacebookSignInButton from "../../components/FacebookSignInButton";
import WideButton from "../../components/WideButton";

const LandingScreen = ({ navigation }: { navigation: any }) => {
  return (
    <CustomSafeAreaView>
      <QwordlyLogo />

      <Text
        className="text-2xl font-bold text-gray-800 text-center mb-2"
        style={{
          fontFamily: "PoetsenOne",
          fontWeight: "400",
          fontSize: 26,
          lineHeight: 34.32,
          letterSpacing: -0.104,
        }}
      >
        Join millions of people to play QWORDLY.
      </Text>
      <Text className="text-base text-gray-600 text-center mb-10">
        Ready to have fun while training your mind?
      </Text>

      <WideButton
        buttonText="Sign In"
        onPress={() => navigation.navigate("Login")}
      />

      <Text className="text-sm text-gray-500 my-4">or Sign in with</Text>

      <GoogleSignInButton onPress={() => console.log("Continue with Google")} />

      <FacebookSignInButton
        onPress={() => console.log("Continue with Facebook")}
      />

      <View className="flex-row items-center">
        <Text className="text-sm text-gray-600">Don't have an account? </Text>
        <TouchableOpacity onPress={() => console.log("Sign up")}>
          <Text className="text-sm text-primary-orange font-semibold">
            Sign up
          </Text>
        </TouchableOpacity>
      </View>
    </CustomSafeAreaView>
  );
};

export default LandingScreen;
