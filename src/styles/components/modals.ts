/**
 * @fileoverview Modal Component Styles
 *
 * Comprehensive styling system for modal dialogs, overlays, and popup components.
 * Provides consistent design patterns, accessibility features, and responsive
 * styling for all modal types in the Qwordly application.
 *
 * Features:
 * - Consistent visual hierarchy and spacing using design tokens
 * - Accessibility-compliant color contrast
 * - Responsive design for different screen sizes
 * - Smooth animations and transitions
 * - Multiple modal variants (standard, success, warning, error, info)
 * - Game-specific modal styling
 * - Form and input styling within modals
 * - Progress indicators and status displays
 *
 * @author Qwordly Development Team
 * @version 2.0.0
 * @since 2024
 */

import { StyleSheet, ViewStyle, TextStyle } from "react-native";
import { scale } from "../../utils/responsive";
import { SPACING } from "../tokens/spacing";
import { BORDER_RADIUS } from "../tokens/borderRadius";
import { COLORS } from "../tokens/colors";
import { SHADOWS } from "../tokens/shadows";

/**
 * Modal Styles Configuration
 *
 * Comprehensive styling system for all modal components including:
 * - Base overlay and container styles
 * - Content and layout patterns
 * - Interactive elements (buttons, inputs)
 * - Specialized modal variants
 * - Animation and transition styles
 */
