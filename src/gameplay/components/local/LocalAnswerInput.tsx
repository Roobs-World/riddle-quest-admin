import {forwardRef, useEffect, useRef} from "react";
import {useNativeAnswerBackspace} from "../../input/browser/useNativeAnswerBackspace";
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
  /** Retains one committed value until its trailing input or a new edit, across browser tasks. */
  const justCommitted = useRef<string | null>(null);
  /** Software-keyboard backspace edits answer slots after committed text is consumed. */
  const inputRef = useNativeAnswerBackspace(forwardedRef, composing, onBackspace, () => {justCommitted.current = null;});
  useEffect(() => {
    if (!disabled) return;
    // Disabling the editor retires an unfinished composition even if its end
    // event is missing or delayed. Preserve a marker for its trailing input.
    if (composing.current) {
      justCommitted.current = inputRef.current?.value.normalize("NFC") ?? null;
      composing.current = false;
    }
    if (inputRef.current) inputRef.current.value = "";
  }, [disabled, inputRef]);
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
      onPaste={() => {justCommitted.current = null;}}
      onCompositionStart={() => {
        if (disabled) return;
        justCommitted.current = null;
        composing.current = true;
      }}
      onCompositionEnd={(event) => {
        /** Only a composition owned by this editable interval may publish text. */
        const activeComposition = composing.current;
        composing.current = false;
        justCommitted.current = event.currentTarget.value.normalize("NFC");
        if (activeComposition && !disabled) consume(event.currentTarget);
        else event.currentTarget.value = "";
      }}
      onInput={(event) => {
        if (composing.current) return;
        if (justCommitted.current !== null && event.currentTarget.value.normalize("NFC") === justCommitted.current) {
          event.currentTarget.value = "";
          justCommitted.current = null;
          return;
        }
        justCommitted.current = null;
        consume(event.currentTarget);
      }}
      onKeyDown={(event) => {
        // Some IMEs mark the boundary key with 229 before isComposing becomes available.
        if (event.defaultPrevented || event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229 || composing.current) return;
        // Navigation and modifiers are not a new edit; a delayed IME tail still owns its marker.
        if (event.key === "Backspace" || event.key === "Enter" ||
          (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey)) justCommitted.current = null;
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
