/**
 * Layout dimension constants used across the UI.
 * Base values are in logical pixels (designed for a 390 px-wide phone).
 *
 * Computed exports (MODAL_WIDTH, MODAL_HEIGHT) are derived here so that
 * every modal imports the same responsive values from a single source of truth
 * rather than repeating the calculation inline.
 */

import type {DimensionValue} from "react-native";
import {scale, verticalScale, moderateScale, dimensions} from "../utils/responsive";

const viewport = dimensions ?? {
  screenWidth: 390,
  screenHeight: 844,
  isDesktop: false,
  isLargeTablet: false,
  isTablet: false,
};

// ---------------------------------------------------------------------------
// Modals — container
// ---------------------------------------------------------------------------

/** Intrinsic width of the modal-bg SVG asset (design reference). */
export const MODAL_BASE_WIDTH = 335;

/** Intrinsic height of the modal-bg SVG asset (design reference). */
export const MODAL_BASE_HEIGHT = 423;

/** Maximum fraction of screen width a centred modal may occupy. */
export const MODAL_MAX_SCREEN_FRACTION = 0.9;

/** Responsive modal width — use this in every modal container. */
export const MODAL_WIDTH = Math.min(moderateScale(MODAL_BASE_WIDTH), viewport.screenWidth * MODAL_MAX_SCREEN_FRACTION);

/** Responsive modal height — preserves the exact SVG aspect ratio. */
export const MODAL_HEIGHT = MODAL_WIDTH * (MODAL_BASE_HEIGHT / MODAL_BASE_WIDTH);

/** Maximum fraction of screen height any modal card/background should occupy. */
export const MODAL_MAX_SCREEN_HEIGHT_FRACTION = 0.88;

/** Maximum modal height in logical pixels for the current screen. */
export const MODAL_MAX_HEIGHT = viewport.screenHeight * MODAL_MAX_SCREEN_HEIGHT_FRACTION;

/** Returns a modal height scaled from MODAL_HEIGHT but clamped to the viewport. */
export const getResponsiveModalHeight = (
  multiplier = 1,
  maxScreenFraction = MODAL_MAX_SCREEN_HEIGHT_FRACTION,
): number => Math.min(MODAL_HEIGHT * multiplier, viewport.screenHeight * maxScreenFraction);

// ---------------------------------------------------------------------------
// Modals — content layout
// ---------------------------------------------------------------------------

/** Padding inside the modal content area. */
export const MODAL_CONTENT_PADDING = moderateScale(20);

/** Max-height for scrollable lists embedded in a modal. */
export const MODAL_SCROLLABLE_MAX_HEIGHT = verticalScale(280);

/** Height of the thin spacer View placed between stacked WideButtons. */
export const MODAL_BUTTON_SPACER = verticalScale(10);

/** Inset (top + right) for a close button anchored inside the modal frame. */
export const CLOSE_BUTTON_INSET = verticalScale(28);

/** Standard close button icon size used across all modals. */
export const CLOSE_BUTTON_SIZE = scale(20);

/** Standard top-right placement for modal close buttons. */
export const MODAL_CLOSE_BUTTON_POSITION = {
  position: "absolute" as const,
  top: CLOSE_BUTTON_INSET,
  right: CLOSE_BUTTON_INSET,
  zIndex: 10,
};

/** Larger close button icon size for full-screen / shop modals. */
export const CLOSE_BUTTON_SIZE_LG = scale(24);

/**
 * Close-button top offset for overlay modals whose inner content
 * container sits at the modal centre (HintModal, SkipModal).
 */
export const MODAL_CLOSE_TOP_OFFSET = -MODAL_HEIGHT * 0.24;

/**
 * Close-button top offset for the wider welcome/info overlay
 * (WelcomeModal — slightly taller inner container).
 */
export const MODAL_CLOSE_TOP_OFFSET_NARROW = -MODAL_HEIGHT * 0.19;

/**
 * Close-button top offset for compact overlay modals
 * (AvatarOptionsModal, UpdateUsernameModal).
 */
export const MODAL_CLOSE_TOP_OFFSET_SM = -MODAL_HEIGHT * 0.14;

// ---------------------------------------------------------------------------
// Avatars
// ---------------------------------------------------------------------------

/** Large avatar diameter — profile view (FullProfileDetailsModal). */
export const AVATAR_SIZE_LARGE = moderateScale(80);

/** Medium avatar diameter — thumbnail grid (PreloadedAvatarsModal). */
export const AVATAR_SIZE_MEDIUM = moderateScale(64);

/** Margin around each avatar thumbnail in a grid layout. */
export const AVATAR_THUMBNAIL_MARGIN = scale(8);

// ---------------------------------------------------------------------------
// Form inputs
// ---------------------------------------------------------------------------

/** Border radius for TextInput fields inside modals. */
export const INPUT_BORDER_RADIUS = moderateScale(8);

