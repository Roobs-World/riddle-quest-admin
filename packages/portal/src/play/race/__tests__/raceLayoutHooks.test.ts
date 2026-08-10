import {beforeEach, describe, expect, it, jest} from "@jest/globals";

type Effect = () => void | (() => void);

const effects: Effect[] = [];

jest.mock("react", () => ({
  useEffect: (effect: Effect) => effects.push(effect),
}));

import {useRaceDialogFocus} from "../hooks/useRaceDialogFocus";
import {useRaceGameplayFit} from "../hooks/useRaceGameplayFit";

class TestElement {
  public readonly dataset: Record<string, string | undefined> = {};
  public readonly style: Record<string, string> = {};
  public focus = jest.fn(() => {
    testDocument.activeElement = this;
  });
  public focusable: TestElement[] = [];
  public offsetHeight = 0;
  public rect = {bottom: 0, top: 0};

  public querySelectorAll(): TestElement[] {
    return this.focusable;
  }

  public getBoundingClientRect() {
    return this.rect;
  }
}

let keydownHandler: ((event: KeyboardEvent) => void) | undefined;
let resizeHandler: (() => void) | undefined;
let nextFrame = 1;
const frames = new Map<number, FrameRequestCallback>();
const testDocument = {
  activeElement: null as TestElement | null,
  addEventListener: jest.fn((_name: string, handler: (event: KeyboardEvent) => void) => {
    keydownHandler = handler;
  }),
  removeEventListener: jest.fn(),
};
const testWindow = {
  requestAnimationFrame: jest.fn((callback: FrameRequestCallback) => {
    const frame = nextFrame;
    nextFrame += 1;
    frames.set(frame, callback);
    return frame;
  }),
  cancelAnimationFrame: jest.fn((frame: number) => frames.delete(frame)),
  addEventListener: jest.fn((_name: string, handler: () => void) => {
    resizeHandler = handler;
  }),
  removeEventListener: jest.fn(),
};

let resizeCallback: (() => void) | undefined;
const observe = jest.fn();
const disconnect = jest.fn();
class TestResizeObserver {
  public constructor(callback: () => void) {
    resizeCallback = callback;
  }

  public observe = observe;
  public disconnect = disconnect;
}

const runLatestFrame = () => {
  const entry = [...frames.entries()].at(-1);
  expect(entry).toBeDefined();
  frames.delete(entry![0]);
  entry![1](0);
};

const keyboardEvent = (key: string, shiftKey = false) => ({
  key,
  shiftKey,
  preventDefault: jest.fn(),
}) as unknown as KeyboardEvent;

beforeEach(() => {
  effects.length = 0;
  frames.clear();
  nextFrame = 1;
  keydownHandler = undefined;
  resizeHandler = undefined;
  resizeCallback = undefined;
  testDocument.activeElement = null;
  jest.clearAllMocks();
  Object.defineProperty(globalThis, "HTMLElement", {configurable: true, value: TestElement});
  Object.defineProperty(globalThis, "document", {configurable: true, value: testDocument});
  Object.defineProperty(globalThis, "window", {configurable: true, value: testWindow});
  Object.defineProperty(globalThis, "ResizeObserver", {configurable: true, value: TestResizeObserver});
  Object.defineProperty(globalThis, "getComputedStyle", {
    configurable: true,
    value: () => ({paddingBottom: "20px"}),
  });
});

