import React, {useMemo} from "react";
import {Animated, Dimensions, StyleSheet, View, type StyleProp, type ViewStyle} from "react-native";
import {COLORS, SPACING} from "../../styles";
import type {TargetRect} from "./types";

const FALLBACK_COLORS = {
  figmaCream: "#FCFAF4",
  figmaGold: "#FEC880",
} as const;

const palette = {
  figmaCream: COLORS?.figmaCream ?? FALLBACK_COLORS.figmaCream,
  figmaGold: COLORS?.figmaGold ?? FALLBACK_COLORS.figmaGold,
};

const SCREEN_PADDING = 18;
const DEFAULT_PANEL_WIDTH = Math.min(Dimensions.get("window").width - SCREEN_PADDING * 2, 340);
const DEFAULT_PANEL_TOP_OFFSET = 140;
const POINTER_SIZE = 10;
const AnimatedView = Animated.createAnimatedComponent(View);

interface TooltipCalloutShellProps {
  children: React.ReactNode;
  targetRect?: TargetRect | null;
  highlightElement?: React.ReactNode;
  cutoutTarget?: boolean;
  visible: boolean;
  placement?: "anchored" | "center";
  preferredPlacement?: "auto" | "above" | "below";
  panelWidth?: number;
  panelStyle?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  backdropStyle?: StyleProp<ViewStyle>;
  containerStyle?: StyleProp<ViewStyle>;
  showPointer?: boolean;
  testID?: string;
  backdropTestID?: string;
  panelTestID?: string;
  pointerTestID?: string;
}

const clamp = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), max);

