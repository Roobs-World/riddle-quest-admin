import {beforeEach, describe, expect, it, jest} from "@jest/globals";

/** Describes effect. */
type Effect = () => void | (() => void);

/** Provides effects behavior. */
const effects: Effect[] = [];

jest.mock("react", () => ({
  useEffect: (effect: Effect) => effects.push(effect),
  useEffectEvent: <Callback extends (...args: never[]) => unknown>(callback: Callback) => callback,
}));

import {useRaceDialogFocus} from "../hooks/useRaceDialogFocus";
import {useRaceGameplayFit} from "../hooks/useRaceGameplayFit";

/** Provides test element behavior. */
class TestElement {
  /** Stores dataset. */
  public readonly dataset: Record<string, string | undefined> = {};
  /** Stores style. */
  public readonly style: Record<string, string> = {};
  /** Stores focus. */
  public focus = jest.fn(() => {
    testDocument.activeElement = this;
  });
  /** Stores focusable. */
  public focusable: TestElement[] = [];
  /** Stores offset height. */
  public offsetHeight = 0;
  /** Stores rect. */
  public rect = {bottom: 0, top: 0};

  /** Provides query selector all behavior. */
  public querySelectorAll(): TestElement[] {
    return this.focusable;
  }

  /** Gets bounding client rect. */
  public getBoundingClientRect() {
    return this.rect;
  }
}

