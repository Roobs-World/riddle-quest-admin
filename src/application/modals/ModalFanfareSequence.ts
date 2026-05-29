import type {ModalSequenceProgress} from "../../types/ModalTypes";

/**
 * Function used by modal sequences to wait between one modal close and the
 * next modal opening.
 */
export type ModalSequenceDelay = (milliseconds: number) => Promise<void>;

/**
 * Continuation callback injected into each popup in a sequence.
 */
export type ModalSequenceContinue = () => void | Promise<void>;

/**
 * One popup step in a fanfare sequence.
 *
 * @remarks
 * Pattern: Chain of Responsibility. Each step receives a common progress
 * object and a continuation callback. The runner decides whether the callback
 * advances to the next step or completes the chain.
 *
 * Boundary: application modal layer. Steps may dispatch modal commands or call
 * typed modal helpers, but they should not know about screen-local state.
 */
export interface ModalSequenceStep {
  /** Stable name used by tests and handoff notes. */
  readonly name: string;
  /** Opens the popup represented by this step. */
  open: (sequenceProgress: ModalSequenceProgress, onContinue: ModalSequenceContinue) => void;
}

/**
 * Runtime options for {@link ModalFanfareSequence}.
 */
export interface ModalFanfareSequenceOptions {
  /** Delay used after a popup closes before opening the next popup. */
  closeDelayMs: number;
  /** Delay implementation, injected so tests and React Native code share logic. */
  delay: ModalSequenceDelay;
  /** Text displayed when the active popup advances to another popup. */
  nextActionText?: string;
  /** Called once the final popup has continued. */
  onComplete: () => void | Promise<void>;
}

/**
 * Runs completion fanfare popups in order.
 *
 * @remarks
 * Pattern: Chain of Responsibility. `GameScreen` builds a list of popup
 * responsibilities from the latest result, while this runner owns sequencing,
 * progress metadata, delay timing, and final completion.
 *
 * Boundary: application layer. The runner depends only on injected steps and a
 * delay function; it does not import screen components, hooks, or modal
 * registries.
 *
 * Invariants:
 * - Steps are opened in array order.
 * - Every step receives one-based progress for display.
 * - The final step calls `onComplete` exactly once per continuation.
 */
export class ModalFanfareSequence {
  /** Ordered popup steps that make up the fanfare chain. */
  private readonly steps: readonly ModalSequenceStep[];
  /** Timing and completion callbacks used while advancing the chain. */
  private readonly options: ModalFanfareSequenceOptions;

  constructor(steps: readonly ModalSequenceStep[], options: ModalFanfareSequenceOptions) {
    this.steps = steps;
    this.options = options;
  }

  /**
   * Opens the first popup in the chain, or completes immediately for an empty
   * chain.
   */
  start(): void {
    if (this.steps.length === 0) {
      void Promise.resolve(this.options.onComplete());
      return;
    }

    this.openAt(0);
  }

  /**
   * Opens the popup at the given sequence index.
   *
   * @param index - Zero-based position inside the fanfare chain.
   */
  private openAt(index: number): void {
    const step = this.steps[index];
    if (!step) {
      return;
    }

    const hasNextPopup = index < this.steps.length - 1;
    step.open(
      {
        currentPopupIndex: index + 1,
        totalPopups: this.steps.length,
        hasNextPopup,
        primaryActionText: hasNextPopup ? this.options.nextActionText : undefined,
      },
      () => this.continueFrom(index),
    );
  }

  /**
   * Advances the sequence after the current popup continues.
   *
   * @param index - Zero-based position of the popup that just continued.
   */
  private continueFrom(index: number): void {
    if (index < this.steps.length - 1) {
      void this.options.delay(this.options.closeDelayMs).then(() => this.openAt(index + 1));
      return;
    }

    void Promise.resolve(this.options.onComplete());
  }
}

/**
 * Convenience factory for one-shot modal fanfare sequences.
 */
export function runModalFanfareSequence(
  steps: readonly ModalSequenceStep[],
  options: ModalFanfareSequenceOptions,
): void {
  new ModalFanfareSequence(steps, options).start();
}
