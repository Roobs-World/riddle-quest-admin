import React from "react";
import { View } from "react-native";
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

  const total = sequenceProgress.totalPopups;
  const current = Math.min(
    Math.max(1, sequenceProgress.currentPopupIndex),
    total
  );

  return (
    <View
      accessibilityLabel={`Popup ${current} of ${total}`}
      testID="modal-sequence-breadcrumb"
      style={{
        alignSelf: "stretch",
        alignItems: "center",
        flexDirection: "row",
        justifyContent: "center",
        marginBottom: verticalScale(8),
        minHeight: verticalScale(18),
        gap: moderateScale(6),
      }}
    >
      {Array.from({ length: total }, (_, index) => {
        const isActive = index + 1 === current;
        return (
          <View
            key={index}
            testID={`modal-sequence-breadcrumb-dot-${index + 1}`}
            style={{
              width: moderateScale(8),
              height: moderateScale(8),
              borderRadius: moderateScale(4),
              borderWidth: moderateScale(1),
              borderColor: "#111111",
              backgroundColor: isActive ? "#111111" : "transparent",
            }}
          />
        );
      })}
    </View>
  );
};

export default ModalSequenceBreadcrumb;
