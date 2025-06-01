/**
 * Base interface for all game events
 */
export interface GameEvent {
  type: string;
  timestamp: number;
}

/**
 * Letter added to current guess
 */
export interface LetterAddedEvent extends GameEvent {
  type: "LETTER_ADDED";
  letter: string;
  position: number;
}

/**
 * Letter removed from current guess
 */
export interface LetterRemovedEvent extends GameEvent {
  type: "LETTER_REMOVED";
  position: number;
}

/**
 * Guess submitted
 */
export interface GuessSubmittedEvent extends GameEvent {
  type: "GUESS_SUBMITTED";
  guess: string;
  attemptNumber: number;
}

/**
 * Guess validated with feedback
 */
export interface GuessValidatedEvent extends GameEvent {
  type: "GUESS_VALIDATED";
  guess: string;
  feedback: { letter: string; status: "green" | "yellow" | "red" }[];
  isCorrect: boolean;
}

/**
 * Game completed
 */
export interface GameCompletedEvent extends GameEvent {
  type: "GAME_COMPLETED";
  outcome: "won" | "lost";
  attempts: number;
  coinsEarned?: number;
}

/**
 * Hint requested
 */
export interface HintRequestedEvent extends GameEvent {
  type: "HINT_REQUESTED";
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
 * Event listener type
 */
export type GameEventListener<T extends GameEvent = AnyGameEvent> = (
  event: T
) => void;

/**
 * Event bus for game events following the Open/Closed Principle
 * Open for extension (new event types can be added)
 * Closed for modification (existing functionality doesn't change)
 */
export class GameEventBus {
  private static instance: GameEventBus;
  private listeners = new Map<string, Set<GameEventListener>>();
  private globalListeners = new Set<GameEventListener<AnyGameEvent>>();

  private constructor() {}

  /**
   * Get singleton instance
   */
  static getInstance(): GameEventBus {
    if (!GameEventBus.instance) {
      GameEventBus.instance = new GameEventBus();
    }
    return GameEventBus.instance;
  }

  /**
   * Subscribe to a specific event type
   */
  on<T extends AnyGameEvent>(
    eventType: T["type"],
    listener: GameEventListener<T>
  ): () => void {
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

// Export singleton instance
export const gameEventBus = GameEventBus.getInstance();
