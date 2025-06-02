/**
 * Modal Component Styles
 * Modal dialogs, overlays, and popup-related styling
 */

import { StyleSheet, ViewStyle, TextStyle } from "react-native";
import { scale } from "../../utils/responsive";
import { SPACING } from "../tokens/spacing";
import { BORDER_RADIUS } from "../tokens/borderRadius";
import { COLORS } from "../tokens/colors";
import { SHADOWS } from "../tokens/shadows";

export const modalStyles = StyleSheet.create({
  baseOverlayCloseButtonContainer: {
    position: "absolute",
    top: SPACING.sm,
    zIndex: 10,
  } as ViewStyle,

  content: {
    backgroundColor: COLORS.backgroundDark,
    borderRadius: BORDER_RADIUS.lg,
    margin: SPACING.md,
    maxHeight: "80%",
    maxWidth: "90%",
    padding: SPACING.md,
    position: "relative",
  } as ViewStyle,

  modalContainer: {
    alignItems: "center",
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.lg,
    justifyContent: "center",
    maxWidth: "90%",
    padding: SPACING.md,
    ...SHADOWS.md,
  } as ViewStyle,

  modalText: {
    marginBottom: SPACING.md,
    textAlign: "center",
  } as TextStyle,

  modalView: {
    alignItems: "center",
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.lg,
    margin: SPACING.md,
    padding: scale(35),
    ...SHADOWS.md,
  } as ViewStyle,

  modalWrapper: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
  } as ViewStyle,

  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  } as ViewStyle,

  overlayContainer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10,
  } as ViewStyle,

  overlayContent: {
    alignItems: "center",
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.lg,
  } as ViewStyle,

  overlayVisible: {
    opacity: 0.3,
  } as ViewStyle,
});
