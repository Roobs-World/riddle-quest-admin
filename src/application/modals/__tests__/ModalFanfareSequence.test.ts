import {ModalFanfareSequence, type ModalSequenceStep, runModalFanfareSequence} from "../ModalFanfareSequence";

describe("ModalFanfareSequence", () => {
  const flushPromises = async () => {
    await Promise.resolve();
    await Promise.resolve();
  };

  it("opens steps in order with sequence progress", async () => {
    const delay = jest.fn(() => Promise.resolve());
    const onComplete = jest.fn();
    const opened: Array<{name: string; continueStep: () => void | Promise<void>; selectPopup?: (popupIndex: number) => void}> = [];
    const steps: ModalSequenceStep[] = ["achievement", "victory", "level-up"].map((name) => ({
      name,
      open: jest.fn((sequenceProgress, onContinue) => {
        opened.push({name, continueStep: onContinue, selectPopup: sequenceProgress.onSelectPopup});
        expect(sequenceProgress).toMatchObject({
          currentPopupIndex: opened.length,
          totalPopups: 3,
          hasNextPopup: opened.length < 3,
          primaryActionText: opened.length < 3 ? "Next" : undefined,
        });
        expect(sequenceProgress.onSelectPopup).toEqual(expect.any(Function));
      }),
    }));

    new ModalFanfareSequence(steps, {
      closeDelayMs: 250,
      delay,
      nextActionText: "Next",
      onComplete,
    }).start();

    expect(opened.map((item) => item.name)).toEqual(["achievement"]);

    await opened[0].continueStep();
    await flushPromises();
    expect(delay).toHaveBeenCalledWith(250);
    expect(opened.map((item) => item.name)).toEqual(["achievement", "victory"]);

    await opened[1].continueStep();
    await flushPromises();
    expect(opened.map((item) => item.name)).toEqual(["achievement", "victory", "level-up"]);

    await opened[2].continueStep();
    await flushPromises();
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("jumps back to a previous popup when a sequence step selects an earlier popup", async () => {
    const delay = jest.fn(() => Promise.resolve());
    const onComplete = jest.fn();
    const opened: Array<{name: string; continueStep: () => void | Promise<void>; selectPopup?: (popupIndex: number) => void}> = [];
    const steps: ModalSequenceStep[] = ["achievement", "victory", "level-up"].map((name) => ({
      name,
      open: jest.fn((sequenceProgress, onContinue) => {
        opened.push({name, continueStep: onContinue, selectPopup: sequenceProgress.onSelectPopup});
      }),
    }));

    new ModalFanfareSequence(steps, {
      closeDelayMs: 250,
      delay,
      nextActionText: "Next",
      onComplete,
    }).start();

    await opened[0].continueStep();
    await flushPromises();
    expect(opened.map((item) => item.name)).toEqual(["achievement", "victory"]);

    opened[1].selectPopup?.(1);
    await flushPromises();
    expect(delay).toHaveBeenCalledWith(250);
    expect(opened.map((item) => item.name)).toEqual(["achievement", "victory", "achievement"]);
    expect(onComplete).not.toHaveBeenCalled();
  });

  it("completes immediately when the sequence has no steps", async () => {
    const onComplete = jest.fn();

    runModalFanfareSequence([], {
      closeDelayMs: 100,
      delay: jest.fn(() => Promise.resolve()),
      onComplete,
    });

    await flushPromises();
    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});
