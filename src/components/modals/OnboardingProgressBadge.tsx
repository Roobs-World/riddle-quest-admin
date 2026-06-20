import React from "react";
import type {StyleProp, ViewStyle} from "react-native";
import {moderateScale, verticalScale} from "../../utils/responsive";
import StepBreadcrumb from "../shared/StepBreadcrumb";

interface OnboardingProgressBadgeProps {
  current: number;
  style?: StyleProp<ViewStyle>;
  total: number;
}

const ONBOARDING_PROGRESS_BADGE_TOP_OFFSET = verticalScale(8);

const OnboardingProgressBadge: React.FC<OnboardingProgressBadgeProps> = ({current, style, total}) => {
  return (
    <StepBreadcrumb
      current={current}
      total={total}
      accessibilityLabel={`Onboarding step ${current} of ${total}`}
      testID="onboarding-progress-badge"
      dotTestIDPrefix="onboarding-progress-breadcrumb-dot"
      style={[{top: ONBOARDING_PROGRESS_BADGE_TOP_OFFSET}, style]}
      contentStyle={{
        minWidth: moderateScale(58),
        minHeight: verticalScale(28),
        borderRadius: moderateScale(14),
        paddingHorizontal: moderateScale(9),
        paddingVertical: verticalScale(8),
        backgroundColor: "rgba(255, 255, 255, 0.86)",
        borderWidth: moderateScale(1.5),
        borderColor: "rgba(0, 0, 0, 0.16)",
      }}
    />
  );
};

export default OnboardingProgressBadge;
