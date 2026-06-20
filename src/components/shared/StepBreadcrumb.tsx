import React from "react";
import {Pressable, StyleSheet, View} from "react-native";
import type {StyleProp, ViewStyle} from "react-native";
import {moderateScale, verticalScale} from "../../utils/responsive";

interface StepBreadcrumbProps {
  current: number;
  total: number;
  testID: string;
  dotTestIDPrefix: string;
  accessibilityLabel: string;
  getStepAccessibilityLabel?: (step: number, total: number) => string;
  stepAccessibilityHint?: string;
  onSelectStep?: (step: number) => void;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
}

const DOT_SIZE = moderateScale(8);
const ACTIVE_DOT_SIZE = moderateScale(12);

const StepBreadcrumb: React.FC<StepBreadcrumbProps> = ({
  current,
  total,
  testID,
  dotTestIDPrefix,
  accessibilityLabel,
  getStepAccessibilityLabel,
  stepAccessibilityHint,
  onSelectStep,
  style,
  contentStyle,
}) => {
  if (total <= 1 || current <= 0 || current > total) {
    return null;
  }

  return (
    <View
      accessibilityLabel={accessibilityLabel}
      testID={testID}
      style={{
        ...styles.positioner,
        ...StyleSheet.flatten(style),
      }}
    >
      <View
        style={{
          ...styles.content,
          ...StyleSheet.flatten(contentStyle),
        }}
      >
        {Array.from({length: total}, (_, index) => {
          const step = index + 1;
          const isActive = step === current;
          const isSelectable = step < current && typeof onSelectStep === "function";
          const dotSize = isActive ? ACTIVE_DOT_SIZE : DOT_SIZE;
          const dotStyle = {
            width: dotSize,
            height: dotSize,
            borderRadius: dotSize / 2,
            backgroundColor: isActive ? "#111111" : "#D1D5DB",
          };

          if (isSelectable) {
            return (
              <Pressable
                key={step}
                testID={`${dotTestIDPrefix}-${step}`}
                accessibilityRole="button"
                accessibilityLabel={getStepAccessibilityLabel?.(step, total)}
                accessibilityHint={stepAccessibilityHint}
                accessibilityState={{selected: false}}
                hitSlop={8}
                onPress={() => onSelectStep?.(step)}
                style={dotStyle}
              />
            );
          }

          return <View key={step} testID={`${dotTestIDPrefix}-${step}`} style={dotStyle} />;
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  content: {
    alignItems: "center",
    flexDirection: "row",
    gap: moderateScale(6),
    justifyContent: "center",
    minHeight: verticalScale(18),
  },
  positioner: {
    alignItems: "center",
    left: 0,
    position: "absolute",
    right: 0,
    top: verticalScale(24),
    zIndex: 20,
  },
});

export default StepBreadcrumb;
