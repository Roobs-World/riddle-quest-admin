import {describe, expect, it} from "@jest/globals";
import {renderToStaticMarkup} from "react-dom/server";
import {createInitialGameSession, type GameSessionState} from "../../../hosted/play/gameSession";
import {VictoryModalContent} from "../modalPages/fanfare/VictoryModalContent";

/** Completed Daily receipt includes independent bonuses settled by the server. */
const dailyBreakdown = {baseWinCoins: 75, levelUpBonus: 10, dailyStreakBonus: 10,
  achievementBonus: 20, totalAwarded: 115, newBalance: 415};

/** Generates the visible completion state without introducing a second economy calculation. */
function completedState(gameMode: GameSessionState["gameMode"] = "challenge"): GameSessionState {
  return {...createInitialGameSession(), gameMode, completionAcknowledged: true,
    profile: {username: "Solver", coins: 900, xp: 140, level: 2, achievements: [], winStreak: 1,
      gamesPlayed: 1, wins: 1, classicIndex: 2},
    riddle: {riddleId: "reward-question", sessionToken: "reward-session", gameMode,
      ...(gameMode === "classic" ? {index: 1} : {}),
      text: "What has keys?", answerLength: 5, attemptsUsed: 1, hasUsedContinue: false, awaitingContinue: false,
      acceptedGuesses: [{attempt: 1, feedback: [{letter: "P", status: "green"}, {letter: "I", status: "green"},
        {letter: "A", status: "green"}, {letter: "N", status: "green"}, {letter: "O", status: "green"}]}]},
    lastOutcome: {id: "receipt-win", kind: "win", riddleId: "reward-question", sessionToken: "reward-session",
      gameMode, attempts: 1, isCorrect: true},
    lastRewards: {coinsEarned: 115, totalCoins: 415, newlyUnlockedAchievementIds: [], rewardBreakdown: dailyBreakdown}};
}

/** Server rendering observes the actual translated modal and its available action. */
const renderVictory = (state: GameSessionState) => renderToStaticMarkup(<VictoryModalContent state={state}
  onAdvance={() => undefined} onBalancePreview={() => undefined} />);

describe("VictoryModalContent receipt explanation", () => {
  it("explains the larger Daily grant while keeping the latest wallet and Next action visible", () => {
    /** A newer wallet refresh must outrank the balance captured by this historical receipt. */
    const html = renderVictory(completedState());
    expect(html).toContain("+115 Coins");
    expect(html).toMatch(/900\s+coins/u);
    expect(html).not.toMatch(/415\s+coins/u);
    expect(html).toContain('<dt>Daily puzzle</dt><dd><bdi dir="ltr">+75</bdi></dd>');
    expect(html).toContain('<dt>Streak bonus</dt><dd><bdi dir="ltr">+10</bdi></dd>');
    expect(html).toContain('<dt>Level-up bonus</dt><dd><bdi dir="ltr">+10</bdi></dd>');
    expect(html).toContain('<dt>Achievement bonus</dt><dd><bdi dir="ltr">+20</bdi></dd>');
    expect(html).not.toContain("Referral bonus");
    expect(html).toContain('class="play-primary reward-continue">Next</button>');
  });

  it("explains an ordinary Classic grant without displaying zero-value bonuses", () => {
    /** Only the authoritative base grant contributes to this ordinary win. */
    const state = completedState("classic");
    state.lastRewards = {coinsEarned: 25, newlyUnlockedAchievementIds: [], rewardBreakdown: {
      baseWinCoins: 25, levelUpBonus: 0, dailyStreakBonus: 0, achievementBonus: 0, totalAwarded: 25, newBalance: 325,
    }};
    /** The label follows the immutable completed mode. */
    const html = renderVictory(state);
    expect(html).toContain('<dt>Classic puzzle</dt><dd><bdi dir="ltr">+25</bdi></dd>');
    expect(html).toContain("Next Level");
    expect(html).not.toContain("Daily puzzle");
    expect(html).not.toContain("bonus</dt>");
  });

  it("keeps Classic Next enabled before duplicate completion acknowledgement while Daily still waits", () => {
    /** Accepted green feedback proves the Classic win before the separate reward-read acknowledgement. */
    const classic = renderVictory({...completedState("classic"), completionAcknowledged: false});
    expect(classic).toContain('class="play-primary reward-continue">Next Level</button>');
    /** Daily continuation still waits for its completion routing receipt. */
    const daily = renderVictory({...completedState("challenge"), completionAcknowledged: false});
    expect(daily).toContain('class="play-primary reward-continue" disabled="">Next</button>');
  });

  it("waits for progression when a recovered Classic win is still on its completed index", () => {
    /** Accepted winning history does not itself prove that completion advanced the authority. */
    const state = completedState("classic");
    state.completionAcknowledged = false;
    state.profile = {...state.profile!, classicIndex: 1};
    expect(renderVictory(state)).toContain('class="play-primary reward-continue" disabled="">Next Level</button>');
  });

  it("keeps ordinary provisional Classic advancement available", () => {
    /** A projected win retains its existing bounded issued-question path. */
    const state = completedState("classic");
    state.completionAcknowledged = false;
    state.profile = {...state.profile!, classicIndex: 1};
    state.riddle = {...state.riddle!, attemptsUsed: 0, acceptedGuesses: []};
    expect(renderVictory(state)).toContain('class="play-primary reward-continue">Next Level</button>');
  });

  it.each(["index", "profile"])("waits for a recovered Classic win with an unknown %s", missing => {
    /** Missing progression proof cannot enable navigation back to a completed round. */
    const state = completedState("classic");
    state.completionAcknowledged = false;
    if (missing === "index") state.riddle = {...state.riddle!, index: undefined};
    else state.profile = null;
    expect(renderVictory(state)).toContain('class="play-primary reward-continue" disabled="">Next Level</button>');
  });

  it("shows an explicitly awarded referral bonus and omits all receipt details before confirmation", () => {
    /** The optional referral component is displayed only when the server includes an award. */
    const state = completedState();
    state.lastRewards = {coinsEarned: 125, newlyUnlockedAchievementIds: [],
      rewardBreakdown: {...dailyBreakdown, referralBonus: 10, totalAwarded: 125}};
    expect(renderVictory(state)).toContain('<dt>Referral bonus</dt><dd><bdi dir="ltr">+10</bdi></dd>');
    /** An unacknowledged projected result cannot claim settled receipt components. */
    const provisional = renderVictory({...state, completionAcknowledged: false});
    expect(provisional).toContain('class="play-primary reward-continue" disabled=""');
    expect(provisional).not.toContain("victory-reward-breakdown");
  });
});
