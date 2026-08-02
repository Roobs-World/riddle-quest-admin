import type {CSSProperties, Dispatch} from "react";
import {splitGraphemes, type Feedback, type ScoredGuess} from "@qwordly/core/game";
import mascotUrl from "../../../../assets/images-web/riddlequest-r.webp";
import coinUrl from "../../../../assets/images/coin.svg";
import backspaceUrl from "../../../../assets/images/backspace-key.svg";
import {tr} from "./i18n";
import {gameSessionReducer, type GameSessionState} from "./gameSession";

const KEYBOARD_ROWS = ["QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM"];

export function GameHeader({state, displayedCoins, onOpenShop}: {
  state: GameSessionState;
  displayedCoins?: number;
  onOpenShop: () => void;
}) {
  const coinBalance = displayedCoins ?? state.profile?.coins ?? 0;
  return (
    <header className="game-header">
      <img className="game-logo" src={mascotUrl} alt={tr("Accessibility.LOGO_BUTTON")} />
      <div className="game-mode-label">
        {state.gameMode === "challenge" ? tr("WebPortal.PLAY_DAILY") : tr("WebPortal.PLAY_CLASSIC")}
      </div>
      <button type="button" className="coin-pill" data-tooltip="gameCoins" data-coin-meter
        aria-label={tr("Navigation.BUY_COINS_BUTTON")} onClick={onOpenShop}>
        <strong>{coinBalance.toLocaleString()}</strong>
        <img src={coinUrl} alt="" />
      </button>
    </header>
  );
}

