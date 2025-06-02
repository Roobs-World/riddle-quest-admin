import React from "react";
import { View, Text, ScrollView } from "react-native";
import CustomSafeAreaView from "../components/layouts/CustomSafeAreaView";
import QwordlyLogo from "../components/logos/QwordlyLogo";
import HomeBgSvg from "../../assets/images/home-bg.svg";
import BackButton from "../components/buttons/BackButton";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { styles } from "../styles";

type RootStackParamList = {
  Landing: object | undefined;
  Login: object | undefined;
  SignUp: object | undefined;
  ForgotPassword: object | undefined;
  NewPassword: object | undefined;
  Game: object | undefined;
  Credits: object | undefined;
};

type CreditsScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  "Credits"
>;

/**
 * Credits screen showing the team members who created Qwordly.
 * Based on the LandingScreen template with similar styling and layout.
 *
 * @param {object} navigation - The navigation prop from React Navigation.
 */
const CreditsScreen = ({
  navigation,
}: {
  navigation: CreditsScreenNavigationProp;
}) => {
  const teamMembers = [
    {
      name: "Craig Beswetherick",
      role: "Lead Developer & Game Design",
      website: "", // TODO: Add website link
    },
    {
      name: "Reuben Beswetherick",
      role: "Inspiration",
      website: "", // TODO: Add website link
    },
    {
      name: "Thomas Lemrond",
      role: "Game Designer, Publisher, Overall Hero",
      website: "", // TODO: Add website link
    },
    {
      name: "Gavin Harrison",
      role: "Sound Design",
      website: "", // TODO: Add website link
    },
    {
      name: "Nathalia",
      role: "Design",
      website: "", // TODO: Add website link
    },
  ];

  return (
    <CustomSafeAreaView>
      <HomeBgSvg width="120%" height="100%" style={styles.backgroundImage} />

      <BackButton navigation={navigation} targetScreen="Landing" />

      <View className="mb-10">
        <QwordlyLogo />
      </View>

      <Text
        className="text-2xl font-bold text-gray-800 text-center mb-4"
        style={styles.creditsTitle}
      >
        Credits
      </Text>

      <Text
        className="text-lg text-gray-600 text-center mb-8"
        style={styles.creditsSubtitle}
      >
        Meet the amazing team behind Qwordly
      </Text>

      <ScrollView
        className="flex-1 w-full"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollViewContent}
      >
        {teamMembers.map((member, index) => (
          <View
            key={index}
            className="bg-white/90 rounded-lg p-6 mb-4 mx-4 shadow-sm"
            style={styles.teamMemberCard}
          >
            <Text
              className="text-xl font-bold text-gray-800 text-center mb-2"
              style={styles.memberName}
            >
              {member.name}
            </Text>
            <Text
              className="text-base text-gray-600 text-center"
              style={styles.memberRole}
            >
              {member.role}
            </Text>
          </View>
        ))}

        <View className="mt-8 mx-4">
          <Text
            className="text-lg font-bold text-gray-800 text-center mb-4"
            style={styles.thankYouTitle}
          >
            Thank You!
          </Text>
          <Text
            className="text-base text-gray-600 text-center"
            style={styles.thankYouText}
          >
            Special thanks to all our contributors who made Qwordly possible.
            Your creativity, dedication, and passion brought this project to
            life.
          </Text>
        </View>
      </ScrollView>
    </CustomSafeAreaView>
  );
};

export default CreditsScreen;
