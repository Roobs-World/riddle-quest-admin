import {useAnswerKeyboard} from "../../game/hooks/useAnswerKeyboard";

/** Keyboard actions accepted by active multiplayer gameplay. */
export type RaceGameplayKeyboardOptions = {
  /** Stores active. */
  active: boolean;
  /** Stores on letter. */
  onLetter: (letter: string) => void;
  /** Stores on backspace. */
  onBackspace: () => void;
  /** Stores on submit. */
  onSubmit: () => void;
};

/** Connects physical keyboard input to the controlled multiplayer answer editor. */
export function useRaceGameplayKeyboard({active, onLetter, onBackspace, onSubmit}: RaceGameplayKeyboardOptions): void {
  useAnswerKeyboard({active, onLetter, onBackspace, onSubmit});
}
