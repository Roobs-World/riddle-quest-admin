/**
 * @fileoverview Modal Component Styles
 *
 * Comprehensive styling system for modal dialogs, overlays, and popup components.
 * Provides consistent design patterns, accessibility features, and responsive
 * styling for all modal types in the Riddle Quest application.
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
 * @author Riddle Quest Development Team
 * @version 2.0.0
 * @since 2024
 */

import {StyleSheet, ViewStyle, TextStyle} from "react-native";
import {SPACING} from "../tokens/spacing";
import {BORDER_RADIUS} from "../tokens/borderRadius";
import {COLORS} from "../tokens/colors";
import {SHADOWS} from "../tokens/shadows";
import {TYPOGRAPHY} from "../tokens/typography";
import {AUTH_CONTENT_MAX_WIDTH, MODAL_MAX_HEIGHT} from "../../constants/layout";

/**
 * Modal Styles Configuration
 *
 * Comprehensive styling system for all modal components including:
 * - Base overlay and container styles
 * - Content and layout patterns
 * - Interactive elements (buttons, inputs)
 * - Specialized modal variants
 * - Animation and transition styles
 *
 * @namespace modalStyles
 */
export const modalStyles = StyleSheet.create({
  /**
   * Close Button Styles
   *
   * Consistent positioning and styling for modal
   * close buttons with accessibility support.
   */

  /**
   * @property {ViewStyle} baseOverlayCloseButtonContainer - Container for close button in overlay modals
   * Positions the close button at the top of the modal with appropriate z-index
   * to ensure it remains clickable above other content.
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

  /**
   * @property {ViewStyle} buttonContainer - Horizontal container for multiple action buttons
   * Creates a row layout with even spacing between buttons, typically used for
   * primary and secondary action pairs (e.g., "Confirm" and "Cancel").
   */
  buttonContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginTop: SPACING.lg,
    width: "100%",
  } as ViewStyle,

  /**
   * @property {ViewStyle} buttonContainerSingle - Container for a single centered button
   * Centers a single action button within the modal, typically used for
   * acknowledgment actions (e.g., "OK", "Got it").
   */
  buttonContainerSingle: {
    alignItems: "center",
    marginTop: SPACING.lg,
    width: "100%",
  } as ViewStyle,

  /**
   * @property {ViewStyle} buttonContainerVertical - Vertical container for stacked buttons
   * Arranges multiple buttons in a vertical column with consistent spacing,
   * useful for modals with multiple action options.
   */
  buttonContainerVertical: {
    flexDirection: "column",
    gap: SPACING.md,
    marginTop: SPACING.lg,
    width: "100%",
  } as ViewStyle,

  /**
   * @property {ViewStyle} closeButton - Standard close button positioned at top-right
   * Positions a close/dismiss button at the top-right corner of the modal
   * with appropriate padding and z-index for accessibility.
   */
  closeButton: {
    position: "absolute",
    top: SPACING.sm,
    right: SPACING.sm,
    zIndex: 10,
    padding: SPACING.xs,
  } as ViewStyle,

  /**
   * @property {ViewStyle} closeButtonLeft - Close button positioned at top-left
   * Alternative positioning for close/back buttons at the top-left corner,
   * useful for modals with navigation hierarchies.
   */
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

  /**
   * @property {ViewStyle} coinDisplay - Container for displaying coin/currency amounts
   * Creates a visually distinct container for displaying in-game currency
   * with appropriate spacing and background for emphasis.
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

  /**
   * @property {TextStyle} coinText - Text styling for coin/currency amounts
   * Emphasizes currency values with appropriate size, weight, and color
   * to draw attention to rewards or costs.
   */
  coinText: {
    fontFamily: TYPOGRAPHY.fontSecondary,
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: "600",
    color: COLORS.primaryOrange,
    marginLeft: SPACING.xs,
  } as TextStyle,

  /**
   * Content and Layout Styles
   *
   * Flexible content containers for different modal
   * layouts and content types.
   */

  /**
   * @property {ViewStyle} content - Primary content container for modals
   * Provides the main container for modal content with appropriate
   * background, border radius, and size constraints.
   */
  content: {
    backgroundColor: COLORS.backgroundDark,
    borderRadius: BORDER_RADIUS.lg,
    margin: SPACING.md,
    maxHeight: MODAL_MAX_HEIGHT,
    maxWidth: AUTH_CONTENT_MAX_WIDTH,
    padding: SPACING.lg,
    position: "relative",
    width: "90%",
  } as ViewStyle,

  /**
   * @property {ViewStyle} contentCentered - Centered alignment for modal content
   * Ensures content is centered both horizontally and vertically,
   * typically used for simple messages or status displays.
   */
  contentCentered: {
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
  } as ViewStyle,

  /**
   * @property {ViewStyle} contentScrollable - Scrollable content container
   * Allows for scrolling when content exceeds the maximum height,
   * ensuring modals remain usable with varying content lengths.
   */
  contentScrollable: {
    maxHeight: MODAL_MAX_HEIGHT * 0.82,
    width: "100%",
  } as ViewStyle,

  /**
   * Text and Content Styles
   *
   * Typography and content styling for modal
   * text, descriptions, and messaging.
   */

  /**
   * @property {TextStyle} description - Secondary explanatory text styling
   * Provides styling for longer explanatory text with appropriate
   * size, color, and line spacing for readability.
   */
  description: {
    fontFamily: TYPOGRAPHY.fontSecondary,
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.textSecondary,
    textAlign: "center",
    marginBottom: SPACING.lg,
    lineHeight: TYPOGRAPHY.fontSize.sm * TYPOGRAPHY.lineHeight.normal,
  } as TextStyle,

  /**
   * @property {ViewStyle} errorModal - Container styling for error modals
   * Applies distinctive styling for error messages with appropriate
   * border indicators and background colors.
   */
  errorModal: {
    backgroundColor: COLORS.white,
    borderTopWidth: 4,
    borderTopColor: COLORS.error,
  } as ViewStyle,

  /**
   * Animation and Transition Styles
   *
   * Styles for modal entrance, exit, and
   * interactive animations.
   */

  /**
   * @property {ViewStyle} fadeIn - Style for fade-in animation state
   * Defines the visible state for opacity-based animations,
   * used in conjunction with animation libraries.
   */
  fadeIn: {
    opacity: 1,
  } as ViewStyle,

  /**
   * @property {ViewStyle} fadeOut - Style for fade-out animation state
   * Defines the hidden state for opacity-based animations,
   * used in conjunction with animation libraries.
   */
  fadeOut: {
    opacity: 0,
  } as ViewStyle,

  /**
   * Form and Input Styles
   *
   * Styling for modal forms, inputs, and
   * interactive elements.
   */

  /**
   * @property {ViewStyle} formContainer - Container for form elements within modals
   * Provides appropriate width and spacing for form elements,
   * ensuring consistent layout across different modal types.
   */
  formContainer: {
    width: "100%",
    marginBottom: SPACING.lg,
  } as ViewStyle,

  /**
   * @property {ViewStyle} gameModal - Specialized styling for game-related modals
   * Applies game-specific styling with appropriate background and padding,
   * typically used for victory, loss, or game status modals.
   */
  gameModal: {
    backgroundColor: COLORS.white,
    alignItems: "center",
    paddingVertical: SPACING.xl,
  } as ViewStyle,

  /**
   * List and Grid Styles
   *
   * Layout styles for modal content displayed
   * in lists, grids, or structured formats.
   */

  /**
   * @property {ViewStyle} gridContainer - Container for grid layouts within modals
   * Arranges child elements in a responsive grid pattern with appropriate
   * wrapping and spacing for various screen sizes.
   */
  gridContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    marginVertical: SPACING.md,
  } as ViewStyle,

  /**
   * @property {ViewStyle} gridItem - Individual item within a grid layout
   * Provides consistent margin and alignment for grid items,
   * ensuring uniform appearance across the grid.
   */
  gridItem: {
    margin: SPACING.xs,
    alignItems: "center",
    justifyContent: "center",
  } as ViewStyle,

  /**
   * Header and Title Styles
   *
   * Consistent header styling for modal titles,
   * close buttons, and navigation elements.
   */

  /**
   * @property {ViewStyle} header - Standard header with justified content
   * Creates a row layout for headers with content justified between
   * left and right edges, typically for title + close button combinations.
   */
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: SPACING.md,
    width: "100%",
  } as ViewStyle,

  /**
   * @property {ViewStyle} headerCentered - Centered header layout
   * Centers header content horizontally with appropriate vertical spacing,
   * typically used for simple title-only headers.
   */
  headerCentered: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SPACING.lg,
    width: "100%",
  } as ViewStyle,

  /**
   * @property {ViewStyle} infoModal - Container styling for informational modals
   * Applies distinctive styling for informational messages with
   * appropriate border indicators and background colors.
   */
  infoModal: {
    backgroundColor: COLORS.white,
    borderTopWidth: 4,
    borderTopColor: COLORS.info,
  } as ViewStyle,

  /**
   * @property {ViewStyle} inputContainer - Container for input fields
   * Provides consistent spacing and width for input elements,
   * ensuring proper layout within forms and modals.
   */
  inputContainer: {
    marginBottom: SPACING.md,
    width: "100%",
  } as ViewStyle,

  /**
   * @property {TextStyle} inputLabel - Text styling for input field labels
   * Applies appropriate size, color, and weight for form field labels,
   * ensuring clear association with their respective inputs.
   */
  inputLabel: {
    fontFamily: TYPOGRAPHY.fontSecondary,
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.textPrimary,
    marginBottom: SPACING.xs,
    fontWeight: "500",
  } as TextStyle,

  /**
   * @property {ViewStyle} listContainer - Container for list layouts
   * Provides appropriate dimensions and spacing for scrollable lists,
   * with maximum height constraints to prevent oversized modals.
   */
  listContainer: {
    width: "100%",
    maxHeight: SPACING["2xl"] * 6, // ≈ 300 px at base; scales with device
    marginVertical: SPACING.md,
  } as ViewStyle,

  /**
   * @property {ViewStyle} listItem - Individual item within a list layout
   * Creates consistent styling for list items with appropriate
   * padding, alignment, and border styling for visual separation.
   */
  listItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray200,
  } as ViewStyle,

  /**
   * Core Modal Container Styles
   *
   * Primary modal container with responsive sizing,
   * proper shadows, and accessibility features.
   */

  /**
   * @property {ViewStyle} modalContainer - Primary container for standard modals
   * Provides the main structural container with appropriate sizing,
   * background, border radius, and shadow effects.
   */
  modalContainer: {
    alignItems: "center",
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.lg,
    justifyContent: "center",
    maxWidth: AUTH_CONTENT_MAX_WIDTH,
    minWidth: "80%",
    padding: SPACING.lg,
    width: "90%",
    ...SHADOWS.lg,
  } as ViewStyle,

  /**
   * @property {TextStyle} modalText - Standard text styling within modals
   * Applies consistent text styling for primary content with
   * appropriate size, color, and line height for readability.
   */
  modalText: {
    fontFamily: TYPOGRAPHY.fontSecondary,
    marginBottom: SPACING.md,
    textAlign: "center",
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.textPrimary,
    lineHeight: TYPOGRAPHY.fontSize.base * TYPOGRAPHY.lineHeight.normal,
  } as TextStyle,

  /**
   * @property {ViewStyle} modalView - Alternative modal container style
   * Provides an alternative styling approach for modals with
   * different padding and shadow characteristics.
   */
  modalView: {
    alignItems: "center",
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.lg,
    margin: SPACING.md,
    padding: SPACING.xl,
    ...SHADOWS.md,
  } as ViewStyle,

  /**
   * @property {ViewStyle} modalWrapper - Outer wrapper for modal positioning
   * Creates a flexible container that centers the modal within
   * the available screen space with appropriate padding.
   */
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

  /**
   * @property {ViewStyle} overlay - Semi-transparent backdrop overlay
   * Creates a darkened backdrop behind modals to emphasize modal content
   * and prevent interaction with underlying elements.
   */
  overlay: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    zIndex: 1000,
  } as ViewStyle,

  /**
   * @property {ViewStyle} overlayContainer - Container for overlay elements
   * Provides positioning context for overlay content with appropriate
   * z-index to ensure proper stacking order.
   */
  overlayContainer: {
    ...StyleSheet.absoluteFill,
    zIndex: 10,
  } as ViewStyle,

  /**
   * @property {ViewStyle} overlayContent - Content container within overlays
   * Applies consistent styling to content displayed within overlays,
   * with appropriate padding and border radius.
   */
  overlayContent: {
    alignItems: "center",
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.lg,
  } as ViewStyle,

  /**
   * @property {ViewStyle} overlayVisible - Style for visible overlay state
   * Defines the semi-transparent state for overlay backgrounds,
   * allowing underlying content to remain partially visible.
   */
  overlayVisible: {
    opacity: 0.3,
  } as ViewStyle,

  /**
   * @property {ViewStyle} progressBar - Container for progress indicators
   * Creates a visual container for progress bars with appropriate
   * height, background, and border radius.
   */
  progressBar: {
    height: SPACING.xs * 2, // 8 px at base; scales with device
    backgroundColor: COLORS.gray200,
    borderRadius: BORDER_RADIUS.sm,
    overflow: "hidden",
  } as ViewStyle,

  /**
   * @property {ViewStyle} progressContainer - Wrapper for progress elements
   * Provides consistent width and vertical spacing for progress indicators,
   * ensuring proper layout within modal content.
   */
  progressContainer: {
    width: "100%",
    marginVertical: SPACING.md,
  } as ViewStyle,

  /**
   * @property {ViewStyle} progressFill - Active fill for progress indicators
   * Defines the appearance of the filled portion of progress bars
   * with appropriate color and border radius.
   */
  progressFill: {
    height: "100%",
    backgroundColor: COLORS.primaryOrange,
    borderRadius: BORDER_RADIUS.sm,
  } as ViewStyle,

  /**
   * @property {ViewStyle} scaleIn - Style for scale-in animation state
   * Defines the visible state for scale-based animations,
   * used in conjunction with animation libraries.
   */
  scaleIn: {
    transform: [{scale: 1}],
  } as ViewStyle,

  /**
   * @property {ViewStyle} scaleOut - Style for scale-out animation state
   * Defines the reduced-scale state for scale-based animations,
   * used in conjunction with animation libraries.
   */
  scaleOut: {
    transform: [{scale: 0.9}],
  } as ViewStyle,

  /**
   * Progress and Status Styles
   *
   * Visual indicators for progress, status,
   * and state within modal interfaces.
   */

  /**
   * @property {ViewStyle} statusIndicator - Visual indicator for status states
   * Creates a small circular indicator for representing status
   * (e.g., success, error, warning) with appropriate dimensions.
   */
  statusIndicator: {
    width: SPACING.sm + SPACING.xs, // 12 px at base
    height: SPACING.sm + SPACING.xs, // 12 px at base
    borderRadius: (SPACING.sm + SPACING.xs) / 2,
    marginRight: SPACING.xs,
  } as ViewStyle,

  /**
   * @property {TextStyle} subtitle - Secondary heading text styling
   * Applies consistent styling for secondary headings with
   * appropriate size, color, and spacing.
   */
  subtitle: {
    fontFamily: TYPOGRAPHY.fontSecondary,
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.textSecondary,
    textAlign: "center",
    marginBottom: SPACING.md,
  } as TextStyle,

  /**
   * Specialized Modal Variants
   *
   * Themed styling for different types of modals
   * (success, error, warning, info).
   */

  /**
   * @property {ViewStyle} successModal - Container styling for success modals
   * Applies distinctive styling for success messages with
   * appropriate border indicators and background colors.
   */
  successModal: {
    backgroundColor: COLORS.white,
    borderTopWidth: 4,
    borderTopColor: COLORS.success,
  } as ViewStyle,

  /**
   * @property {TextStyle} title - Primary heading text styling
   * Applies consistent styling for primary modal titles with
   * appropriate size, color, and spacing for visual hierarchy.
   */
  title: {
    fontFamily: TYPOGRAPHY.fontPrimary,
    fontSize: TYPOGRAPHY.fontSize["2xl"],
    fontWeight: "400",
    color: COLORS.textPrimary,
    textAlign: "center",
    marginBottom: SPACING.sm,
  } as TextStyle,

  /**
   * @property {ViewStyle} warningModal - Container styling for warning modals
   * Applies distinctive styling for warning messages with
   * appropriate border indicators and background colors.
   */
  warningModal: {
    backgroundColor: COLORS.white,
    borderTopWidth: 4,
    borderTopColor: COLORS.warning,
  } as ViewStyle,

  /**
   * @property {TextStyle} warningText - Text styling for warning messages
   * Emphasizes warning text with appropriate color, size, and weight
   * to draw attention to important cautionary information.
   */
  warningText: {
    fontFamily: TYPOGRAPHY.fontSecondary,
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.error,
    textAlign: "center",
    marginBottom: SPACING.md,
    fontWeight: "500",
  } as TextStyle,
});
