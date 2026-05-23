import React from "react";
import { Text, View } from "react-native";
import { TYPOGRAPHY } from "../../styles";
import type { ModalSequenceProgress } from "../../types/ModalTypes";
import { moderateScale, verticalScale } from "../../utils/responsive";

interface ModalSequenceBreadcrumbProps {
  sequenceProgress?: ModalSequenceProgress;
}

const ModalSequenceBreadcrumb: React.FC<ModalSequenceBreadcrumbProps> = ({
  sequenceProgress,
}) => {
  if (!sequenceProgress || sequenceProgress.totalPopups <= 1) {
    return null;
  }

  const current = Math.max(1, sequenceProgress.currentPopupIndex);
  const total = Math.max(current, sequenceProgress.totalPopups);

  return (
    <View
      accessibilityLabel={`Popup ${current} of ${total}`}
      testID="modal-sequence-breadcrumb"
      style={{
        alignItems: "center",
        justifyContent: "center",
        marginBottom: verticalScale(8),
        minHeight: verticalScale(30),
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
          gap: moderateScale(4),
          marginTop: verticalScale(4),
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
                backgroundColor: isActive ? "#111111" : "rgba(0, 0, 0, 0.2)",
              }}
            />
          );
        })}
      </View>
    </View>
  );
};

export default ModalSequenceBreadcrumb;
