import React from "react";
import { Text, View } from "react-native";
import { TYPOGRAPHY } from "../../styles";
import { moderateScale, verticalScale } from "../../utils/responsive";

interface OnboardingProgressBadgeProps {
  current: number;
  total: number;
}

const OnboardingProgressBadge: React.FC<OnboardingProgressBadgeProps> = ({
  current,
  total,
}) => {
  if (total <= 0 || current <= 0 || current > total) {
    return null;
  }

  return (
    <View
      accessibilityLabel={`Onboarding step ${current} of ${total}`}
      testID="onboarding-progress-badge"
      style={{
        position: "absolute",
        top: verticalScale(24),
        right: moderateScale(22),
        zIndex: 20,
        minWidth: moderateScale(74),
        minHeight: verticalScale(34),
        borderRadius: moderateScale(17),
        paddingHorizontal: moderateScale(10),
        paddingVertical: verticalScale(6),
        backgroundColor: "rgba(255, 255, 255, 0.86)",
        borderWidth: moderateScale(1.5),
        borderColor: "rgba(0, 0, 0, 0.16)",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text
        style={{
          fontFamily: TYPOGRAPHY.fontSecondaryBold,
          fontSize: TYPOGRAPHY.fontSize.sm,
          color: "black",
          textAlign: "center",
        }}
      >
        {current}/{total}
      </Text>
      <View
        style={{
          flexDirection: "row",
          gap: moderateScale(3),
          marginTop: verticalScale(3),
        }}
      >
        {Array.from({ length: total }, (_, index) => {
          const isActive = index + 1 <= current;
          return (
            <View
              key={index}
              style={{
                width: moderateScale(6),
                height: moderateScale(6),
                borderRadius: moderateScale(3),
                backgroundColor: isActive ? "#111111" : "rgba(0, 0, 0, 0.18)",
              }}
            />
          );
        })}
      </View>
    </View>
  );
};

export default OnboardingProgressBadge;
