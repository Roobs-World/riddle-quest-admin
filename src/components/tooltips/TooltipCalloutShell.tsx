import React, {useMemo} from "react";
import {Dimensions, StyleSheet, View, type StyleProp, type ViewStyle} from "react-native";
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

interface TooltipCalloutShellProps {
  children: React.ReactNode;
  targetRect?: TargetRect | null;
  visible: boolean;
  placement?: "anchored" | "center";
  panelWidth?: number;
  panelStyle?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  backdropStyle?: StyleProp<ViewStyle>;
  containerStyle?: StyleProp<ViewStyle>;
  showBackdropCutout?: boolean;
  showPointer?: boolean;
  testID?: string;
  backdropTopTestID?: string;
  backdropLeftTestID?: string;
  backdropRightTestID?: string;
  backdropBottomTestID?: string;
  backdropTestID?: string;
  panelTestID?: string;
  pointerTestID?: string;
}

const clamp = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), max);

const TooltipCalloutShell: React.FC<TooltipCalloutShellProps> = ({
  children,
  targetRect,
  visible,
  placement = "anchored",
  panelWidth = DEFAULT_PANEL_WIDTH,
  panelStyle,
  contentStyle,
  backdropStyle,
  containerStyle,
  showBackdropCutout = true,
  showPointer = Boolean(targetRect),
  testID = "tooltip-callout-shell",
  backdropTopTestID = "tooltip-backdrop-top",
  backdropLeftTestID = "tooltip-backdrop-left",
  backdropRightTestID = "tooltip-backdrop-right",
  backdropBottomTestID = "tooltip-backdrop-bottom",
  backdropTestID = "tooltip-backdrop",
  panelTestID = "tooltip-panel",
  pointerTestID = "tooltip-pointer",
}) => {
  const {width, height} = Dimensions.get("window");

  const layout = useMemo(() => {
    if (targetRect && placement !== "center") {
      const targetCenterX = targetRect.x + targetRect.width / 2;
      const preferredAbove = targetRect.y > height * 0.45;
      const top = preferredAbove
        ? Math.max(SCREEN_PADDING, targetRect.y - DEFAULT_PANEL_TOP_OFFSET)
        : Math.min(height - DEFAULT_PANEL_TOP_OFFSET, targetRect.y + targetRect.height + 28);
      const left = clamp(targetCenterX - panelWidth / 2, SCREEN_PADDING, width - panelWidth - SCREEN_PADDING);

      return {
        left,
        top,
        pointerLeft: clamp(targetCenterX - left - POINTER_SIZE, 24, panelWidth - 24 - POINTER_SIZE * 2),
        pointerPlacement: preferredAbove ? ("bottom" as const) : ("top" as const),
      };
    }

    return {
      left: Math.max(SCREEN_PADDING, Math.round((width - panelWidth) / 2)),
      top: Math.max(SCREEN_PADDING, Math.round(height / 2 - 220)),
      pointerLeft: Math.round(panelWidth / 2 - POINTER_SIZE),
      pointerPlacement: "top" as const,
    };
  }, [height, panelWidth, placement, targetRect, width]);

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

  return (
    <View pointerEvents="box-none" style={[StyleSheet.absoluteFill, containerStyle]} testID={testID}>
      {showBackdropCutout && targetRect ? (
        <>
          <View
            pointerEvents="none"
            testID={backdropTopTestID}
            style={[
              styles.backdrop,
              {
                top: 0,
                left: 0,
                right: 0,
                height: Math.max(0, targetRect.y - 8),
              },
              backdropStyle,
            ]}
          />
          <View
            pointerEvents="none"
            testID={backdropLeftTestID}
            style={[
              styles.backdrop,
              {
                top: Math.max(0, targetRect.y - 8),
                left: 0,
                width: Math.max(0, targetRect.x - 8),
                height: Math.max(0, targetRect.height + 16),
              },
              backdropStyle,
            ]}
          />
          <View
            pointerEvents="none"
            testID={backdropRightTestID}
            style={[
              styles.backdrop,
              {
                top: Math.max(0, targetRect.y - 8),
                right: 0,
                width: Math.max(0, width - (targetRect.x + targetRect.width + 8)),
                height: Math.max(0, targetRect.height + 16),
              },
              backdropStyle,
            ]}
          />
          <View
            pointerEvents="none"
            testID={backdropBottomTestID}
            style={[
              styles.backdrop,
              {
                left: 0,
                right: 0,
                top: Math.max(0, targetRect.y + targetRect.height + 8),
                height: Math.max(0, height - (targetRect.y + targetRect.height + 8)),
              },
              backdropStyle,
            ]}
          />
        </>
      ) : (
        <View
          pointerEvents="none"
          testID={backdropTestID}
          style={[styles.backdrop, backdropStyle]}
        />
      )}

      <View
        pointerEvents={visible ? "auto" : "none"}
        style={StyleSheet.flatten([
          styles.panel,
          {
            width: panelWidth,
            left: layout.left,
            top: layout.top,
          },
          panelStyle,
        ])}
        testID={panelTestID}
      >
        {showPointer && pointerStyle ? <View testID={pointerTestID} style={pointerStyle} /> : null}
        <View style={[styles.content, contentStyle]}>{children}</View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: "rgba(0,0,0,0.3)",
    position: "absolute",
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
  },
});

export default TooltipCalloutShell;
