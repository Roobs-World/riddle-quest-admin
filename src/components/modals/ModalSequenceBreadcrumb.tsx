import React from "react";
import {Pressable, View} from "react-native";
import type {ModalSequenceProgress} from "../../types/ModalTypes";
import {moderateScale, verticalScale} from "../../utils/responsive";

interface ModalSequenceBreadcrumbProps {
  sequenceProgress?: ModalSequenceProgress;
}

const DOT_SIZE = moderateScale(8);
const DOT_RADIUS = moderateScale(4);

const ModalSequenceBreadcrumb: React.FC<ModalSequenceBreadcrumbProps> = ({sequenceProgress}) => {
  if (!sequenceProgress || sequenceProgress.totalPopups <= 1) {
    return null;
  }

  const total = sequenceProgress.totalPopups;
  const current = Math.min(Math.max(1, sequenceProgress.currentPopupIndex), total);

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
      {Array.from({length: total}, (_, index) => {
        const popupIndex = index + 1;
        const isActive = popupIndex === current;
        const isSelectable = popupIndex < current && typeof sequenceProgress.onSelectPopup === "function";
        const dotStyle = {
          width: DOT_SIZE,
          height: DOT_SIZE,
          borderRadius: DOT_RADIUS,
          backgroundColor: isActive ? "#111111" : "transparent",
        };

        if (isSelectable) {
          return (
            <Pressable
              key={index}
              testID={`modal-sequence-breadcrumb-dot-${popupIndex}`}
              accessibilityRole="button"
              accessibilityLabel={`Go to popup ${popupIndex} of ${total}`}
              accessibilityHint="Jump back to this popup"
              accessibilityState={{selected: false}}
              hitSlop={8}
              onPress={() => sequenceProgress.onSelectPopup?.(popupIndex)}
              style={dotStyle}
            />
          );
        }

        return <View key={index} testID={`modal-sequence-breadcrumb-dot-${popupIndex}`} style={dotStyle} />;
      })}
    </View>
  );
};

export default ModalSequenceBreadcrumb;
