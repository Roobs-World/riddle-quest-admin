import React from "react";
import { View, Text } from "react-native";
import CustomSafeAreaView from "../components/CustomSafeAreaView";
import QwordlyLogo from "../components/logos/QwordlyLogo";
import GoogleSignInButton from "../components/buttons/GoogleSignInButton";
import FacebookSignInButton from "../components/buttons/FacebookSignInButton";
import WideButton from "../components/buttons/WideButton";
import HomeBgSvg from "../../assets/images/home-bg.svg";
import SignUpButton from "../components/buttons/SignUpButton";
import { AppStrings } from "../constants/AppStrings";
import Subtitle from "../components/text/Subtitle";

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
        {AppStrings.AuthStrings.Landing.TAGLINE_1}
      </Text>
      <Subtitle text={AppStrings.AuthStrings.Landing.TAGLINE_2} />

      <WideButton
        buttonText={AppStrings.AuthStrings.Landing.SIGN_IN_BUTTON}
        onPress={() => navigation.navigate(AppStrings.Navigation.LOGIN)}
      />

      <View className="flex-row items-center mt-4 mb-8">
        <View className="flex-1 h-px bg-gray-300 mr-2" />
        <Text
          className="text-sm text-gray-500"
          style={{ fontFamily: "PoppinsLight" }}
        >
          {AppStrings.AuthStrings.Landing.OR_SIGN_IN_WITH}
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
          {AppStrings.AuthStrings.Landing.NO_ACCOUNT_PROMPT}{" "}
        </Text>
        <View className="flex-1 h-px bg-gray-300 ml-2" />
      </View>

      <SignUpButton
        onPress={() => navigation.navigate(AppStrings.Navigation.SIGN_UP)}
      />
    </CustomSafeAreaView>
  );
};

export default LandingScreen;