/** Inner padding for TextInput fields inside modals. */
export const INPUT_PADDING = scale(12);

// ---------------------------------------------------------------------------
// Cards (InstructionCard, TeamMemberCard, achievement rows, stat rows)
// ---------------------------------------------------------------------------

/** Border radius for card-style containers inside modals. */
export const CARD_BORDER_RADIUS = moderateScale(12);

/** Inner padding for card-style containers. */
export const CARD_PADDING = scale(16);

/** Bottom margin separating consecutive cards. */
export const CARD_MARGIN_BOTTOM = verticalScale(12);

// ---------------------------------------------------------------------------
// Color-clue indicators (InstructionsModal)
// ---------------------------------------------------------------------------

/** Side length of the square color-clue dot. */
export const COLOR_CLUE_INDICATOR_SIZE = scale(24);

/** Border radius of the color-clue dot. */
export const COLOR_CLUE_BORDER_RADIUS = moderateScale(4);

/** Right margin between the color-clue dot and its label. */
export const COLOR_CLUE_MARGIN_RIGHT = scale(12);

// ---------------------------------------------------------------------------
// Settings panel
// ---------------------------------------------------------------------------

/** Border radius of the white toggle-switch panel inside SettingsModal. */
export const SETTINGS_PANEL_BORDER_RADIUS = moderateScale(15);

// ---------------------------------------------------------------------------
// Content width constraints
// ---------------------------------------------------------------------------

/**
 * Maximum width for centred game content on large screens.
 * Below this value the layout spans the full screen width; above it the
 * content column is capped and centred so the game never feels stretched
 * across a large tablet or desktop viewport.
 *
 * Chosen so a 5-letter GuessGrid with max tile size still fits with room
 * for side padding on a 768 px large tablet.
 */
export const MAX_CONTENT_WIDTH = 560;

/**
 * Maximum width for auth and landing-page controls.
 * Keeps sign-in forms and button stacks readable on iPad / Android tablets
 * while still allowing phones to use the available safe-area width.
 */
export const AUTH_CONTENT_MAX_WIDTH = 430;

/** Responsive logo width for the unauthenticated landing screen. */
export const LANDING_LOGO_WIDTH = Math.min(moderateScale(320), viewport.screenWidth * 0.82, AUTH_CONTENT_MAX_WIDTH);

/** Responsive logo height preserving the source image aspect ratio. */
export const LANDING_LOGO_HEIGHT = LANDING_LOGO_WIDTH * (150 / 320);

// ---------------------------------------------------------------------------
// Game vertical slots
// ---------------------------------------------------------------------------

/** Header slot height as a percentage string, tuned per device tier. */
export const GAME_HEADER_SLOT_HEIGHT: DimensionValue = "8%";

/** Riddle area height as a percentage string, with more room on tablets. */
export const RIDDLE_CONTAINER_SLOT_HEIGHT: DimensionValue = viewport.isDesktop
  ? "26%"
  : viewport.isLargeTablet
    ? "26%"
    : viewport.isTablet
      ? "24%"
      : "20%";

/** Guess grid height as a percentage string, balanced against riddle growth. */
export const GUESS_GRID_SLOT_HEIGHT: DimensionValue = viewport.isDesktop
  ? "30%"
  : viewport.isLargeTablet
    ? "30%"
    : viewport.isTablet
      ? "31%"
      : "32%";

/** Equal vertical spacing used above and below the guess grid. */
export const GAME_BOARD_VERTICAL_GAP = viewport.isDesktop
  ? verticalScale(26)
  : viewport.isLargeTablet
    ? verticalScale(24)
    : viewport.isTablet
      ? verticalScale(20)
      : verticalScale(16);

// ---------------------------------------------------------------------------
// Guess Grid (game board)
// ---------------------------------------------------------------------------

/**
 * Maximum tile size before it is constrained by screen width or answer length.
 * Matches the base tile token while avoiding a constants/styles import cycle.
 */
export const GUESS_TILE_MAX_SIZE = scale(56);

/**
 * Effective grid width for tile-size calculations.
 * On phones the full screen width is used; on large tablets and desktop the
 * content column is capped at MAX_CONTENT_WIDTH so tiles don't grow too large.
 */
export const GUESS_GRID_EFFECTIVE_WIDTH = Math.min(
  viewport.screenWidth,
  viewport.isLargeTablet ? MAX_CONTENT_WIDTH : viewport.screenWidth,
);

/** Horizontal padding subtracted from screen width when computing tile size. */
export const GUESS_GRID_H_PADDING = scale(32);

/** Margin on each side of a guess tile. */
export const GUESS_TILE_MARGIN = scale(2);

/** Extra vertical gap added to each row height for spacing. */
export const GUESS_TILE_ROW_GAP = scale(4);

// ---------------------------------------------------------------------------
// Riddle Text
// ---------------------------------------------------------------------------

