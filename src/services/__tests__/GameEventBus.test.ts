import {
  GameEventBus,
  gameEventBus,
  GameEvent,
  LetterAddedEvent,
  LetterRemovedEvent,
  GuessSubmittedEvent,
  GuessValidatedEvent,
  GameCompletedEvent,
  HintRequestedEvent,
  AnyGameEvent,
  GameEventListener,
} from "../GameEventBus";

describe("GameEventBus", () => {
  let eventBus: GameEventBus;
  let mockListener: jest.Mock;
  let mockGlobalListener: jest.Mock;

  beforeEach(() => {
    eventBus = GameEventBus.getInstance();
    eventBus.clearListeners(); // Clear all listeners before each test
    mockListener = jest.fn();
    mockGlobalListener = jest.fn();
  });

  afterEach(() => {
    eventBus.clearListeners(); // Clean up after each test
    jest.clearAllMocks();
  });

  describe("Singleton Pattern", () => {
    it("should return the same instance when getInstance is called multiple times", () => {
      const instance1 = GameEventBus.getInstance();
      const instance2 = GameEventBus.getInstance();

      expect(instance1).toBe(instance2);
      expect(instance1).toBe(eventBus);
    });

    it("should export a singleton instance as gameEventBus", () => {
      expect(gameEventBus).toBe(GameEventBus.getInstance());
    });
  });

  describe("Event Subscription", () => {
    it("should subscribe to specific event types", () => {
      const unsubscribe = eventBus.on("LETTER_ADDED", mockListener);

      expect(eventBus.getListenerCount("LETTER_ADDED")).toBe(1);
      expect(typeof unsubscribe).toBe("function");
    });

    it("should subscribe to all events", () => {
      const unsubscribe = eventBus.onAll(mockGlobalListener);

      expect(eventBus.getListenerCount()).toBe(1);
      expect(typeof unsubscribe).toBe("function");
    });

    it("should allow multiple listeners for the same event type", () => {
      const mockListener2 = jest.fn();

      eventBus.on("LETTER_ADDED", mockListener);
      eventBus.on("LETTER_ADDED", mockListener2);

      expect(eventBus.getListenerCount("LETTER_ADDED")).toBe(2);
    });

    it("should allow multiple global listeners", () => {
      const mockGlobalListener2 = jest.fn();

      eventBus.onAll(mockGlobalListener);
      eventBus.onAll(mockGlobalListener2);

      expect(eventBus.getListenerCount()).toBe(2);
    });
  });

  describe("Event Emission", () => {
    beforeEach(() => {
      eventBus.on("LETTER_ADDED", mockListener);
      eventBus.onAll(mockGlobalListener);
    });

    it("should emit LETTER_ADDED events correctly", () => {
      const event: Omit<LetterAddedEvent, "timestamp"> = {
        type: "LETTER_ADDED",
        letter: "A",
        position: 0,
      };

      eventBus.emit(event);

      expect(mockListener).toHaveBeenCalledTimes(1);
      expect(mockGlobalListener).toHaveBeenCalledTimes(1);

      const emittedEvent = mockListener.mock.calls[0][0];
      expect(emittedEvent.type).toBe("LETTER_ADDED");
      expect(emittedEvent.letter).toBe("A");
      expect(emittedEvent.position).toBe(0);
      expect(emittedEvent.timestamp).toBeGreaterThan(0);
    });

    it("should emit LETTER_REMOVED events correctly", () => {
      const mockLetterRemovedListener = jest.fn();
      eventBus.on("LETTER_REMOVED", mockLetterRemovedListener);

      const event: Omit<LetterRemovedEvent, "timestamp"> = {
        type: "LETTER_REMOVED",
        position: 2,
      };

      eventBus.emit(event);

      expect(mockLetterRemovedListener).toHaveBeenCalledTimes(1);
      expect(mockGlobalListener).toHaveBeenCalledTimes(1);

      const emittedEvent = mockLetterRemovedListener.mock.calls[0][0];
      expect(emittedEvent.type).toBe("LETTER_REMOVED");
      expect(emittedEvent.position).toBe(2);
      expect(emittedEvent.timestamp).toBeGreaterThan(0);
    });

    it("should emit GUESS_SUBMITTED events correctly", () => {
      const mockGuessSubmittedListener = jest.fn();
      eventBus.on("GUESS_SUBMITTED", mockGuessSubmittedListener);

      const event: Omit<GuessSubmittedEvent, "timestamp"> = {
        type: "GUESS_SUBMITTED",
        guess: "HELLO",
        attemptNumber: 1,
      };

      eventBus.emit(event);

      expect(mockGuessSubmittedListener).toHaveBeenCalledTimes(1);
      expect(mockGlobalListener).toHaveBeenCalledTimes(1);

      const emittedEvent = mockGuessSubmittedListener.mock.calls[0][0];
      expect(emittedEvent.type).toBe("GUESS_SUBMITTED");
      expect(emittedEvent.guess).toBe("HELLO");
      expect(emittedEvent.attemptNumber).toBe(1);
    });

    it("should emit GUESS_VALIDATED events correctly", () => {
      const mockGuessValidatedListener = jest.fn();
      eventBus.on("GUESS_VALIDATED", mockGuessValidatedListener);

      const event: Omit<GuessValidatedEvent, "timestamp"> = {
        type: "GUESS_VALIDATED",
        guess: "HELLO",
        feedback: [
          { letter: "H", status: "green" },
          { letter: "E", status: "yellow" },
          { letter: "L", status: "red" },
          { letter: "L", status: "red" },
          { letter: "O", status: "green" },
        ],
        isCorrect: false,
      };

      eventBus.emit(event);

      expect(mockGuessValidatedListener).toHaveBeenCalledTimes(1);

      const emittedEvent = mockGuessValidatedListener.mock.calls[0][0];
      expect(emittedEvent.type).toBe("GUESS_VALIDATED");
      expect(emittedEvent.guess).toBe("HELLO");
      expect(emittedEvent.feedback).toHaveLength(5);
      expect(emittedEvent.isCorrect).toBe(false);
    });

    it("should emit GAME_COMPLETED events correctly", () => {
      const mockGameCompletedListener = jest.fn();
      eventBus.on("GAME_COMPLETED", mockGameCompletedListener);

      const event: Omit<GameCompletedEvent, "timestamp"> = {
        type: "GAME_COMPLETED",
        outcome: "won",
        attempts: 3,
        coinsEarned: 50,
      };

      eventBus.emit(event);

      expect(mockGameCompletedListener).toHaveBeenCalledTimes(1);

      const emittedEvent = mockGameCompletedListener.mock.calls[0][0];
      expect(emittedEvent.type).toBe("GAME_COMPLETED");
      expect(emittedEvent.outcome).toBe("won");
      expect(emittedEvent.attempts).toBe(3);
      expect(emittedEvent.coinsEarned).toBe(50);
    });

    it("should emit HINT_REQUESTED events correctly", () => {
      const mockHintRequestedListener = jest.fn();
      eventBus.on("HINT_REQUESTED", mockHintRequestedListener);

      const event: Omit<HintRequestedEvent, "timestamp"> = {
        type: "HINT_REQUESTED",
        hintType: "letter",
      };

      eventBus.emit(event);

      expect(mockHintRequestedListener).toHaveBeenCalledTimes(1);

      const emittedEvent = mockHintRequestedListener.mock.calls[0][0];
      expect(emittedEvent.type).toBe("HINT_REQUESTED");
      expect(emittedEvent.hintType).toBe("letter");
    });

    it("should add timestamp to emitted events", () => {
      const beforeTime = Date.now();

      eventBus.emit({
        type: "LETTER_ADDED",
        letter: "X",
        position: 1,
      } as Omit<LetterAddedEvent, "timestamp">);

      const afterTime = Date.now();
      const emittedEvent = mockListener.mock.calls[0][0];

      expect(emittedEvent.timestamp).toBeGreaterThanOrEqual(beforeTime);
      expect(emittedEvent.timestamp).toBeLessThanOrEqual(afterTime);
    });

    it("should only notify listeners for the specific event type", () => {
      const mockOtherListener = jest.fn();
      eventBus.on("LETTER_REMOVED", mockOtherListener);

      eventBus.emit({
        type: "LETTER_ADDED",
        letter: "A",
        position: 0,
      } as Omit<LetterAddedEvent, "timestamp">);

      expect(mockListener).toHaveBeenCalledTimes(1);
      expect(mockOtherListener).not.toHaveBeenCalled();
      expect(mockGlobalListener).toHaveBeenCalledTimes(1);
    });
  });

  describe("Event Unsubscription", () => {
    it("should unsubscribe specific event listeners", () => {
      const unsubscribe = eventBus.on("LETTER_ADDED", mockListener);

      expect(eventBus.getListenerCount("LETTER_ADDED")).toBe(1);

      unsubscribe();

      expect(eventBus.getListenerCount("LETTER_ADDED")).toBe(0);
    });

    it("should unsubscribe global event listeners", () => {
      const unsubscribe = eventBus.onAll(mockGlobalListener);

      expect(eventBus.getListenerCount()).toBe(1);

      unsubscribe();

      expect(eventBus.getListenerCount()).toBe(0);
    });

    it("should not affect other listeners when unsubscribing", () => {
      const mockListener2 = jest.fn();
      const unsubscribe1 = eventBus.on("LETTER_ADDED", mockListener);
      const unsubscribe2 = eventBus.on("LETTER_ADDED", mockListener2);

      expect(eventBus.getListenerCount("LETTER_ADDED")).toBe(2);

      unsubscribe1();

      expect(eventBus.getListenerCount("LETTER_ADDED")).toBe(1);

      eventBus.emit({
        type: "LETTER_ADDED",
        letter: "A",
        position: 0,
      } as Omit<LetterAddedEvent, "timestamp">);

      expect(mockListener).not.toHaveBeenCalled();
      expect(mockListener2).toHaveBeenCalledTimes(1);
    });
  });

  describe("Listener Management", () => {
    it("should clear all listeners when no event type is specified", () => {
      eventBus.on("LETTER_ADDED", mockListener);
      eventBus.on("LETTER_REMOVED", mockListener);
      eventBus.onAll(mockGlobalListener);

      expect(eventBus.getListenerCount()).toBe(3);

      eventBus.clearListeners();

      expect(eventBus.getListenerCount()).toBe(0);
      expect(eventBus.getListenerCount("LETTER_ADDED")).toBe(0);
      expect(eventBus.getListenerCount("LETTER_REMOVED")).toBe(0);
    });

    it("should clear listeners for specific event type only", () => {
      eventBus.on("LETTER_ADDED", mockListener);
      eventBus.on("LETTER_REMOVED", mockListener);
      eventBus.onAll(mockGlobalListener);

      eventBus.clearListeners("LETTER_ADDED");

      expect(eventBus.getListenerCount("LETTER_ADDED")).toBe(0);
      expect(eventBus.getListenerCount("LETTER_REMOVED")).toBe(1);
      expect(eventBus.getListenerCount()).toBe(2); // 1 specific + 1 global
    });

    it("should return correct listener counts", () => {
      expect(eventBus.getListenerCount()).toBe(0);
      expect(eventBus.getListenerCount("LETTER_ADDED")).toBe(0);

      eventBus.on("LETTER_ADDED", mockListener);
      eventBus.on("LETTER_ADDED", jest.fn());
      eventBus.on("LETTER_REMOVED", mockListener);
      eventBus.onAll(mockGlobalListener);
      eventBus.onAll(jest.fn());

      expect(eventBus.getListenerCount("LETTER_ADDED")).toBe(2);
      expect(eventBus.getListenerCount("LETTER_REMOVED")).toBe(1);
      expect(eventBus.getListenerCount("NONEXISTENT")).toBe(0);
      expect(eventBus.getListenerCount()).toBe(5); // 2 + 1 + 2 global
    });
  });

  describe("Edge Cases", () => {
    it("should handle emitting events with no listeners", () => {
      expect(() => {
        eventBus.emit({
          type: "LETTER_ADDED",
          letter: "A",
          position: 0,
        } as Omit<LetterAddedEvent, "timestamp">);
      }).not.toThrow();
    });

    it("should handle clearing listeners for non-existent event types", () => {
      expect(() => {
        eventBus.clearListeners("NON_EXISTENT_EVENT");
      }).not.toThrow();

      expect(eventBus.getListenerCount("NON_EXISTENT_EVENT")).toBe(0);
    });

    it("should handle multiple unsubscribe calls", () => {
      const unsubscribe = eventBus.on("LETTER_ADDED", mockListener);

      expect(eventBus.getListenerCount("LETTER_ADDED")).toBe(1);

      unsubscribe();
      expect(eventBus.getListenerCount("LETTER_ADDED")).toBe(0);

      // Second call should not throw
      expect(() => unsubscribe()).not.toThrow();
      expect(eventBus.getListenerCount("LETTER_ADDED")).toBe(0);
    });

    it("should handle adding the same listener multiple times", () => {
      eventBus.on("LETTER_ADDED", mockListener);
      eventBus.on("LETTER_ADDED", mockListener);

      // Sets prevent duplicates, so should still be 1
      expect(eventBus.getListenerCount("LETTER_ADDED")).toBe(1);

      eventBus.emit({
        type: "LETTER_ADDED",
        letter: "A",
        position: 0,
      } as Omit<LetterAddedEvent, "timestamp">);

      // Should only be called once
      expect(mockListener).toHaveBeenCalledTimes(1);
    });
  });

  describe("Type Safety", () => {
    it("should correctly handle typed event listeners", () => {
      const typedListener: GameEventListener<LetterAddedEvent> = jest.fn();

      eventBus.on("LETTER_ADDED", typedListener);

      eventBus.emit({
        type: "LETTER_ADDED",
        letter: "A",
        position: 0,
      } as Omit<LetterAddedEvent, "timestamp">);

      expect(typedListener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "LETTER_ADDED",
          letter: "A",
          position: 0,
          timestamp: expect.any(Number),
        })
      );
    });

    it("should handle global listeners with union types", () => {
      const globalListener: GameEventListener<AnyGameEvent> = jest.fn();

      eventBus.onAll(globalListener);

      // Emit different types of events
      eventBus.emit({ type: "LETTER_ADDED", letter: "A", position: 0 } as Omit<
        LetterAddedEvent,
        "timestamp"
      >);
      eventBus.emit({ type: "LETTER_REMOVED", position: 1 } as Omit<
        LetterRemovedEvent,
        "timestamp"
      >);
      eventBus.emit({
        type: "GUESS_SUBMITTED",
        guess: "HELLO",
        attemptNumber: 1,
      } as Omit<GuessSubmittedEvent, "timestamp">);

      expect(globalListener).toHaveBeenCalledTimes(3);
    });
  });
});
