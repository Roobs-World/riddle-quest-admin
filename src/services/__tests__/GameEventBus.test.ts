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

    it("should maintain state across getInstance calls", () => {
      const instance1 = GameEventBus.getInstance();
      instance1.on("LETTER_ADDED", mockListener);

      const instance2 = GameEventBus.getInstance();
      expect(instance2.getListenerCount("LETTER_ADDED")).toBe(1);
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

    it("should allow subscribing to different event types", () => {
      eventBus.on("LETTER_ADDED", mockListener);
      eventBus.on("LETTER_REMOVED", mockListener);
      eventBus.on("GUESS_SUBMITTED", mockListener);

      expect(eventBus.getListenerCount("LETTER_ADDED")).toBe(1);
      expect(eventBus.getListenerCount("LETTER_REMOVED")).toBe(1);
      expect(eventBus.getListenerCount("GUESS_SUBMITTED")).toBe(1);
      expect(eventBus.getListenerCount()).toBe(3);
    });

    it("should create listener set lazily on first subscription", () => {
      expect(eventBus.getListenerCount("HINT_REQUESTED")).toBe(0);

      eventBus.on("HINT_REQUESTED", mockListener);

      expect(eventBus.getListenerCount("HINT_REQUESTED")).toBe(1);
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

    it("should emit GUESS_VALIDATED events with correct guess", () => {
      const mockGuessValidatedListener = jest.fn();
      eventBus.on("GUESS_VALIDATED", mockGuessValidatedListener);

      const event: Omit<GuessValidatedEvent, "timestamp"> = {
        type: "GUESS_VALIDATED",
        guess: "WORLD",
        feedback: [
          { letter: "W", status: "green" },
          { letter: "O", status: "green" },
          { letter: "R", status: "green" },
          { letter: "L", status: "green" },
          { letter: "D", status: "green" },
        ],
        isCorrect: true,
      };

      eventBus.emit(event);

      const emittedEvent = mockGuessValidatedListener.mock.calls[0][0];
      expect(emittedEvent.isCorrect).toBe(true);
      expect(emittedEvent.feedback.every((f: { status: string }) => f.status === "green")).toBe(true);
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

    it("should emit GAME_COMPLETED events with lost outcome", () => {
      const mockGameCompletedListener = jest.fn();
      eventBus.on("GAME_COMPLETED", mockGameCompletedListener);

      const event: Omit<GameCompletedEvent, "timestamp"> = {
        type: "GAME_COMPLETED",
        outcome: "lost",
        attempts: 6,
      };

      eventBus.emit(event);

      const emittedEvent = mockGameCompletedListener.mock.calls[0][0];
      expect(emittedEvent.outcome).toBe("lost");
      expect(emittedEvent.coinsEarned).toBeUndefined();
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

    it("should emit HINT_REQUESTED events with position hint type", () => {
      const mockHintRequestedListener = jest.fn();
      eventBus.on("HINT_REQUESTED", mockHintRequestedListener);

      const event: Omit<HintRequestedEvent, "timestamp"> = {
        type: "HINT_REQUESTED",
        hintType: "position",
      };

      eventBus.emit(event);

      const emittedEvent = mockHintRequestedListener.mock.calls[0][0];
      expect(emittedEvent.hintType).toBe("position");
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

    it("should call all listeners for the same event type in order", () => {
      const callOrder: number[] = [];
      const listener1 = jest.fn(() => callOrder.push(1));
      const listener2 = jest.fn(() => callOrder.push(2));
      const listener3 = jest.fn(() => callOrder.push(3));

      eventBus.clearListeners();
      eventBus.on("LETTER_ADDED", listener1);
      eventBus.on("LETTER_ADDED", listener2);
      eventBus.on("LETTER_ADDED", listener3);

      eventBus.emit({
        type: "LETTER_ADDED",
        letter: "A",
        position: 0,
      } as Omit<LetterAddedEvent, "timestamp">);

      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).toHaveBeenCalledTimes(1);
      expect(listener3).toHaveBeenCalledTimes(1);
      expect(callOrder).toHaveLength(3);
    });

    it("should call specific listeners before global listeners", () => {
      const callOrder: string[] = [];
      const specificListener = jest.fn(() => callOrder.push("specific"));
      const globalListener = jest.fn(() => callOrder.push("global"));

      eventBus.clearListeners();
      eventBus.on("LETTER_ADDED", specificListener);
      eventBus.onAll(globalListener);

      eventBus.emit({
        type: "LETTER_ADDED",
        letter: "A",
        position: 0,
      } as Omit<LetterAddedEvent, "timestamp">);

      expect(callOrder).toEqual(["specific", "global"]);
    });

    it("should emit multiple events in sequence", () => {
      const letterAddedListener = jest.fn();
      eventBus.on("LETTER_ADDED", letterAddedListener);

      eventBus.emit({ type: "LETTER_ADDED", letter: "H", position: 0 } as Omit<LetterAddedEvent, "timestamp">);
      eventBus.emit({ type: "LETTER_ADDED", letter: "E", position: 1 } as Omit<LetterAddedEvent, "timestamp">);
      eventBus.emit({ type: "LETTER_ADDED", letter: "L", position: 2 } as Omit<LetterAddedEvent, "timestamp">);

      expect(letterAddedListener).toHaveBeenCalledTimes(3);
      expect(letterAddedListener.mock.calls[0][0].letter).toBe("H");
      expect(letterAddedListener.mock.calls[1][0].letter).toBe("E");
      expect(letterAddedListener.mock.calls[2][0].letter).toBe("L");
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

    it("should not receive events after unsubscribing", () => {
      const unsubscribe = eventBus.on("LETTER_ADDED", mockListener);

      eventBus.emit({ type: "LETTER_ADDED", letter: "A", position: 0 } as Omit<LetterAddedEvent, "timestamp">);
      expect(mockListener).toHaveBeenCalledTimes(1);

      unsubscribe();

      eventBus.emit({ type: "LETTER_ADDED", letter: "B", position: 1 } as Omit<LetterAddedEvent, "timestamp">);
      expect(mockListener).toHaveBeenCalledTimes(1);
    });

    it("should not receive global events after unsubscribing", () => {
      const unsubscribe = eventBus.onAll(mockGlobalListener);

      eventBus.emit({ type: "LETTER_ADDED", letter: "A", position: 0 } as Omit<LetterAddedEvent, "timestamp">);
      expect(mockGlobalListener).toHaveBeenCalledTimes(1);

      unsubscribe();

      eventBus.emit({ type: "LETTER_REMOVED", position: 0 } as Omit<LetterRemovedEvent, "timestamp">);
      expect(mockGlobalListener).toHaveBeenCalledTimes(1);
    });

    it("should handle unsubscribing in the middle of other subscriptions", () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();
      const listener3 = jest.fn();

      eventBus.on("LETTER_ADDED", listener1);
      const unsubscribe2 = eventBus.on("LETTER_ADDED", listener2);
      eventBus.on("LETTER_ADDED", listener3);

      unsubscribe2();

      eventBus.emit({ type: "LETTER_ADDED", letter: "A", position: 0 } as Omit<LetterAddedEvent, "timestamp">);

      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).not.toHaveBeenCalled();
      expect(listener3).toHaveBeenCalledTimes(1);
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

    it("should not receive events after clearListeners", () => {
      eventBus.on("LETTER_ADDED", mockListener);
      eventBus.onAll(mockGlobalListener);

      eventBus.clearListeners();

      eventBus.emit({ type: "LETTER_ADDED", letter: "A", position: 0 } as Omit<LetterAddedEvent, "timestamp">);

      expect(mockListener).not.toHaveBeenCalled();
      expect(mockGlobalListener).not.toHaveBeenCalled();
    });

    it("should allow re-subscribing after clearListeners", () => {
      eventBus.on("LETTER_ADDED", mockListener);
      eventBus.clearListeners();
      eventBus.on("LETTER_ADDED", mockListener);

      eventBus.emit({ type: "LETTER_ADDED", letter: "A", position: 0 } as Omit<LetterAddedEvent, "timestamp">);

      expect(mockListener).toHaveBeenCalledTimes(1);
    });

    it("should handle clearing specific event type multiple times", () => {
      eventBus.on("LETTER_ADDED", mockListener);
      eventBus.clearListeners("LETTER_ADDED");
      eventBus.clearListeners("LETTER_ADDED");

      expect(eventBus.getListenerCount("LETTER_ADDED")).toBe(0);
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

    it("should handle emitting with only global listeners and no specific listeners", () => {
      eventBus.onAll(mockGlobalListener);

      eventBus.emit({ type: "LETTER_ADDED", letter: "A", position: 0 } as Omit<LetterAddedEvent, "timestamp">);

      expect(mockGlobalListener).toHaveBeenCalledTimes(1);
      expect(mockGlobalListener.mock.calls[0][0].type).toBe("LETTER_ADDED");
    });

    it("should handle adding the same global listener multiple times", () => {
      eventBus.onAll(mockGlobalListener);
      eventBus.onAll(mockGlobalListener);

      // Sets prevent duplicates
      expect(eventBus.getListenerCount()).toBe(1);

      eventBus.emit({ type: "LETTER_ADDED", letter: "A", position: 0 } as Omit<LetterAddedEvent, "timestamp">);

      expect(mockGlobalListener).toHaveBeenCalledTimes(1);
    });

    it("should handle events with boundary position values", () => {
      const listener = jest.fn();
      eventBus.on("LETTER_ADDED", listener);

      eventBus.emit({ type: "LETTER_ADDED", letter: "A", position: 0 } as Omit<LetterAddedEvent, "timestamp">);
      eventBus.emit({ type: "LETTER_ADDED", letter: "Z", position: 4 } as Omit<LetterAddedEvent, "timestamp">);

      expect(listener).toHaveBeenCalledTimes(2);
      expect(listener.mock.calls[0][0].position).toBe(0);
      expect(listener.mock.calls[1][0].position).toBe(4);
    });

    it("should handle events with lowercase letters", () => {
      const listener = jest.fn();
      eventBus.on("LETTER_ADDED", listener);

      eventBus.emit({ type: "LETTER_ADDED", letter: "a", position: 0 } as Omit<LetterAddedEvent, "timestamp">);

      expect(listener.mock.calls[0][0].letter).toBe("a");
    });

    it("should handle GUESS_SUBMITTED with high attempt numbers", () => {
      const listener = jest.fn();
      eventBus.on("GUESS_SUBMITTED", listener);

      eventBus.emit({
        type: "GUESS_SUBMITTED",
        guess: "FINAL",
        attemptNumber: 6,
      } as Omit<GuessSubmittedEvent, "timestamp">);

      expect(listener.mock.calls[0][0].attemptNumber).toBe(6);
    });

    it("should handle GAME_COMPLETED with zero coins earned", () => {
      const listener = jest.fn();
      eventBus.on("GAME_COMPLETED", listener);

      eventBus.emit({
        type: "GAME_COMPLETED",
        outcome: "won",
        attempts: 6,
        coinsEarned: 0,
      } as Omit<GameCompletedEvent, "timestamp">);

      expect(listener.mock.calls[0][0].coinsEarned).toBe(0);
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

    it("should correctly type all event types in AnyGameEvent union", () => {
      const globalListener: GameEventListener<AnyGameEvent> = jest.fn();
      eventBus.onAll(globalListener);

      // Emit all event types
      eventBus.emit({ type: "LETTER_ADDED", letter: "A", position: 0 } as Omit<LetterAddedEvent, "timestamp">);
      eventBus.emit({ type: "LETTER_REMOVED", position: 0 } as Omit<LetterRemovedEvent, "timestamp">);
      eventBus.emit({ type: "GUESS_SUBMITTED", guess: "HELLO", attemptNumber: 1 } as Omit<GuessSubmittedEvent, "timestamp">);
      eventBus.emit({
        type: "GUESS_VALIDATED",
        guess: "HELLO",
        feedback: [{ letter: "H", status: "green" }],
        isCorrect: false,
      } as Omit<GuessValidatedEvent, "timestamp">);
      eventBus.emit({ type: "GAME_COMPLETED", outcome: "won", attempts: 3 } as Omit<GameCompletedEvent, "timestamp">);
      eventBus.emit({ type: "HINT_REQUESTED", hintType: "letter" } as Omit<HintRequestedEvent, "timestamp">);

      expect(globalListener).toHaveBeenCalledTimes(6);

      // Verify each call received the correct event type
      expect(globalListener.mock.calls[0][0].type).toBe("LETTER_ADDED");
      expect(globalListener.mock.calls[1][0].type).toBe("LETTER_REMOVED");
      expect(globalListener.mock.calls[2][0].type).toBe("GUESS_SUBMITTED");
      expect(globalListener.mock.calls[3][0].type).toBe("GUESS_VALIDATED");
      expect(globalListener.mock.calls[4][0].type).toBe("GAME_COMPLETED");
      expect(globalListener.mock.calls[5][0].type).toBe("HINT_REQUESTED");
    });

    it("should type check LetterRemovedEvent listener", () => {
      const typedListener: GameEventListener<LetterRemovedEvent> = jest.fn();
      eventBus.on("LETTER_REMOVED", typedListener);

      eventBus.emit({ type: "LETTER_REMOVED", position: 3 } as Omit<LetterRemovedEvent, "timestamp">);

      expect(typedListener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "LETTER_REMOVED",
          position: 3,
          timestamp: expect.any(Number),
        })
      );
    });

    it("should type check GuessSubmittedEvent listener", () => {
      const typedListener: GameEventListener<GuessSubmittedEvent> = jest.fn();
      eventBus.on("GUESS_SUBMITTED", typedListener);

      eventBus.emit({
        type: "GUESS_SUBMITTED",
        guess: "WORLD",
        attemptNumber: 2,
      } as Omit<GuessSubmittedEvent, "timestamp">);

      expect(typedListener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "GUESS_SUBMITTED",
          guess: "WORLD",
          attemptNumber: 2,
          timestamp: expect.any(Number),
        })
      );
    });

    it("should type check GuessValidatedEvent listener", () => {
      const typedListener: GameEventListener<GuessValidatedEvent> = jest.fn();
      eventBus.on("GUESS_VALIDATED", typedListener);

      const feedback = [
        { letter: "T", status: "green" as const },
        { letter: "E", status: "yellow" as const },
        { letter: "S", status: "red" as const },
        { letter: "T", status: "green" as const },
        { letter: "S", status: "red" as const },
      ];

      eventBus.emit({
        type: "GUESS_VALIDATED",
        guess: "TESTS",
        feedback,
        isCorrect: false,
      } as Omit<GuessValidatedEvent, "timestamp">);

      expect(typedListener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "GUESS_VALIDATED",
          guess: "TESTS",
          feedback,
          isCorrect: false,
          timestamp: expect.any(Number),
        })
      );
    });

    it("should type check GameCompletedEvent listener", () => {
      const typedListener: GameEventListener<GameCompletedEvent> = jest.fn();
      eventBus.on("GAME_COMPLETED", typedListener);

      eventBus.emit({
        type: "GAME_COMPLETED",
        outcome: "lost",
        attempts: 6,
      } as Omit<GameCompletedEvent, "timestamp">);

      expect(typedListener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "GAME_COMPLETED",
          outcome: "lost",
          attempts: 6,
          timestamp: expect.any(Number),
        })
      );
    });

    it("should type check HintRequestedEvent listener", () => {
      const typedListener: GameEventListener<HintRequestedEvent> = jest.fn();
      eventBus.on("HINT_REQUESTED", typedListener);

      eventBus.emit({
        type: "HINT_REQUESTED",
        hintType: "position",
      } as Omit<HintRequestedEvent, "timestamp">);

      expect(typedListener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "HINT_REQUESTED",
          hintType: "position",
          timestamp: expect.any(Number),
        })
      );
    });
  });

  describe("Event Data Integrity", () => {
    it("should not modify the original event object", () => {
      const originalEvent = {
        type: "LETTER_ADDED" as const,
        letter: "A",
        position: 0,
      };
      const originalCopy = { ...originalEvent };

      eventBus.emit(originalEvent);

      expect(originalEvent).toEqual(originalCopy);
      expect(originalEvent).not.toHaveProperty("timestamp");
    });

    it("should pass the same event object to all listeners", () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();
      const globalListener = jest.fn();

      eventBus.on("LETTER_ADDED", listener1);
      eventBus.on("LETTER_ADDED", listener2);
      eventBus.onAll(globalListener);

      eventBus.emit({ type: "LETTER_ADDED", letter: "A", position: 0 } as Omit<LetterAddedEvent, "timestamp">);

      const event1 = listener1.mock.calls[0][0];
      const event2 = listener2.mock.calls[0][0];
      const globalEvent = globalListener.mock.calls[0][0];

      expect(event1).toBe(event2);
      expect(event1).toBe(globalEvent);
    });

    it("should have unique timestamps for sequential events", () => {
      const listener = jest.fn();
      eventBus.on("LETTER_ADDED", listener);

      eventBus.emit({ type: "LETTER_ADDED", letter: "A", position: 0 } as Omit<LetterAddedEvent, "timestamp">);
      eventBus.emit({ type: "LETTER_ADDED", letter: "B", position: 1 } as Omit<LetterAddedEvent, "timestamp">);

      const timestamp1 = listener.mock.calls[0][0].timestamp;
      const timestamp2 = listener.mock.calls[1][0].timestamp;

      expect(timestamp2).toBeGreaterThanOrEqual(timestamp1);
    });
  });

  describe("Concurrent Operations", () => {
    it("should handle rapid event emissions", () => {
      const listener = jest.fn();
      eventBus.on("LETTER_ADDED", listener);

      for (let i = 0; i < 100; i++) {
        eventBus.emit({
          type: "LETTER_ADDED",
          letter: String.fromCharCode(65 + (i % 26)),
          position: i % 5,
        } as Omit<LetterAddedEvent, "timestamp">);
      }

      expect(listener).toHaveBeenCalledTimes(100);
    });

    it("should handle subscribe/unsubscribe cycles", () => {
      const listener = jest.fn();

      for (let i = 0; i < 10; i++) {
        const unsubscribe = eventBus.on("LETTER_ADDED", listener);
        eventBus.emit({ type: "LETTER_ADDED", letter: "A", position: 0 } as Omit<LetterAddedEvent, "timestamp">);
        unsubscribe();
      }

      expect(listener).toHaveBeenCalledTimes(10);
      expect(eventBus.getListenerCount("LETTER_ADDED")).toBe(0);
    });
  });
});
