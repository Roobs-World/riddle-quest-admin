import {expect, it} from "@jest/globals";
import {renderToString} from "react-dom/server";
import {ControlledGuessBoard, ControlledKeyboard} from "../GameFrameControls";

it("describes scored letter meaning without relying on color", () => {
  /** Provides html behavior. */
  const html = renderToString(
    <ControlledGuessBoard
      answerLength={3}
      currentLetters={["", "", ""]}
      activeSlotIndex={0}
      hintRevealedIndices={[]}
      guesses={[{guess: ["c", "a", "t"], feedback: ["green", "yellow", "red"]}]}
      onSelectSlot={() => undefined}
    />,
  );

  expect(html).toContain("Letter 1: c. Letter is correct and in the right position");
  expect(html).toContain("Letter 2: a. Letter is in the word but wrong position");
  expect(html).toContain("Letter 3: t. Letter is not in the word at all");
});

it("names the on-screen letter controls as a virtual keyboard", () => {
  /** Provides html behavior. */
  const html = renderToString(
    <ControlledKeyboard letterStates={{}} onLetter={() => undefined} onBackspace={() => undefined} />,
  );

  expect(html).toContain('<section class="keyboard" aria-label="Virtual keyboard">');
  expect(html).not.toContain('aria-label="Submit current guess"');
});


it("renders distinct Turkish I shortcuts with independent feedback", () => {
  /** Canonical keyboard facts distinguish dotted i from dotless ı. */
  const html = renderToString(<ControlledKeyboard locale="tr" letterStates={{i: "yellow", "ı": "green"}}
    onLetter={() => undefined} onBackspace={() => undefined} />);
  expect(html).toMatch(/<button[^>]*class="key yellow"[^>]*>İ<\/button>/);
  expect(html).toMatch(/<button[^>]*class="key green"[^>]*>I<\/button>/);
});

it("keeps the existing single-I Latin shortcut outside Turkish content", () => {
  /** English content retains its existing symbol set and feedback identity. */
  const html = renderToString(<ControlledKeyboard locale="en" letterStates={{i: "green"}}
    onLetter={() => undefined} onBackspace={() => undefined} />);
  expect(html).toMatch(/<button[^>]*class="key green"[^>]*>I<\/button>/);
  expect(html).not.toContain(">İ</button>");
});
