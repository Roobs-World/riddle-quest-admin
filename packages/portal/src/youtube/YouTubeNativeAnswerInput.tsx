import {forwardRef, useRef} from "react";

/** Native text/IME entry point. Committed text is consumed into grapheme slots by the caller. */
export const YouTubeNativeAnswerInput = forwardRef<HTMLInputElement, {
  disabled: boolean;
  locale: string;
  label: string;
  onText: (text: string) => void;
  onBackspace: () => void;
  onSubmit: () => void;
}>(function YouTubeNativeAnswerInput(
  {disabled, locale, label, onText, onBackspace, onSubmit},
  forwardedRef,
) {
  const composing = useRef(false);
  const justCommitted = useRef<string | null>(null);
  const consume = (input: HTMLInputElement): void => {
    const value = input.value.normalize("NFC");
    input.value = "";
    if (value) onText(value);
  };

  return <input
    ref={forwardedRef}
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
    onCompositionStart={() => { composing.current = true; }}
    onCompositionEnd={(event) => {
      composing.current = false;
      justCommitted.current = event.currentTarget.value.normalize("NFC");
      consume(event.currentTarget);
      queueMicrotask(() => { justCommitted.current = null; });
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
  />;
});
