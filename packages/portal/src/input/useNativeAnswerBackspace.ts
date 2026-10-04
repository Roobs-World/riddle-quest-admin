import {useEffect, useLayoutEffect, useImperativeHandle, useRef, type ForwardedRef, type RefObject} from "react";

/** Handles software-keyboard deletions when the answer editor consumes text into separate slots. */
export function useNativeAnswerBackspace(forwardedRef: ForwardedRef<HTMLInputElement>,
  composing: RefObject<boolean>, onBackspace: () => void, onEditIntent?: () => void): RefObject<HTMLInputElement | null> {
  /** Mounted native editor receives input events even when its consumed value is empty. */
  const inputRef = useRef<HTMLInputElement | null>(null);
  /** Event subscription keeps the latest committed editor callback without resubscribing after every key. */
  const callbackRef = useRef(onBackspace);
  /** Ordinary native edits retire composition deduplication without requiring a physical keydown. */
  const editIntentRef = useRef(onEditIntent);
  // Suspended renders must not change callbacks for the still-visible editor.
  useLayoutEffect(() => {
    callbackRef.current = onBackspace;
    editIntentRef.current = onEditIntent;
  }, [onBackspace, onEditIntent]);
  // Imperative handles run after the input's DOM ref has been attached.
  useImperativeHandle(forwardedRef, () => inputRef.current!, []);
  useEffect(() => {
    /** Native event listener avoids React's text-insertion-oriented beforeinput synthesis. */
    const input = inputRef.current;
    if (!input) return;
    /** Retained native callbacks cannot delete from a retired editor. */
    let listening = true;
    /** A software keyboard may omit keydown; composition editing belongs to the native editor. */
    const beforeInput = (event: InputEvent) => {
      if (!listening || !input.isConnected || event.defaultPrevented || input.disabled || composing.current || event.isComposing || !event.inputType ||
        ["insertCompositionText", "insertFromComposition", "deleteCompositionText"].includes(event.inputType)) return;
      editIntentRef.current?.();
      if (event.inputType !== "deleteContentBackward") return;
      event.preventDefault();
      callbackRef.current();
    };
    input.addEventListener("beforeinput", beforeInput);
    return () => { listening = false; input.removeEventListener("beforeinput", beforeInput); };
  }, [composing]);
  return inputRef;
}