/** Fraction of screen width used as the riddle text max-width. */
export const RIDDLE_TEXT_MAX_WIDTH_FRACTION = 0.8;

/**
 * Pre-computed max-width for the riddle text.
 * On large screens the game column is capped at MAX_CONTENT_WIDTH, so the
 * riddle text must not exceed that cap × the width fraction.
 */
export const RIDDLE_TEXT_MAX_WIDTH = Math.min(viewport.screenWidth, MAX_CONTENT_WIDTH) * RIDDLE_TEXT_MAX_WIDTH_FRACTION;

// ---------------------------------------------------------------------------
// Game Input Bar
// ---------------------------------------------------------------------------

/** Height of the Hint / Next action buttons in the game input row. */
export const GAME_INPUT_BUTTON_HEIGHT = verticalScale(48);

/** Horizontal padding for the Submit Guess pill button. */
export const SUBMIT_BUTTON_PADDING_H = scale(32);

// ---------------------------------------------------------------------------
// Header
// ---------------------------------------------------------------------------

/** Width/height of the Riddle Quest logo icon in the game header. */
export const HEADER_LOGO_SIZE = moderateScale(44);

/** Width/height of the back-navigation arrow icon on auth/stack screens. */
export const BACK_ICON_SIZE = moderateScale(35);

// ---------------------------------------------------------------------------
// Large decorative icons
// ---------------------------------------------------------------------------

/** Width/height of the large coin-stack icon in VictoryModal. */
export const COIN_ICON_SIZE_LARGE = moderateScale(125);

/** Width/height of the coin icon in the in-game header coins display. */
export const COIN_DISPLAY_ICON_SIZE = moderateScale(32);

/** Width/height of the circular status icon in each achievement row. */
export const ACHIEVEMENT_ICON_SIZE = moderateScale(40);

/** Width/height of large decorative icons on auth screens (e.g. padlock). */
export const AUTH_ICON_SIZE = moderateScale(80);

// ---------------------------------------------------------------------------
// Static Title (loading / branding overlay)
// ---------------------------------------------------------------------------

/** Horizontal padding inside the semi-transparent title pill. */
export const STATIC_TITLE_PADDING_H = scale(30);

/** Vertical padding inside the semi-transparent title pill. */
export const STATIC_TITLE_PADDING_V = verticalScale(15);

// ---------------------------------------------------------------------------
// Social Share Buttons
// ---------------------------------------------------------------------------

/** Horizontal icon-centering offset for the Facebook share button (pre-scaled). */
export const SOCIAL_BUTTON_FACEBOOK_OFFSET_X = scale(-15);

/** Horizontal icon-centering offset for the X (Twitter) share button (pre-scaled). */
export const SOCIAL_BUTTON_X_OFFSET_X = scale(5);

/** Minimum width of a small social share button. */
export const SOCIAL_BUTTON_MIN_WIDTH_SM = scale(80);

/** Minimum width of a medium social share button. */
export const SOCIAL_BUTTON_MIN_WIDTH_MD = scale(120);

/** Minimum width of a large social share button. */
export const SOCIAL_BUTTON_MIN_WIDTH_LG = scale(160);

// ---------------------------------------------------------------------------
// Keyboard
// ---------------------------------------------------------------------------
//
// Keyboard dimensions use moderateScale() rather than scale() so they grow
// more slowly on large tablets and desktop. With scale(), the top row
// (10 keys × key_width + 2×margin) exceeds MAX_CONTENT_WIDTH on large
// tablet (≈ 570 px) and desktop (≈ 620 px). moderateScale() keeps all
// rows within the 560 px content cap at every device tier:
//   phone        ≈ 377 px top row
//   tablet       ≈ 440 px top row
//   large tablet ≈ 480 px top row
//   desktop      ≈ 500 px top row

/** Height of each letter key. */
export const KEYBOARD_KEY_HEIGHT = moderateScale(36);

/** Width of each letter key. */
export const KEYBOARD_KEY_WIDTH = moderateScale(35);

/** Margin around each key. */
export const KEYBOARD_KEY_MARGIN = moderateScale(1.65);

/** Border radius of each key. */
export const KEYBOARD_KEY_BORDER_RADIUS = moderateScale(6);

/** Margin below the middle keyboard row (QWERTY offset). */
export const KEYBOARD_MID_ROW_MARGIN_BOTTOM = moderateScale(5);

/** Width of the half-key spacer used to indent the middle row. */
export const KEYBOARD_ROW_SPACER = moderateScale(16);

/** Width of the spacer that centres the bottom row, and of the backspace key. */
export const KEYBOARD_BOTTOM_OFFSET = moderateScale(48);

export const wheelSize = Math.ceil(Math.sqrt(MODAL_WIDTH ** 2 + MODAL_HEIGHT ** 2) * 1.2);
