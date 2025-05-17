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
import SignUpButton from "../../components/buttons/SignUpButton";

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
        className="text-2xl font-bold text-gray-800 text-center mb-8"
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
        className="text-base text-gray-400 text-center mb-8"
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

      <View className="flex-row items-center mt-4 mb-8">
        <View className="flex-1 h-px bg-gray-300 mr-2" />
        <Text
          className="text-sm text-gray-500"
          style={{ fontFamily: "PoppinsLight" }}
        >
          or Sign in with
        </Text>
        <View className="flex-1 h-px bg-gray-300 ml-2" />
      </View>

      <GoogleSignInButton onPress={() => console.log("Continue with Google")} />

      <FacebookSignInButton
        onPress={() => console.log("Continue with Facebook")}
      />

      <View className="flex-row items-center mt-8">
        <View className="flex-1 h-px bg-gray-300 mr-2" />
        <Text
          className="text-sm text-gray-600"
          style={{ fontFamily: "PoppinsLight" }}
        >
          Don't have an account?{" "}
        </Text>
        <View className="flex-1 h-px bg-gray-300 ml-2" />
      </View>

      <SignUpButton onPress={() => console.log("Sign up")} />
    </CustomSafeAreaView>
  );
};

export default LandingScreen;
