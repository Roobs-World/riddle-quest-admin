import {Pressable, StyleSheet, Text} from "react-native";
import {palette, radius, spacing} from "../theme";
/** Props for {@link ModeCard}. */
export type ModeCardProps = Readonly<{
  /** Decorative glyph. */
  glyph: string;
  /** Mode name. */
  title: string;
  /** Progress or availability caption. */
  caption: string;
  /** Whether the mode cannot start. */
  disabled: boolean;
  /** Starts the mode. */
  onPress: () => void;
  /** Stable automation identifier. */
  testID: string;
}>;
/** Large tappable card for one game mode, shared by the offline menu and the hosted home. */
export function ModeCard({glyph, title, caption, disabled, onPress, testID}: ModeCardProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}: ${caption}`}
      accessibilityState={{disabled}}
      disabled={disabled}
      onPress={onPress}
      testID={testID}
      style={({pressed}) => [styles.modeCard, disabled && styles.modeCardDisabled, pressed && !disabled && styles.modeCardPressed]}
    >
      <Text style={styles.modeGlyph}>{glyph}</Text>
      <Text style={styles.modeTitle}>{title}</Text>
      <Text style={styles.modeCaption}>{caption}</Text>
    </Pressable>
  );
}
/** Styles for the card. */
const styles = StyleSheet.create({
  modeCard: {
    flex: 1,
    minHeight: 150,
    padding: spacing.md,
    borderRadius: radius.panel,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.panel,
    gap: spacing.sm,
    justifyContent: "flex-end",
  },
  modeCardDisabled: {opacity: 0.45},
  modeCardPressed: {borderColor: palette.accent},
  modeGlyph: {fontSize: 36},
  modeTitle: {color: palette.text, fontSize: 20, fontWeight: "700"},
  modeCaption: {color: palette.subtle, fontSize: 14},
});
