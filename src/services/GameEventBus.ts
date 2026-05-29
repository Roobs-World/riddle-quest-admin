/**
 * Base interface for all game events
 */
export interface GameEvent {
  /** Discriminant identifying the concrete event shape. */
  type: string;
  /** Millisecond Unix timestamp when the event was emitted. */
  timestamp: number;
}

/**
 * Letter added to current guess
 */
export interface LetterAddedEvent extends GameEvent {
  /** Event discriminator. */
  type: "LETTER_ADDED";
  /** Lowercase letter inserted into the guess. */
  letter: string;
  /** Zero-based slot index where the letter was inserted. */
  position: number;
}

/**
 * Letter removed from current guess
 */
export interface LetterRemovedEvent extends GameEvent {
  /** Event discriminator. */
  type: "LETTER_REMOVED";
  /** Zero-based slot index cleared by backspace/delete. */
  position: number;
}

/**
 * Guess submitted
 */
export interface GuessSubmittedEvent extends GameEvent {
  /** Event discriminator. */
  type: "GUESS_SUBMITTED";
  /** Submitted guess string at time of send. */
  guess: string;
  /** One-based attempt count for this submission. */
  attemptNumber: number;
}

/**
 * Guess validated with feedback
 */
export interface GuessValidatedEvent extends GameEvent {
  /** Event discriminator. */
  type: "GUESS_VALIDATED";
  /** Submitted guess string that was validated. */
  guess: string;
  /** Per-letter validation status aligned to guess indices. */
  feedback: {letter: string; status: "green" | "yellow" | "red"}[];
  /** True when the guess solved the riddle. */
  isCorrect: boolean;
}

/**
 * Game completed
 */
export interface GameCompletedEvent extends GameEvent {
  /** Event discriminator. */
  type: "GAME_COMPLETED";
  /** Final game outcome for the riddle. */
  outcome: "won" | "lost";
  /** Total attempts used in this game session. */
  attempts: number;
  /** Optional coin payout awarded on win. */
  coinsEarned?: number;
}

/**
 * Hint requested
 */
export interface HintRequestedEvent extends GameEvent {
  /** Event discriminator. */
  type: "HINT_REQUESTED";
  /** Hint subtype requested by the player. */
  hintType: "letter" | "position";
}

/**
 * Union type of all game events
 */
export type AnyGameEvent =
  | LetterAddedEvent
  | LetterRemovedEvent
  | GuessSubmittedEvent
  | GuessValidatedEvent
  | GameCompletedEvent
  | HintRequestedEvent;

/**
 * Event listener callback for a specific game-event shape.
 *
 * @param event - Concrete event payload emitted from the bus.
 */
export type GameEventListener<T extends GameEvent = AnyGameEvent> = (event: T) => void;

/**
 * Event bus for game events following the Open/Closed Principle
 * Open for extension (new event types can be added)
 * Closed for modification (existing functionality doesn't change)
 */
export class GameEventBus {
  /** Singleton instance backing `getInstance()`. */
  private static instance: GameEventBus;
  /** Event-type scoped listeners. */
  private listeners = new Map<string, Set<GameEventListener>>();
  /** Global listeners invoked for every emitted event. */
  private globalListeners = new Set<GameEventListener<AnyGameEvent>>();

  /** Creates the singleton event bus. Use {@link getInstance} instead. */
  private constructor() {}

  /**
   * Gets the singleton event bus instance.
   *
   * @returns The shared game-event bus.
   */
  static getInstance(): GameEventBus {
    if (!GameEventBus.instance) {
      GameEventBus.instance = new GameEventBus();
    }
    return GameEventBus.instance;
  }

  /**
   * Subscribe to a specific event type
   *
   * @param eventType Concrete event discriminator to listen for.
   * @param listener Handler invoked whenever that event type is emitted.
   * @returns Unsubscribe function.
   */
  on<T extends AnyGameEvent>(eventType: T["type"], listener: GameEventListener<T>): () => void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }

    const listeners = this.listeners.get(eventType)!;
    listeners.add(listener as GameEventListener);

    // Return unsubscribe function
    return () => {
      listeners.delete(listener as GameEventListener);
    };
  }

  /**
   * Subscribe to all events
   *
   * @param listener Handler invoked for every emitted game event.
   * @returns Unsubscribe function.
   */
  onAll(listener: GameEventListener<AnyGameEvent>): () => void {
    this.globalListeners.add(listener);

    // Return unsubscribe function
    return () => {
      this.globalListeners.delete(listener);
    };
  }

  /**
   * Emit an event
   *
   * @param event Event payload excluding timestamp (added internally).
   */
  emit<T extends AnyGameEvent>(event: Omit<T, "timestamp">): void {
    const fullEvent = {
      ...event,
      timestamp: Date.now(),
    } as T;

    // Notify specific listeners
    const listeners = this.listeners.get(fullEvent.type);
    if (listeners) {
      listeners.forEach((listener) => listener(fullEvent));
    }

    // Notify global listeners
    this.globalListeners.forEach((listener) => listener(fullEvent));
  }

  /**
   * Clear all listeners for a specific event type
   *
   * @param eventType Optional event type. When omitted, clears every listener.
   */
  clearListeners(eventType?: string): void {
    if (eventType) {
      this.listeners.delete(eventType);
    } else {
      this.listeners.clear();
      this.globalListeners.clear();
    }
  }

  /**
   * Get the number of listeners for an event type
   *
   * @param eventType Optional event type. When omitted, returns total listener count.
   * @returns Number of active listeners.
   */
  getListenerCount(eventType?: string): number {
    if (eventType) {
      const listeners = this.listeners.get(eventType);
      return listeners ? listeners.size : 0;
    }

    let count = this.globalListeners.size;
    this.listeners.forEach((listeners) => {
      count += listeners.size;
    });
    return count;
  }
}

/** Shared singleton event-bus instance used throughout the app. */
export const gameEventBus = GameEventBus.getInstance();
