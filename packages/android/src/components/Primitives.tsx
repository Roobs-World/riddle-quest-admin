import type {ReactNode} from "react";
import {Pressable, ScrollView, StyleSheet, Text, View, type StyleProp, type ViewStyle} from "react-native";
import {useSafeAreaInsets} from "react-native-safe-area-context";
import {palette, radius, spacing} from "../theme";
/** Visual weight of an action. */
export type ActionTone = "primary" | "secondary" | "danger";
/** Props for {@link ActionButton}. */
export type ActionButtonProps = Readonly<{
  /** Visible label. */
  label: string;
  /** Press handler. */
  onPress: () => void;
  /** Whether presses are ignored. */
  disabled?: boolean;
  /** Visual weight; secondary by default. */
  tone?: ActionTone;
  /** Stable automation identifier. */
  testID?: string;
  /** Extra container style. */
  style?: StyleProp<ViewStyle>;
}>;
/** Shared button that mirrors the Playable's primary, secondary, and danger controls. */
export function ActionButton({label, onPress, disabled = false, tone = "secondary", testID, style}: ActionButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{disabled}}
      disabled={disabled}
      onPress={onPress}
      testID={testID}
      style={({pressed}) => [
        styles.button,
        tone === "primary" && styles.buttonPrimary,
        tone === "danger" && styles.buttonDanger,
        disabled && styles.buttonDisabled,
        pressed && !disabled && styles.buttonPressed,
        style,
      ]}
    >
      <Text style={[styles.buttonLabel, tone === "primary" && styles.buttonLabelPrimary]}>{label}</Text>
    </Pressable>
  );
}
/** Props for {@link Screen}. */
export type ScreenProps = Readonly<{
  /** Screen content. */
  children: ReactNode;
  /** Whether content is vertically centered instead of top-aligned. */
  centered?: boolean;
  /** Whether host lifecycle paused interaction. */
  paused?: boolean;
  /** Stable automation identifier. */
  testID?: string;
}>;
/** Full-height scrollable surface with the Playable background and safe-area padding. */
export function Screen({children, centered = false, paused = false, testID}: ScreenProps) {
  /** Device safe-area insets. */
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.screenContent,
        centered && styles.screenCentered,
        {paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + spacing.lg},
      ]}
      keyboardShouldPersistTaps="always"
      pointerEvents={paused ? "none" : "auto"}
      testID={testID}
    >
      {children}
    </ScrollView>
  );
}
/** Props for {@link Panel}. */
export type PanelProps = Readonly<{
  /** Panel content. */
  children: ReactNode;
  /** Extra container style. */
  style?: StyleProp<ViewStyle>;
}>;
/** Raised content card. */
export function Panel({children, style}: PanelProps) {
  return <View style={[styles.panel, style]}>{children}</View>;
}
/** Props for {@link Eyebrow}. */
export type EyebrowProps = Readonly<{
  /** Small caption text. */
  children: string;
}>;
/** Small caption above a heading. */
export function Eyebrow({children}: EyebrowProps) {
  return <Text style={styles.eyebrow}>{children}</Text>;
}
/** Props for {@link Heading}. */
export type HeadingProps = Readonly<{
  /** Heading text. */
  children: string;
  /** Heading level; 1 by default. */
  level?: 1 | 2;
  /** Stable automation identifier. */
  testID?: string;
}>;
/** Screen or section heading. */
export function Heading({children, level = 1, testID}: HeadingProps) {
  return (
    <Text accessibilityRole="header" style={level === 1 ? styles.heading : styles.subheading} testID={testID}>
      {children}
    </Text>
  );
}
/** Props for {@link Notice}. */
export type NoticeProps = Readonly<{
  /** Notice text. */
  children: string;
  /** Whether the notice reports a failure. */
  error?: boolean;
  /** Stable automation identifier. */
  testID?: string;
}>;
/** Inline status or alert text announced to assistive technology. */
export function Notice({children, error = false, testID}: NoticeProps) {
  return (
    <View
      accessibilityLiveRegion={error ? "assertive" : "polite"}
      accessibilityRole="alert"
      style={[styles.notice, error && styles.noticeError]}
      testID={testID}
    >
      <Text style={styles.noticeText}>{children}</Text>
    </View>
  );
}
/** Props for {@link Banner}. */
export type BannerProps = Readonly<{
  /** Banner message. */
  message: string;
  /** Action label. */
  actionLabel: string;
  /** Action handler. */
  onAction: () => void;
  /** Whether the banner reports a failure. */
  error?: boolean;
  /** Whether the action is unavailable. */
  disabled?: boolean;
  /** Stable automation identifier. */
  testID?: string;
}>;
/** Message with one action, used for recovery, guidance, and save-retry prompts. */
export function Banner({message, actionLabel, onAction, error = false, disabled = false, testID}: BannerProps) {
  return (
    <View
      accessibilityLiveRegion="polite"
      accessibilityRole={error ? "alert" : "none"}
      style={[styles.banner, error && styles.bannerError]}
      testID={testID}
    >
      <Text style={styles.bannerText}>{message}</Text>
      <ActionButton label={actionLabel} onPress={onAction} disabled={disabled} style={styles.bannerAction} />
    </View>
  );
}
/** Styles shared by the primitives. */
const styles = StyleSheet.create({
  screen: {flex: 1, backgroundColor: palette.background},
  screenContent: {paddingHorizontal: spacing.md, gap: spacing.md},
  screenCentered: {flexGrow: 1, justifyContent: "center"},
  panel: {
    backgroundColor: palette.panel,
    borderRadius: radius.panel,
    padding: spacing.md,
    gap: spacing.md,
  },
  eyebrow: {color: palette.muted, fontSize: 13, letterSpacing: 1, textTransform: "uppercase"},
  heading: {color: palette.text, fontSize: 28, fontWeight: "700"},
  subheading: {color: palette.text, fontSize: 20, fontWeight: "600"},
  button: {
    minHeight: 48,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.control,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonPrimary: {backgroundColor: palette.primaryEnd, borderColor: palette.primaryStart},
  buttonDanger: {backgroundColor: palette.danger, borderColor: palette.dangerBorder},
  buttonDisabled: {opacity: 0.45},
  buttonPressed: {transform: [{scale: 0.98}]},
  buttonLabel: {color: palette.text, fontSize: 16, fontWeight: "600", textAlign: "center"},
  buttonLabelPrimary: {color: palette.onPrimary},
  notice: {backgroundColor: palette.notice, borderRadius: radius.control, padding: spacing.sm + spacing.xs},
  noticeError: {backgroundColor: palette.errorBanner, borderWidth: 1, borderColor: palette.errorBorder},
  noticeText: {color: palette.text, fontSize: 15},
  banner: {
    backgroundColor: palette.banner,
    borderRadius: radius.control,
    padding: spacing.sm + spacing.xs,
    gap: spacing.sm,
  },
  bannerError: {backgroundColor: palette.errorBanner, borderWidth: 1, borderColor: palette.errorBorder},
  bannerText: {color: palette.text, fontSize: 15},
  bannerAction: {alignSelf: "flex-start", minHeight: 40},
});