/** Provides keydown handler behavior. */
let keydownHandler: ((event: KeyboardEvent) => void) | undefined;
/** Provides resize handler behavior. */
let resizeHandler: (() => void) | undefined;
/** Provides next frame behavior. */
let nextFrame = 1;
/** Provides frames behavior. */
const frames = new Map<number, FrameRequestCallback>();
/** Provides test document behavior. */
const testDocument = {
  activeElement: null as TestElement | null,
  addEventListener: jest.fn((_name: string, handler: (event: KeyboardEvent) => void) => {
    keydownHandler = handler;
  }),
  removeEventListener: jest.fn(),
};
/** Provides test window behavior. */
const testWindow = {
  requestAnimationFrame: jest.fn((callback: FrameRequestCallback) => {
    /** Provides frame behavior. */
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

/** Provides resize callback behavior. */
let resizeCallback: (() => void) | undefined;
/** Provides observe behavior. */
const observe = jest.fn();
/** Provides disconnect behavior. */
const disconnect = jest.fn();
/** Provides test resize observer behavior. */
class TestResizeObserver {
  /** Creates a test resize observer instance. */
  public constructor(callback: () => void) {
    resizeCallback = callback;
  }

  /** Stores observe. */
  public observe = observe;
  /** Stores disconnect. */
  public disconnect = disconnect;
}

/** Provides run latest frame behavior. */
const runLatestFrame = () => {
  /** Provides entry behavior. */
  const entry = [...frames.entries()].at(-1);
  expect(entry).toBeDefined();
  frames.delete(entry![0]);
  entry![1](0);
};

/** Provides keyboard event behavior. */
const keyboardEvent = (key: string, shiftKey = false) =>
  ({
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
  /** Provides install behavior. */
  const install = (quitConfirmationOpen = false) => {
    /** Provides previous behavior. */
    const previous = new TestElement();
    /** Provides dialog behavior. */
    const dialog = new TestElement();
    /** Provides quit dialog behavior. */
    const quitDialog = new TestElement();
    /** Provides dismiss quit confirmation behavior. */
    const dismissQuitConfirmation = jest.fn();
    /** Requests close. */
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
    /** Provides harness behavior. */
    const harness = install();
    /** Provides cleanup behavior. */
    const cleanup = effects[0]() as () => void;
    /** Provides escape behavior. */
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
    /** Provides harness behavior. */
    const harness = install(true);
    effects[0]();
    /** Provides cancel focus behavior. */
    const cancelFocus = effects[1]() as () => void;
    /** Provides escape behavior. */
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
    /** Provides harness behavior. */
    const harness = install();
    /** Provides first behavior. */
    const first = new TestElement();
    /** Provides middle behavior. */
    const middle = new TestElement();
    /** Provides last behavior. */
    const last = new TestElement();
    harness.dialog.focusable = [first, middle, last];
    effects[0]();

    testDocument.activeElement = first;
    /** Provides reverse tab behavior. */
    const reverseTab = keyboardEvent("Tab", true);
    keydownHandler?.(reverseTab);
    testDocument.activeElement = last;
    /** Provides forward tab behavior. */
    const forwardTab = keyboardEvent("Tab");
    keydownHandler?.(forwardTab);
    testDocument.activeElement = middle;
    /** Provides middle tab behavior. */
    const middleTab = keyboardEvent("Tab");
    keydownHandler?.(middleTab);

    expect(reverseTab.preventDefault).toHaveBeenCalledTimes(1);
    expect(last.focus).toHaveBeenCalledTimes(1);
    expect(forwardTab.preventDefault).toHaveBeenCalledTimes(1);
    expect(first.focus).toHaveBeenCalledTimes(1);
    expect(middleTab.preventDefault).not.toHaveBeenCalled();
  });

  it("ignores unrelated keys and dialogs without focusable controls", () => {
    /** Provides harness behavior. */
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
    /** Provides cleanup missing dialog behavior. */
    const cleanupMissingDialog = effects[0]() as () => void;
    keydownHandler?.(keyboardEvent("Tab"));
    cleanupMissingDialog();
    expect(effects[1]()).toBeUndefined();

    effects.length = 0;
    /** Provides mounted dialog behavior. */
    const mountedDialog = new TestElement();
    useRaceDialogFocus({
      dialogRef: {current: mountedDialog},
      quitDialogRef: {current: null},
      quitConfirmationOpen: true,
      dismissQuitConfirmation: jest.fn(),
      requestClose: jest.fn(),
    });
    effects[0]();
    /** Provides tab before confirmation mount behavior. */
    const tabBeforeConfirmationMount = keyboardEvent("Tab");
    keydownHandler?.(tabBeforeConfirmationMount);
    expect(tabBeforeConfirmationMount.preventDefault).not.toHaveBeenCalled();
  });
});

describe("useRaceGameplayFit", () => {
  /** Provides install behavior. */
  const install = ({
    active = true,
    naturalHeight = 760,
  }: {
    /** Stores active. */
    active?: boolean; /** Stores natural height. */
    /** Stores natural height. */
    naturalHeight?: number;
  } = {}) => {
    /** Provides screen behavior. */
    const screen = new TestElement();
    /** Provides viewport behavior. */
    const viewport = new TestElement();
    /** Provides gameplay behavior. */
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
    /** Provides harness behavior. */
    const harness = install();
    /** Provides cleanup behavior. */
    const cleanup = effects[0]() as () => void;
    runLatestFrame();

    expect(harness.gameplay.style.transform).toBe("scale(0.5)");
    expect(harness.gameplay.style.minHeight).toBe("380px");
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
    expect(harness.gameplay.style.minHeight).toBe("");
    expect(harness.viewport.style.height).toBe("");
    expect(harness.viewport.dataset.viewportScale).toBeUndefined();
  });

  it("keeps naturally fitting gameplay at full scale", () => {
    /** Provides harness behavior. */
    const harness = install({naturalHeight: 200});
    effects[0]();
    runLatestFrame();

    expect(harness.gameplay.style.transform).toBe("scale(1)");
    expect(harness.gameplay.style.minHeight).toBe("380px");
    expect(harness.viewport.style.height).toBe("380px");
    expect(harness.viewport.dataset.viewportScale).toBe("1.0000");
  });

  it("does nothing while inactive or while required elements are unavailable", () => {
    install({active: false});
    expect(effects[0]()).toBeUndefined();

    for (const missing of ["screen", "viewport", "gameplay"] as const) {
      effects.length = 0;
      /** Provides refs behavior. */
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
    /** Provides harness behavior. */
    const harness = install({naturalHeight: 100});
    harness.screen.rect.bottom = 0;
    effects[0]();
    runLatestFrame();

    expect(harness.gameplay.style.transform).toBe("scale(0.01)");
    expect(harness.viewport.style.height).toBe("1px");
  });
});
