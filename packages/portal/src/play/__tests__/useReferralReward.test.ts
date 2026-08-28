import {beforeEach, describe, expect, it, jest} from "@jest/globals";
import type {GameSessionAction} from "../gameSession";

/** Describes effect. */
type Effect = () => void | (() => void);
/** Provides effects behavior. */
const effects: Effect[] = [];

jest.mock("react", () => ({
  useEffect: (effect: Effect) => effects.push(effect),
}));

import {createInitialGameSession, gameSessionReducer} from "../gameSession";
import {useReferralReward} from "../game/hooks/useReferralReward";

/** Provides riddle behavior. */
const riddle = {
  riddleId: "classic-1",
  sessionToken: "00000000-0000-4000-8000-000000000001",
  text: "What has keys but cannot open doors?",
  answerLength: 5,
  gameMode: "classic" as const,
  index: 1,
  attemptsUsed: 0,
  hasUsedContinue: false,
  awaitingContinue: false,
};

describe("useReferralReward", () => {
  beforeEach(() => {
    effects.length = 0;
  });

  it("keeps a verified reward queued until authoritative initialization completes", () => {
    /** Lists eners. */
    const listeners = new Map<string, EventListener>();
    /** Provides reward window behavior. */
    const rewardWindow = {
      __RIDDLE_QUEST_PENDING_REFERRAL_REWARD__: {coinsAwarded: 25, newCoins: 205},
      addEventListener: jest.fn((name: string, listener: EventListener) => listeners.set(name, listener)),
      removeEventListener: jest.fn(),
    };
    Object.defineProperty(globalThis, "window", {configurable: true, value: rewardWindow});

    /** Provides state ref behavior. */
    const stateRef = {current: gameSessionReducer(createInitialGameSession(), {type: "loadRiddle", riddle})};
    /** Provides dispatch behavior. */
    const dispatch = jest.fn<(action: GameSessionAction) => void>();

    useReferralReward(stateRef, dispatch, false, riddle.riddleId);
    effects[0]();
    expect(dispatch).not.toHaveBeenCalled();
    expect(rewardWindow.__RIDDLE_QUEST_PENDING_REFERRAL_REWARD__).toBeDefined();

    stateRef.current = {...stateRef.current, initialized: true};
    effects.length = 0;
    useReferralReward(stateRef, dispatch, true, riddle.riddleId);
    effects[0]();

    expect(dispatch).toHaveBeenNthCalledWith(1, {type: "coinsUpdated", newCoins: 205});
    expect(dispatch).toHaveBeenNthCalledWith(2, {
      type: "showAuxiliaryFanfare",
      fanfare: expect.objectContaining({kind: "referral", coinsAwarded: 25, totalCoins: 205}),
    });
    expect(rewardWindow.__RIDDLE_QUEST_PENDING_REFERRAL_REWARD__).toBeUndefined();
    expect(listeners.has("riddle-quest:referral-reward")).toBe(true);
  });
});