const TooltipCalloutShell: React.FC<TooltipCalloutShellProps> = ({
  children,
  targetRect,
  highlightElement,
  cutoutTarget = false,
  visible,
  placement = "anchored",
  preferredPlacement = "auto",
  panelWidth = DEFAULT_PANEL_WIDTH,
  panelStyle,
  contentStyle,
  backdropStyle,
  containerStyle,
  showPointer = Boolean(targetRect),
  testID = "tooltip-callout-shell",
  backdropTestID = "tooltip-backdrop",
  panelTestID = "tooltip-panel",
  pointerTestID = "tooltip-pointer",
}) => {
  const {width, height} = Dimensions.get("screen");
  const resolvedPanelWidth = Math.min(panelWidth, Math.max(0, width - SCREEN_PADDING * 2));
  const layout = useMemo(() => {
    if (targetRect && placement !== "center") {
      const targetCenterX = targetRect.x + targetRect.width / 2;
      const preferredAbove =
        preferredPlacement === "above" || (preferredPlacement === "auto" && targetRect.y > height * 0.45);
      const top = preferredAbove
        ? Math.max(SCREEN_PADDING, targetRect.y - DEFAULT_PANEL_TOP_OFFSET)
        : Math.min(height - DEFAULT_PANEL_TOP_OFFSET, targetRect.y + targetRect.height + 28);
      const left = clamp(
        targetCenterX - resolvedPanelWidth / 2,
        SCREEN_PADDING,
        Math.max(SCREEN_PADDING, width - resolvedPanelWidth - SCREEN_PADDING),
      );

      return {
        left,
        top,
        pointerLeft: clamp(targetCenterX - left - POINTER_SIZE, 24, resolvedPanelWidth - 24 - POINTER_SIZE * 2),
        pointerPlacement: preferredAbove ? ("bottom" as const) : ("top" as const),
      };
    }

    return {
      left: Math.max(SCREEN_PADDING, Math.round((width - resolvedPanelWidth) / 2)),
      top: Math.max(SCREEN_PADDING, Math.round(height / 2 - 220)),
      pointerLeft: Math.round(resolvedPanelWidth / 2 - POINTER_SIZE),
      pointerPlacement: "top" as const,
    };
  }, [height, placement, preferredPlacement, resolvedPanelWidth, targetRect, width]);

  const pointerStyle = useMemo(() => {
    if (!showPointer) {
      return null;
    }

    const isTopPointer = layout.pointerPlacement === "top";
    return {
      position: "absolute" as const,
      left: layout.pointerLeft,
      top: isTopPointer ? -POINTER_SIZE + 1 : undefined,
      bottom: isTopPointer ? undefined : -POINTER_SIZE + 1,
      width: 0,
      height: 0,
      borderLeftWidth: POINTER_SIZE,
      borderRightWidth: POINTER_SIZE,
      borderTopWidth: isTopPointer ? 0 : POINTER_SIZE,
      borderBottomWidth: isTopPointer ? POINTER_SIZE : 0,
      borderLeftColor: "transparent",
      borderRightColor: "transparent",
      borderTopColor: isTopPointer ? "transparent" : palette.figmaCream,
      borderBottomColor: isTopPointer ? palette.figmaCream : "transparent",
    } as ViewStyle;
  }, [layout.pointerLeft, layout.pointerPlacement, showPointer]);

  const targetStyle = useMemo(() => {
    if (!targetRect) {
      return null;
    }

    return {
      position: "absolute" as const,
      top: clamp(targetRect.y, 0, height),
      left: clamp(targetRect.x, 0, width),
      width: Math.max(0, Math.min(targetRect.width, width - targetRect.x)),
      height: Math.max(0, Math.min(targetRect.height, height - targetRect.y)),
    } satisfies ViewStyle;
  }, [height, targetRect, width]);

  const highlightStyle = useMemo(() => {
    if (!targetStyle || !highlightElement) {
      return null;
    }

    return {
      ...targetStyle,
      borderRadius: 999,
      zIndex: 1,
    } satisfies ViewStyle;
  }, [highlightElement, targetStyle]);

  const backdropPieces = useMemo(() => {
    if (!cutoutTarget || !targetStyle || !targetRect) {
      return null;
    }

    const targetTop = targetStyle.top;
    const targetLeft = targetStyle.left;
    const targetHeight = targetStyle.height;
    const targetBottom = Math.min(height, targetRect.y + targetRect.height);
    const targetRight = Math.min(width, targetRect.x + targetRect.width);

    return [
      {top: 0, left: 0, width, height: targetTop},
      {top: targetBottom, left: 0, width, height: Math.max(0, height - targetBottom)},
      {top: targetTop, left: 0, width: targetLeft, height: targetHeight},
      {top: targetTop, left: targetRight, width: Math.max(0, width - targetRight), height: targetHeight},
    ] satisfies ViewStyle[];
  }, [cutoutTarget, height, targetRect, targetStyle, width]);

  return (
    <View
      pointerEvents="box-none"
      style={[styles.container, {width, height}, containerStyle]}
      testID={testID}
    >
      {backdropPieces ? (
        <View pointerEvents="none" testID={backdropTestID} style={[styles.backdropGroup, backdropStyle]}>
          {backdropPieces.map((piece, index) => (
            <View
              key={index}
              pointerEvents="none"
              testID={`tooltip-backdrop-piece-${index}`}
              style={[styles.backdrop, piece]}
            />
          ))}
        </View>
      ) : (
        <View
          pointerEvents="none"
          testID={backdropTestID}
          style={[styles.backdrop, {top: 0, left: 0, width, height}, backdropStyle]}
        />
      )}

      {highlightStyle ? (
        <View pointerEvents={visible ? "auto" : "none"} style={highlightStyle} testID="tooltip-highlighted-target">
          {highlightElement}
        </View>
      ) : null}

      <AnimatedView
        pointerEvents={visible ? "auto" : "none"}
        style={StyleSheet.flatten([
          styles.panel,
          {
            width: resolvedPanelWidth,
            left: layout.left,
            top: layout.top,
          },
          panelStyle,
        ])}
        testID={panelTestID}
      >
        {showPointer && pointerStyle ? <View testID={pointerTestID} style={pointerStyle} /> : null}
        <View style={[styles.content, contentStyle]}>{children}</View>
      </AnimatedView>
    </View>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: "rgba(0,0,0,0.3)",
    position: "absolute",
  },
  backdropGroup: {
    height: "100%",
    left: 0,
    position: "absolute",
    top: 0,
    width: "100%",
  },
  container: {
    left: 0,
    position: "absolute",
    top: 0,
  },
  content: {
    alignItems: "stretch",
    padding: SPACING.md,
  },
  panel: {
    backgroundColor: palette.figmaCream,
    borderColor: palette.figmaGold,
    borderRadius: 16,
    borderWidth: 2,
    elevation: 10,
    position: "absolute",
    shadowColor: "#000",
    shadowOffset: {width: 0, height: 8},
    shadowOpacity: 0.2,
    shadowRadius: 12,
    zIndex: 2,
  },
});

export default TooltipCalloutShell;
