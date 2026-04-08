/**
 * Shared constants for loading indicators (e.g. PulsingSpinner) used across screens and navigation.
 * Keeps size and opacity consistent and avoids magic numbers.
 */

/** Default size (width/height) for the full-screen loading spinner in px. */
export const LOADING_SPINNER_SIZE = 120;

/** Default opacity for in-screen loading (e.g. GameScreen, auth screens). */
export const LOADING_SPINNER_OPACITY = 0.7;

/** Opacity for the root navigation loading overlay (auth/riddle init). Slightly higher for overlay visibility. */
export const LOADING_SPINNER_OPACITY_OVERLAY = 0.8;
