import {forwardRef, useRef} from "react";
import {splitGraphemes} from "@qwordly/core/game";
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
  /** Native deletion events preserve software-keyboard editing without disturbing IME text. */
  const inputRef = useNativeAnswerBackspace(forwardedRef, composing, onBackspace);
  /** Provides just committed composition behavior. */
  const justCommittedComposition = useRef<string | null>(null);
  /** Provides consume behavior. */
  const consume = (input: HTMLInputElement) => {
    /** Provides graphemes behavior. */
    const graphemes = nativeAnswerGraphemes(input.value);
    input.value = "";
    if (graphemes.length > 0) onText(graphemes.join(""));
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
      onCompositionStart={() => {
        composing.current = true;
      }}
      onCompositionEnd={(event) => {
        composing.current = false;
        justCommittedComposition.current = event.currentTarget.value.normalize("NFC");
        consume(event.currentTarget);
        queueMicrotask(() => {
          justCommittedComposition.current = null;
        });
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
        consume(event.currentTarget);
      }}
      onKeyDown={(event) => {
        if (event.nativeEvent.isComposing || composing.current) return;
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
