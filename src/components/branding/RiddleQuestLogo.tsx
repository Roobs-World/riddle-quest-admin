import React from "react";
import {View, type StyleProp, type ViewStyle} from "react-native";
import MainLogoSvg from "../../../assets/images/main-logo.svg";
import {LANDING_LOGO_HEIGHT, LANDING_LOGO_WIDTH, MODAL_WIDTH} from "../../constants/layout";
import {SPACING} from "../../styles";

const FALLBACK_LOGO_WIDTH = 320;
const FALLBACK_LOGO_HEIGHT = 150;
const resolvedLandingLogoWidth = LANDING_LOGO_WIDTH ?? FALLBACK_LOGO_WIDTH;
const resolvedLandingLogoHeight = LANDING_LOGO_HEIGHT ?? FALLBACK_LOGO_HEIGHT;
const resolvedModalWidth = MODAL_WIDTH ?? 335;

interface RiddleQuestLogoProps {
  height?: number;
  testID?: string;
  width?: number | string;
}

export const RiddleQuestLogo: React.FC<RiddleQuestLogoProps> = ({
  height = resolvedLandingLogoHeight,
  testID = "main-logo-svg",
  width = resolvedLandingLogoWidth,
}) => <MainLogoSvg testID={testID} width={width} height={height} />;

const ONBOARDING_LOGO_WIDTH = Math.min(resolvedModalWidth * 0.72, resolvedLandingLogoWidth);
const ONBOARDING_LOGO_HEIGHT = ONBOARDING_LOGO_WIDTH * (resolvedLandingLogoHeight / resolvedLandingLogoWidth);

interface OnboardingLogoHeaderProps {
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export const ONBOARDING_LOGO_HEADER_HEIGHT = ONBOARDING_LOGO_HEIGHT + SPACING.sm;

export const OnboardingLogoHeader: React.FC<OnboardingLogoHeaderProps> = ({
  style,
  testID = "onboarding-logo-header",
}) => (
  <View pointerEvents="none" testID={testID} style={[{alignItems: "center", width: "100%"}, style]}>
    <RiddleQuestLogo
      testID="onboarding-main-logo-svg"
      width={ONBOARDING_LOGO_WIDTH}
      height={ONBOARDING_LOGO_HEIGHT}
    />
  </View>
);