export const modalStyles = StyleSheet.create({
  /**
   * Close Button Styles
   *
   * Consistent positioning and styling for modal
   * close buttons with accessibility support.
   */
  baseOverlayCloseButtonContainer: {
    position: "absolute",
    top: SPACING.sm,
    zIndex: 10,
  } as ViewStyle,

  /**
   * Button Container Styles
   *
   * Layout containers for modal action buttons
   * with proper spacing and alignment.
   */
  buttonContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginTop: SPACING.lg,
    width: "100%",
  } as ViewStyle,

  buttonContainerSingle: {
    alignItems: "center",
    marginTop: SPACING.lg,
    width: "100%",
  } as ViewStyle,

  buttonContainerVertical: {
    flexDirection: "column",
    gap: SPACING.md,
    marginTop: SPACING.lg,
    width: "100%",
  } as ViewStyle,

  closeButton: {
    position: "absolute",
    top: SPACING.sm,
    right: SPACING.sm,
    zIndex: 10,
    padding: SPACING.xs,
  } as ViewStyle,

  closeButtonLeft: {
    position: "absolute",
    top: SPACING.sm,
    left: SPACING.sm,
    zIndex: 10,
    padding: SPACING.xs,
  } as ViewStyle,

  /**
   * Game-Specific Modal Styles
   *
   * Specialized styling for game-related modals
   * including victory, loss, and progress displays.
   */
  coinDisplay: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    backgroundColor: COLORS.gray100,
    borderRadius: BORDER_RADIUS.md,
  } as ViewStyle,

  coinText: {
    fontSize: scale(16),
    fontWeight: "600",
    color: COLORS.primaryOrange,
    marginLeft: SPACING.xs,
  } as TextStyle,

  gameModal: {
    backgroundColor: COLORS.white,
    alignItems: "center",
    paddingVertical: SPACING.xl,
  } as ViewStyle,

  /**
   * Content and Layout Styles
   *
   * Flexible content containers for different modal
   * layouts and content types.
   */
  content: {
    backgroundColor: COLORS.backgroundDark,
    borderRadius: BORDER_RADIUS.lg,
    margin: SPACING.md,
    maxHeight: "80%",
    maxWidth: "90%",
    padding: SPACING.lg,
    position: "relative",
  } as ViewStyle,

  contentCentered: {
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
  } as ViewStyle,

  contentScrollable: {
    maxHeight: "70%",
    width: "100%",
  } as ViewStyle,

  /**
   * Text and Content Styles
   *
   * Typography and content styling for modal
   * text, descriptions, and messaging.
   */
  description: {
    fontSize: scale(14),
    color: COLORS.textSecondary,
    textAlign: "center",
    marginBottom: SPACING.lg,
    lineHeight: scale(20),
  } as TextStyle,

  /**
   * Animation and Transition Styles
   *
   * Styles for modal entrance, exit, and
   * interactive animations.
   */
  fadeIn: {
    opacity: 1,
  } as ViewStyle,

  fadeOut: {
    opacity: 0,
  } as ViewStyle,

  scaleIn: {
    transform: [{ scale: 1 }],
  } as ViewStyle,

  scaleOut: {
    transform: [{ scale: 0.9 }],
  } as ViewStyle,

  /**
   * Form and Input Styles
   *
   * Styling for modal forms, inputs, and
   * interactive elements.
   */
  formContainer: {
    width: "100%",
    marginBottom: SPACING.lg,
  } as ViewStyle,

  inputContainer: {
    marginBottom: SPACING.md,
    width: "100%",
  } as ViewStyle,

  inputLabel: {
    fontSize: scale(14),
    color: COLORS.textPrimary,
    marginBottom: SPACING.xs,
    fontWeight: "500",
  } as TextStyle,

  /**
   * List and Grid Styles
   *
   * Layout styles for modal content displayed
   * in lists, grids, or structured formats.
   */
  gridContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    marginVertical: SPACING.md,
  } as ViewStyle,

  gridItem: {
    margin: SPACING.xs,
    alignItems: "center",
    justifyContent: "center",
  } as ViewStyle,

  listContainer: {
    width: "100%",
    maxHeight: scale(300),
    marginVertical: SPACING.md,
  } as ViewStyle,

  listItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray200,
  } as ViewStyle,

  /**
   * Header and Title Styles
   *
   * Consistent header styling for modal titles,
   * close buttons, and navigation elements.
   */
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: SPACING.md,
    width: "100%",
  } as ViewStyle,

  headerCentered: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SPACING.lg,
    width: "100%",
  } as ViewStyle,

  title: {
    fontSize: scale(24),
    fontWeight: "bold",
    color: COLORS.textPrimary,
    textAlign: "center",
    marginBottom: SPACING.sm,
  } as TextStyle,

  subtitle: {
    fontSize: scale(16),
    color: COLORS.textSecondary,
    textAlign: "center",
    marginBottom: SPACING.md,
  } as TextStyle,

  /**
   * Core Modal Container Styles
   *
   * Primary modal container with responsive sizing,
   * proper shadows, and accessibility features.
   */
  modalContainer: {
    alignItems: "center",
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.lg,
    justifyContent: "center",
    maxWidth: "90%",
    minWidth: "80%",
    padding: SPACING.lg,
    ...SHADOWS.lg,
  } as ViewStyle,

  modalText: {
    marginBottom: SPACING.md,
    textAlign: "center",
    fontSize: scale(16),
    color: COLORS.textPrimary,
    lineHeight: scale(24),
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
    paddingHorizontal: SPACING.md,
  } as ViewStyle,

  /**
   * Base Overlay Styles
   *
   * Foundation styles for modal overlays providing backdrop
   * functionality and proper z-index stacking.
   */
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    zIndex: 1000,
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

  /**
   * Progress and Status Styles
   *
   * Visual indicators for progress, status,
   * and state within modal interfaces.
   */
  progressBar: {
    height: scale(8),
    backgroundColor: COLORS.gray200,
    borderRadius: BORDER_RADIUS.sm,
    overflow: "hidden",
  } as ViewStyle,

  progressContainer: {
    width: "100%",
    marginVertical: SPACING.md,
  } as ViewStyle,

  progressFill: {
    height: "100%",
    backgroundColor: COLORS.primaryOrange,
    borderRadius: BORDER_RADIUS.sm,
  } as ViewStyle,

  statusIndicator: {
    width: scale(12),
    height: scale(12),
    borderRadius: scale(6),
    marginRight: SPACING.xs,
  } as ViewStyle,

  /**
   * Specialized Modal Variants
   *
   * Themed styling for different types of modals
   * (success, error, warning, info).
   */
  successModal: {
    backgroundColor: COLORS.white,
    borderTopWidth: 4,
    borderTopColor: COLORS.success,
  } as ViewStyle,

  errorModal: {
    backgroundColor: COLORS.white,
    borderTopWidth: 4,
    borderTopColor: COLORS.error,
  } as ViewStyle,

  warningModal: {
    backgroundColor: COLORS.white,
    borderTopWidth: 4,
    borderTopColor: COLORS.warning,
  } as ViewStyle,

  infoModal: {
    backgroundColor: COLORS.white,
    borderTopWidth: 4,
    borderTopColor: COLORS.info,
  } as ViewStyle,

  warningText: {
    fontSize: scale(14),
    color: COLORS.error,
    textAlign: "center",
    marginBottom: SPACING.md,
    fontWeight: "500",
  } as TextStyle,
});
