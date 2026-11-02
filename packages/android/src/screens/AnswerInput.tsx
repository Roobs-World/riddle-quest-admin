import {normalizeLatinShortcutKey} from "@riddle-quest/solo";
import type {ComponentRef, RefObject} from "react";
import {Pressable, StyleSheet, Text, TextInput, View} from "react-native";
import {palette, radius, spacing} from "../theme";
/** Native editor instance exposed through refs. */
export type AnswerEditor = ComponentRef<typeof TextInput>;
/** Fixed Latin shortcut rows shown beneath the native editor for Latin answers. */
const LATIN_ROWS: readonly (readonly string[])[] = [
  "QWERTYUIOP".split(""),
  "ASDFGHJKL".split(""),
  "ZXCVBNM".split(""),
];
/** Props for {@link AnswerInput}. */
export type AnswerInputProps = Readonly<{
  /** Native editor reference used to restore focus after actions. */
  inputRef: RefObject<AnswerEditor | null>;
  /** Whether editing is unavailable. */
  disabled: boolean;
  /** Active locale. */
  locale: string;
  /** Accessible label and placeholder. */
  label: string;
  /** Whether to show the fixed Latin shortcut keys. */
  latinShortcut: boolean;
  /** Inserts committed text into the answer slots. */
  onText: (text: string) => void;
  /** Deletes the active answer letter. */
  onBackspace: () => void;
  /** Submits the current answer. */
  onSubmit: () => void;
}>;
/**
 * Native IME entry plus the Playable's fixed Latin shortcut keyboard.
 *
 * @remarks
 * The editor stays empty: committed text is consumed into grapheme slots by the
 * authority, exactly as the web Playable consumes its native input. While the
 * Latin shortcut keys are shown the system keyboard stays hidden so it cannot
 * cover them; hardware keyboards still type into the focused editor.
 */
export function AnswerInput({inputRef, disabled, locale, label, latinShortcut, onText, onBackspace, onSubmit}: AnswerInputProps) {
  /** Focuses the native editor so physical typing keeps working after a shortcut. */
  const focusEditor = (): void => inputRef.current?.focus();
  return (
    <View style={styles.container}>
      <TextInput
        ref={inputRef}
        accessibilityLabel={label}
        autoCapitalize="none"
        autoComplete="off"
        autoCorrect={false}
        blurOnSubmit={false}
        editable={!disabled}
        enterKeyHint="done"
        importantForAutofill="no"
        onChangeText={(value) => {
          /** NFC text ready for grapheme consumption. */
          const normalized = value.normalize("NFC");
          if (normalized) onText(normalized);
        }}
        onKeyPress={(event) => {
          if (event.nativeEvent.key === "Backspace") onBackspace();
        }}
        onSubmitEditing={onSubmit}
        placeholder={label}
        placeholderTextColor={palette.muted}
        showSoftInputOnFocus={!latinShortcut}
        spellCheck={false}
        style={styles.editor}
        testID="answer-input"
        value=""
        {...(locale === "ar" ? {textAlign: "right" as const} : {})}
      />
      {latinShortcut && (
        <View accessibilityLabel={label} style={styles.keyboard} testID="latin-keyboard">
          {LATIN_ROWS.map((row, rowIndex) => (
            <View key={rowIndex} style={styles.keyboardRow}>
              {row.map((letter) => (
                <Pressable
                  key={letter}
                  accessibilityRole="button"
                  accessibilityLabel={letter}
                  disabled={disabled}
                  onPress={() => {
                    onText(normalizeLatinShortcutKey(letter));
                    focusEditor();
                  }}
                  style={({pressed}) => [styles.key, disabled && styles.keyDisabled, pressed && styles.keyPressed]}
                  testID={`key-${letter}`}
                >
                  <Text style={styles.keyLabel}>{letter}</Text>
                </Pressable>
              ))}
              {rowIndex === LATIN_ROWS.length - 1 && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="⌫"
                  disabled={disabled}
                  onPress={() => {
                    onBackspace();
                    focusEditor();
                  }}
                  style={({pressed}) => [styles.key, styles.keyWide, disabled && styles.keyDisabled, pressed && styles.keyPressed]}
                  testID="key-backspace"
                >
                  <Text style={styles.keyLabel}>⌫</Text>
                </Pressable>
              )}
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
/** Styles for the answer editor. */
const styles = StyleSheet.create({
  container: {gap: spacing.sm},
  editor: {
    minHeight: 48,
    paddingHorizontal: spacing.md,
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.tile,
    color: palette.text,
    fontSize: 18,
  },
  keyboard: {gap: spacing.xs + 2},
  keyboardRow: {flexDirection: "row", justifyContent: "center", gap: spacing.xs + 2},
  key: {
    minWidth: 30,
    flexGrow: 1,
    maxWidth: 40,
    height: 44,
    borderRadius: 8,
    backgroundColor: palette.control,
    alignItems: "center",
    justifyContent: "center",
  },
  keyWide: {maxWidth: 64, flexGrow: 1.6},
  keyDisabled: {opacity: 0.45},
  keyPressed: {backgroundColor: palette.tileHinted},
  keyLabel: {color: palette.text, fontSize: 16, fontWeight: "600"},
});
