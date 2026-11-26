/**
 * Visual constants mirroring the web Playable stylesheet so both surfaces read as one game.
 *
 * @remarks
 * Values come from `src/gameplay/styles/local-game.css`; keep them aligned when
 * the web palette changes.
 */
export const palette = Object.freeze({
  /** Page background. */
  background: "#090b24",
  /** Default text. */
  text: "#f8f7ff",
  /** Secondary text. */
  muted: "#c8c3ff",
  /** Tertiary text. */
  subtle: "#d7d4ea",
  /** Highlight used for active borders and primary actions. */
  accent: "#f4c84a",
  /** Raised panel surface. */
  panel: "rgba(27, 29, 72, 0.92)",
  /** Default control surface. */
  control: "rgba(255, 255, 255, 0.08)",
  /** Default control border. */
  border: "rgba(255, 255, 255, 0.2)",
  /** Primary action gradient start. */
  primaryStart: "#ffe17b",
  /** Primary action gradient end, used as the flat native fill. */
  primaryEnd: "#f0b92f",
  /** Text on primary actions. */
  onPrimary: "#171221",
  /** Destructive action fill. */
  danger: "#7b2033",
  /** Destructive action border. */
  dangerBorder: "#ff8d9c",
  /** Informational banner fill. */
  banner: "rgba(0, 0, 0, 0.28)",
  /** Error banner fill. */
  errorBanner: "#582635",
  /** Error banner border. */
  errorBorder: "#ff9aa8",
  /** Notice fill. */
  notice: "#173e38",
  /** Empty tile fill. */
  tile: "rgba(3, 5, 22, 0.5)",
  /** Correct-letter tile fill. */
  tileGreen: "#176948",
  /** Correct-letter tile border. */
  tileGreenBorder: "#84e7b6",
  /** Misplaced-letter tile fill. */
  tileYellow: "#7c611a",
  /** Misplaced-letter tile border. */
  tileYellowBorder: "#ffe47d",
  /** Absent-letter tile fill. */
  tileRed: "#793146",
  /** Absent-letter tile border. */
  tileRedBorder: "#fd9dac",
  /** Hint-revealed tile fill. */
  tileHinted: "#234e7d",
  /** Hint-revealed tile border. */
  tileHintedBorder: "#93c9ff",
});
/** Spacing scale in density-independent pixels. */
export const spacing = Object.freeze({
  /** Tight gap. */
  xs: 4,
  /** Small gap. */
  sm: 8,
  /** Default gap. */
  md: 16,
  /** Section gap. */
  lg: 24,
  /** Screen gutter. */
  xl: 32,
});
/** Corner radius for controls and panels. */
export const radius = Object.freeze({
  /** Buttons and tiles. */
  control: 14,
  /** Panels. */
  panel: 20,
});