describe("useRaceDialogFocus", () => {
  const install = (quitConfirmationOpen = false) => {
    const previous = new TestElement();
    const dialog = new TestElement();
    const quitDialog = new TestElement();
    const dismissQuitConfirmation = jest.fn();
    const requestClose = jest.fn();
    testDocument.activeElement = previous;
    useRaceDialogFocus({
      dialogRef: {current: dialog},
      quitDialogRef: {current: quitDialog},
      quitConfirmationOpen,
      dismissQuitConfirmation,
      requestClose,
    });
    return {previous, dialog, quitDialog, dismissQuitConfirmation, requestClose};
  };

  it("focuses the race dialog, handles Escape, and restores previous focus", () => {
    const harness = install();
    const cleanup = effects[0]() as () => void;
    const escape = keyboardEvent("Escape");

    keydownHandler?.(escape);
    cleanup();

    expect(harness.dialog.focus).toHaveBeenCalledTimes(1);
    expect(escape.preventDefault).toHaveBeenCalledTimes(1);
    expect(harness.requestClose).toHaveBeenCalledTimes(1);
    expect(harness.dismissQuitConfirmation).not.toHaveBeenCalled();
    expect(testDocument.removeEventListener).toHaveBeenCalledWith("keydown", keydownHandler);
    expect(harness.previous.focus).toHaveBeenCalledTimes(1);
  });

  it("dismisses an open confirmation and focuses it on the next frame", () => {
    const harness = install(true);
    effects[0]();
    const cancelFocus = effects[1]() as () => void;
    const escape = keyboardEvent("Escape");

    keydownHandler?.(escape);
    runLatestFrame();
    cancelFocus();

    expect(harness.dismissQuitConfirmation).toHaveBeenCalledTimes(1);
    expect(harness.requestClose).not.toHaveBeenCalled();
    expect(harness.quitDialog.focus).toHaveBeenCalledTimes(1);
    expect(testWindow.cancelAnimationFrame).toHaveBeenCalled();
  });

  it("wraps Tab focus in both directions within the active dialog", () => {
    const harness = install();
    const first = new TestElement();
    const middle = new TestElement();
    const last = new TestElement();
    harness.dialog.focusable = [first, middle, last];
    effects[0]();

    testDocument.activeElement = first;
    const reverseTab = keyboardEvent("Tab", true);
    keydownHandler?.(reverseTab);
    testDocument.activeElement = last;
    const forwardTab = keyboardEvent("Tab");
    keydownHandler?.(forwardTab);
    testDocument.activeElement = middle;
    const middleTab = keyboardEvent("Tab");
    keydownHandler?.(middleTab);

    expect(reverseTab.preventDefault).toHaveBeenCalledTimes(1);
    expect(last.focus).toHaveBeenCalledTimes(1);
    expect(forwardTab.preventDefault).toHaveBeenCalledTimes(1);
    expect(first.focus).toHaveBeenCalledTimes(1);
    expect(middleTab.preventDefault).not.toHaveBeenCalled();
  });

  it("ignores unrelated keys and dialogs without focusable controls", () => {
    const harness = install();
    effects[0]();

    keydownHandler?.(keyboardEvent("Enter"));
    keydownHandler?.(keyboardEvent("Tab"));
    harness.dialog.focusable = [];
    keydownHandler?.(keyboardEvent("Tab"));
    expect(harness.requestClose).not.toHaveBeenCalled();

    effects.length = 0;
    testDocument.activeElement = null;
    useRaceDialogFocus({
      dialogRef: {current: null},
      quitDialogRef: {current: null},
      quitConfirmationOpen: false,
      dismissQuitConfirmation: jest.fn(),
      requestClose: jest.fn(),
    });
    const cleanupMissingDialog = effects[0]() as () => void;
    keydownHandler?.(keyboardEvent("Tab"));
    cleanupMissingDialog();
    expect(effects[1]()).toBeUndefined();

    effects.length = 0;
    const mountedDialog = new TestElement();
    useRaceDialogFocus({
      dialogRef: {current: mountedDialog},
      quitDialogRef: {current: null},
      quitConfirmationOpen: true,
      dismissQuitConfirmation: jest.fn(),
      requestClose: jest.fn(),
    });
    effects[0]();
    const tabBeforeConfirmationMount = keyboardEvent("Tab");
    keydownHandler?.(tabBeforeConfirmationMount);
    expect(tabBeforeConfirmationMount.preventDefault).not.toHaveBeenCalled();
  });
});

describe("useRaceGameplayFit", () => {
  const install = ({active = true, naturalHeight = 760}: {active?: boolean; naturalHeight?: number} = {}) => {
    const screen = new TestElement();
    const viewport = new TestElement();
    const gameplay = new TestElement();
    screen.rect = {bottom: 500, top: 0};
    viewport.rect = {bottom: 0, top: 100};
    gameplay.offsetHeight = naturalHeight;
    useRaceGameplayFit({
      active,
      screenRef: {current: screen},
      viewportRef: {current: viewport},
      gameplayRef: {current: gameplay},
    });
    return {screen, viewport, gameplay};
  };

  it("scales gameplay to the available height and clears all mutations on cleanup", () => {
    const harness = install();
    const cleanup = effects[0]() as () => void;
    runLatestFrame();

    expect(harness.gameplay.style.transform).toBe("scale(0.5)");
    expect(harness.viewport.style.height).toBe("380px");
    expect(harness.viewport.dataset.viewportScale).toBe("0.5000");
    expect(observe).toHaveBeenCalledWith(harness.screen);
    expect(observe).toHaveBeenCalledWith(harness.gameplay);

    resizeCallback?.();
    runLatestFrame();
    resizeHandler?.();
    runLatestFrame();
    cleanup();

    expect(disconnect).toHaveBeenCalledTimes(1);
    expect(testWindow.removeEventListener).toHaveBeenCalledWith("resize", resizeHandler);
    expect(harness.gameplay.style.transform).toBe("");
    expect(harness.viewport.style.height).toBe("");
    expect(harness.viewport.dataset.viewportScale).toBeUndefined();
  });

  it("keeps naturally fitting gameplay at full scale", () => {
    const harness = install({naturalHeight: 200});
    effects[0]();
    runLatestFrame();

    expect(harness.gameplay.style.transform).toBe("scale(1)");
    expect(harness.viewport.style.height).toBe("200px");
    expect(harness.viewport.dataset.viewportScale).toBe("1.0000");
  });

  it("does nothing while inactive or while required elements are unavailable", () => {
    install({active: false});
    expect(effects[0]()).toBeUndefined();

    for (const missing of ["screen", "viewport", "gameplay"] as const) {
      effects.length = 0;
      const refs = {
        screen: {current: new TestElement() as TestElement | null},
        viewport: {current: new TestElement() as TestElement | null},
        gameplay: {current: new TestElement() as TestElement | null},
      };
      refs[missing].current = null;
      useRaceGameplayFit({
        active: true,
        screenRef: refs.screen,
        viewportRef: refs.viewport,
        gameplayRef: refs.gameplay,
      });
      expect(effects[0]()).toBeUndefined();
    }
    expect(testWindow.addEventListener).not.toHaveBeenCalled();
  });

  it("uses a one-pixel floor when computed space is invalid", () => {
    Object.defineProperty(globalThis, "getComputedStyle", {
      configurable: true,
      value: () => ({paddingBottom: "invalid"}),
    });
    const harness = install({naturalHeight: 100});
    harness.screen.rect.bottom = 0;
    effects[0]();
    runLatestFrame();

    expect(harness.gameplay.style.transform).toBe("scale(0.01)");
    expect(harness.viewport.style.height).toBe("1px");
  });
});
