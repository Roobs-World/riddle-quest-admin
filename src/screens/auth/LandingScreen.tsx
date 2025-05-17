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
import GoogleSignInButton from "../../components/buttons/GoogleSignInButton";
import FacebookSignInButton from "../../components/buttons/FacebookSignInButton";
import WideButton from "../../components/buttons/WideButton";
import HomeBgSvg from "../../../assets/images/home-bg.svg";

const LandingScreen = ({ navigation }: { navigation: any }) => {
  return (
    <CustomSafeAreaView>
      <HomeBgSvg
        width="120%"
        height="100%"
        style={{
          position: "absolute",
          top: "-5%",
          left: 0,
          bottom: 0,
          right: 0,
          zIndex: -1,
        }}
      />

      <View className="mb-10">
        <QwordlyLogo />
      </View>

      <Text
        className="text-2xl font-bold text-gray-800 text-center mb-4"
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
      <Text
        className="text-base text-gray-400 text-center mb-12"
        style={{
          paddingHorizontal: 24,
          fontFamily: "Poppins",
          fontWeight: "400",
          fontSize: 16,
          lineHeight: 24,
          letterSpacing: -0.104,
        }}
      >
        Ready to have fun while training your mind?
      </Text>

      <WideButton
        buttonText="Sign in"
        onPress={() => navigation.navigate("Login")}
      />

      <Text className="text-sm text-gray-500 mt-6 mb-10">or Sign in with</Text>

      <GoogleSignInButton onPress={() => console.log("Continue with Google")} />

      <FacebookSignInButton
        onPress={() => console.log("Continue with Facebook")}
      />

      <View className="flex-row items-center mt-12">
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
