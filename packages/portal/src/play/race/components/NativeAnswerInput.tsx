import {forwardRef, useRef} from "react";
import {splitGraphemes} from "@riddle-quest/core/game";
import {tr} from "../../i18n";
import {useNativeAnswerBackspace} from "../../../input/useNativeAnswerBackspace";

/** Normalizes pasted or committed IME text into user-perceived answer units. */
export const nativeAnswerGraphemes = (value: string): string[] => splitGraphemes(value.normalize("NFC"));

/** Focus target that delegates non-Latin and IME text entry to the device keyboard. */
export const NativeAnswerInput = forwardRef<
  HTMLInputElement,
  {
    /** Stores disabled. */
    disabled: boolean;
    /** Stores locale. */
    locale: string;
    /** Stores on text. */
    onText: (text: string) => void;
    /** Stores on backspace. */
    onBackspace: () => void;
    /** Stores on submit. */
    onSubmit: () => void;
  }
>(function NativeAnswerInput({disabled, locale, onText, onBackspace, onSubmit}, forwardedRef) {
  /** Provides composing behavior. */
  const composing = useRef(false);
  /** Retains one committed value until its trailing input or a new edit, across browser tasks. */
  const justCommittedComposition = useRef<string | null>(null);
  /** Native deletion events preserve software-keyboard editing without disturbing IME text. */
  const inputRef = useNativeAnswerBackspace(forwardedRef, composing, onBackspace, () => {justCommittedComposition.current = null;});
  /** Provides consume behavior. */
  const consume = (input: HTMLInputElement) => {
    /** The answer editor owns bounded segmentation; the native editor supplies normalized text once. */
    const text = input.value.normalize("NFC");
    input.value = "";
    if (text) onText(text);
  };

  return (
    <input
      ref={inputRef}
      className="race-native-answer-input"
      type="text"
      inputMode="text"
      enterKeyHint="done"
      autoCapitalize="none"
      autoComplete="off"
      autoCorrect="off"
      spellCheck={false}
      lang={locale}
      dir={locale === "ar" ? "rtl" : "auto"}
      disabled={disabled}
      aria-label={tr("Accessibility.VIRTUAL_KEYBOARD")}
      onPaste={() => {justCommittedComposition.current = null;}}
      onCompositionStart={() => {
        justCommittedComposition.current = null;
        composing.current = true;
      }}
      onCompositionEnd={(event) => {
        composing.current = false;
        justCommittedComposition.current = event.currentTarget.value.normalize("NFC");
        consume(event.currentTarget);
      }}
      onInput={(event) => {
        if (composing.current) return;
        if (
          justCommittedComposition.current !== null &&
          event.currentTarget.value.normalize("NFC") === justCommittedComposition.current
        ) {
          event.currentTarget.value = "";
          justCommittedComposition.current = null;
          return;
        }
        justCommittedComposition.current = null;
        consume(event.currentTarget);
      }}
      onKeyDown={(event) => {
        if (event.defaultPrevented || event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229 || composing.current) return;
        // Navigation and modifiers are not a new edit; a delayed IME tail still owns its marker.
        if (event.key === "Backspace" || event.key === "Enter" ||
          (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey)) justCommittedComposition.current = null;
        if (event.key === "Backspace") {
          event.preventDefault();
          onBackspace();
        } else if (event.key === "Enter") {
          event.preventDefault();
          onSubmit();
        }
      }}
    />
  );
});
