/**
 * Color Design Tokens
 * Centralized color definitions for the Riddle Quest app
 */

export const COLORS = {
  // Primary palette
  primaryOrange: "#FF8C00",
  primaryOrangeLight: "#FFB347",
  primaryOrangeDark: "#E67C00",

  // Neutrals
  black: "#000000",
  white: "#FFFFFF",
  gray100: "#F3F4F6",
  gray200: "#E5E7EB",
  gray300: "#D1D5DB",
  gray400: "#9CA3AF",
  gray500: "#6B7280",
  gray600: "#4B5563",
  gray700: "#374151",
  gray800: "#1F2937",
  gray900: "#111827",

  // Semantic colors
  success: "#10B981",
  warning: "#F59E0B",
  error: "#EF4444",
  info: "#3B82F6",

  // Background colors
  backgroundPrimary: "#FFFFFF",
  backgroundSecondary: "#F9FAFB",
  backgroundDark: "#2A2A2A",

  // Text colors
  textPrimary: "#222222",
  textSecondary: "#6B7280",
  textMuted: "#9CA3AF",
  textInverse: "#FFFFFF",

  // Game-specific colors — Figma brand palette
  tileCorrect: "#401F40",
  tilePartial: "#FEC880",
  tileIncorrect: "#F54160",
  tileDefault: "#FCFAF4",

  // Figma brand colours
  figmaPurple: "#401F40",
  figmaGold: "#FEC880",
  figmaCrimson: "#F54160",
  figmaCream: "#FCFAF4",

  // Legacy colors (for backward compatibility)
  activeTextColor: "#222222",
  shadowColor: "#000000",
  transparent: "transparent",

  // Navigation bar colors
  navBarBackground: "rgba(252, 250, 244, 0.8)",
  navBarBorder: "rgba(0, 0, 0, 0.05)",

  // Starry background colors
  starryBackgroundMain: "#0a0a2e",
  starryBackgroundTop: "#000033",
  starryBackgroundBottom: "#000000",
  starColor: "#ffffff",

  // Text shadow colors
  textShadowDark: "rgba(0, 0, 0, 0.75)",
} as const;
