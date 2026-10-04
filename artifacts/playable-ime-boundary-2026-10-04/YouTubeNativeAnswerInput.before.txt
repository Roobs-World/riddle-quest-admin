import {forwardRef, useRef} from "react";
import {useNativeAnswerBackspace} from "../input/useNativeAnswerBackspace";
/** Native text/IME entry point. Committed text is consumed into grapheme slots by the caller. */
export const YouTubeNativeAnswerInput = forwardRef<
  HTMLInputElement,
  {
    /** Stores disabled. */
    disabled: boolean;
    /** Stores locale. */
    locale: string;
    /** Stores label. */
    label: string;
    /** Stores on text. */
    onText: (text: string) => void;
    /** Stores on backspace. */
    onBackspace: () => void;
    /** Stores on submit. */
    onSubmit: () => void;
  }
>(function YouTubeNativeAnswerInput({disabled, locale, label, onText, onBackspace, onSubmit}, forwardedRef) {
  /** Provides composing behavior. */
  const composing = useRef(false);
  /** Software-keyboard backspace edits answer slots after committed text is consumed. */
  const inputRef = useNativeAnswerBackspace(forwardedRef, composing, onBackspace);
  /** Provides just committed behavior. */
  const justCommitted = useRef<string | null>(null);
  /** Provides consume behavior. */
  const consume = (input: HTMLInputElement): void => {
    /** Provides value behavior. */
    const value = input.value.normalize("NFC");
    input.value = "";
    if (value) onText(value);
  };

  return (
    <input
      ref={inputRef}
      className="yt-answer-native"
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
      aria-label={label}
      placeholder={label}
      onCompositionStart={() => {
        composing.current = true;
      }}
      onCompositionEnd={(event) => {
        composing.current = false;
        justCommitted.current = event.currentTarget.value.normalize("NFC");
        consume(event.currentTarget);
        queueMicrotask(() => {
          justCommitted.current = null;
        });
      }}
      onInput={(event) => {
        if (composing.current) return;
        if (justCommitted.current !== null && event.currentTarget.value.normalize("NFC") === justCommitted.current) {
          event.currentTarget.value = "";
          justCommitted.current = null;
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
        // Escape is intentionally untouched for YouTube certification.
      }}
    />
  );
});