export function SoundIcon({muted}: {muted: boolean}) {
  return <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M4 9v6h4l5 4V5L8 9H4Z" />
    {!muted && <path d="M16 8.5c1.3 1.3 1.3 5.7 0 7M18.8 6c3.3 3.3 3.3 8.7 0 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />}
    {muted && <path d="m16 9 5 6m0-6-5 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />}
  </svg>;
}

export function HintIcon() {
  return <svg className="native-control-icon" viewBox="0 0 25 24" aria-hidden="true"><path d="M21.65 6.17C21.24 5.95 20.38 5.72 19.21 6.54L17.74 7.58C17.63 4.47 16.28 3.25 13 3.25H7C3.58 3.25 2.25 4.58 2.25 8V16C2.25 18.3 3.5 20.75 7 20.75H13C16.28 20.75 17.63 19.53 17.74 16.42L19.21 17.46C19.83 17.9 20.37 18.04 20.8 18.04C21.17 18.04 21.46 17.93 21.65 17.83C22.06 17.62 22.75 17.05 22.75 15.62V8.38C22.75 6.95 22.06 6.38 21.65 6.17ZM11.5 11.38C10.47 11.38 9.62 10.54 9.62 9.5C9.62 8.46 10.47 7.62 11.5 7.62C12.53 7.62 13.38 8.46 13.38 9.5C13.38 10.54 12.53 11.38 11.5 11.38Z" /></svg>;
}

export function MultiplayerIcon() {
  return <svg className="native-control-icon" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M8.5 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM15.8 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM2.5 19.5c0-3.2 2.7-5.8 6-5.8s6 2.6 6 5.8v.5h-12v-.5ZM14.2 13.2c3.9-.8 7.3 2 7.3 5.8v1h-5v-.5c0-2.5-.9-4.7-2.3-6.3Z" />
  </svg>;
}

export function ForwardIcon() {
  return <svg className="native-control-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M2 8.34032V15.6603C2 17.1603 3.63 18.1003 4.93 17.3503L8.1 15.5203L11.27 13.6903L11.76 13.4103V10.5903L11.27 10.3103L8.1 8.48032L4.93 6.65032C3.63 5.90032 2 6.84032 2 8.34032Z" /><path d="M11.7598 8.34032V15.6603C11.7598 17.1603 13.3898 18.1003 14.6798 17.3503L17.8598 15.5203L21.0298 13.6903C22.3198 12.9403 22.3198 11.0603 21.0298 10.3103L17.8598 8.48032L14.6798 6.65032C13.3898 5.90032 11.7598 6.84032 11.7598 8.34032Z" /></svg>;
}

export function SettingsIcon() {
  return <svg className="native-navigation-icon" viewBox="0 0 25 24" aria-hidden="true"><path d="M20.6 9.22043C18.79 9.22043 18.05 7.94042 18.95 6.37042C19.47 5.46042 19.16 4.30042 18.25 3.78042L16.52 2.79042C15.73 2.32042 14.71 2.60042 14.24 3.39042L14.13 3.58042C13.23 5.15042 11.75 5.15042 10.84 3.58042L10.73 3.39042C10.28 2.60042 9.26 2.32042 8.47 2.79042L6.74 3.78042C5.83 4.30042 5.52 5.47042 6.04 6.38042C6.95 7.94042 6.21 9.22043 4.4 9.22043C3.36 9.22043 2.5 10.0704 2.5 11.1204V12.8804C2.5 13.9204 3.35 14.7804 4.4 14.7804C6.21 14.7804 6.95 16.0604 6.04 17.6304C5.52 18.5404 5.83 19.7004 6.74 20.2204L8.47 21.2104C9.26 21.6804 10.28 21.4004 10.75 20.6104L10.86 20.4204C11.76 18.8504 13.24 18.8504 14.15 20.4204L14.26 20.6104C14.73 21.4004 15.75 21.6804 16.54 21.2104L18.27 20.2204C19.18 19.7004 19.49 18.5304 18.97 17.6304C18.06 16.0604 18.8 14.7804 20.61 14.7804C21.65 14.7804 22.51 13.9304 22.51 12.8804V11.1204C22.5 10.0804 21.65 9.22043 20.6 9.22043ZM12.5 15.2504C10.71 15.2504 9.25 13.7904 9.25 12.0004C9.25 10.2104 10.71 8.75042 12.5 8.75042C14.29 8.75042 15.75 10.2104 15.75 12.0004C15.75 13.7904 14.29 15.2504 12.5 15.2504Z" /></svg>;
}

export function ProfileIcon() {
  return <svg className="native-navigation-icon" viewBox="0 0 25 24" aria-hidden="true"><path d="M12.5 2C9.88 2 7.75 4.13 7.75 6.75C7.75 9.32 9.76 11.4 12.38 11.49C12.46 11.48 12.54 11.48 12.6 11.49C12.62 11.49 12.63 11.49 12.65 11.49C12.66 11.49 12.66 11.49 12.67 11.49C15.23 11.4 17.24 9.32 17.25 6.75C17.25 4.13 15.12 2 12.5 2Z" /><path d="M17.58 14.1499C14.79 12.2899 10.24 12.2899 7.42996 14.1499C6.15996 14.9999 5.45996 16.1499 5.45996 17.3799C5.45996 18.6099 6.15996 19.7499 7.41996 20.5899C8.81996 21.5299 10.66 21.9999 12.5 21.9999C14.34 21.9999 16.18 21.5299 17.58 20.5899C18.84 19.7399 19.54 18.5999 19.54 17.3599C19.53 16.1299 18.84 14.9899 17.58 14.1499Z" /></svg>;
}

type GameDispatch = Dispatch<Parameters<typeof gameSessionReducer>[1]>;

export function ControlledGuessBoard({
  answerLength,
  currentLetters,
  activeSlotIndex,
  hintRevealedIndices,
  guesses,
  onSelectSlot,
  disabled = false,
}: {
  answerLength: number;
  currentLetters: string[];
  activeSlotIndex: number;
  hintRevealedIndices: number[];
  guesses: ScoredGuess[];
  onSelectSlot: (index: number) => void;
  disabled?: boolean;
}) {
  const rows = Array.from({length: 5}, (_, index) => guesses[index] ??
    (index === guesses.length ? {guess: currentLetters, feedback: []} : {guess: [], feedback: []}));
  return <div className="guess-board" style={{"--answer-length": answerLength,
    "--board-max-width": `${answerLength * 66 - 8}px`} as CSSProperties}>
    {rows.map((row, rowIndex) => <div className="guess-row" key={rowIndex}>
      {Array.from({length: answerLength}, (_, cellIndex) => <button type="button"
        disabled={disabled || rowIndex !== guesses.length || hintRevealedIndices.includes(cellIndex)}
        aria-label={`${tr("Accessibility.LETTER_PREFIX")}${cellIndex + 1}${row.guess[cellIndex] ? `: ${row.guess[cellIndex]}` : ""}`}
        aria-current={rowIndex === guesses.length && cellIndex === activeSlotIndex ? "true" : undefined}
        onClick={() => onSelectSlot(cellIndex)}
        className={["cell", row.feedback[cellIndex] ?? (rowIndex === guesses.length && hintRevealedIndices.includes(cellIndex) ? "green" : ""), rowIndex === guesses.length && cellIndex === activeSlotIndex ? "active" : ""].filter(Boolean).join(" ")}
        key={cellIndex}>{row.guess[cellIndex] ?? ""}</button>)}
    </div>)}
  </div>;
}

export function GuessBoard({state, dispatch}: {state: GameSessionState; dispatch: GameDispatch}) {
  if (!state.riddle) return null;
  return <ControlledGuessBoard
    answerLength={state.riddle.answerLength}
    currentLetters={state.currentLetters}
    activeSlotIndex={state.activeSlotIndex}
    hintRevealedIndices={state.hintRevealedIndices}
    guesses={state.guesses}
    onSelectSlot={(index) => dispatch({type: "selectSlot", index})}
  />;
}

export function ControlledKeyboard({
  letterStates,
  onLetter,
  onBackspace,
  disabled = false,
}: {
  letterStates: Record<string, Feedback>;
  onLetter: (letter: string) => void;
  onBackspace: () => void;
  disabled?: boolean;
}) {
  const keyClass = (letter: string) => letterStates[letter.toLowerCase()]
    ? `key ${letterStates[letter.toLowerCase()]}` : "key";
  return <section className="keyboard" aria-label={tr("Accessibility.SUBMIT_GUESS")}>
    {KEYBOARD_ROWS.map((row) => <div key={row}>
      {splitGraphemes(row).map((letter) => <button className={keyClass(letter)} key={letter}
        disabled={disabled} onClick={() => onLetter(letter)}>{letter}</button>)}
      {row === "ZXCVBNM" && <button className="key utility" disabled={disabled} onClick={onBackspace}
        aria-label={tr("Accessibility.BACKSPACE")}><img src={backspaceUrl} alt="" /></button>}
    </div>)}
  </section>;
}

export function Keyboard({state, dispatch, playFeedback}: {state: GameSessionState; dispatch: GameDispatch;
  playFeedback: (kind: "key" | "delete" | "submit" | "win" | "loss") => void}) {
  return <ControlledKeyboard
    letterStates={state.letterStates}
    onLetter={(letter) => { playFeedback("key"); dispatch({type: "typeLetter", letter}); }}
    onBackspace={() => { playFeedback("delete"); dispatch({type: "backspace"}); }}
  />;
}
