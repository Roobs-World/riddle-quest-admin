import {expect, it} from "@jest/globals";
import {renderToString} from "react-dom/server";
import {ControlledGuessBoard, ControlledKeyboard} from "../GameFrameControls";

it("describes scored letter meaning without relying on color", () => {
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
  const html = renderToString(
    <ControlledKeyboard
      letterStates={{}}
      onLetter={() => undefined}
      onBackspace={() => undefined}
    />,
  );

  expect(html).toContain('<section class="keyboard" aria-label="Virtual keyboard">');
  expect(html).not.toContain('aria-label="Submit current guess"');
});
