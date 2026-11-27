import {describe, expect, it} from "@jest/globals";
import {renderToStaticMarkup} from "react-dom/server";
import {createInitialGameSession, type GameSessionState} from "../../../../gameplay/session/gameSession";
import {VictoryModalContent} from "../VictoryModalContent";
import {ReferralSharingProvider, type ReferralSharingCapability} from "../../../../sharing/components/ReferralSharingCapability";

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
    lastRewards: {coinsEarned: 115, totalCoins: 415, newXp: 140, newWinStreak: 7,
      newlyUnlockedAchievementIds: [], rewardBreakdown: dailyBreakdown}};
}

/** Server rendering observes the actual translated modal and its available action. */
const renderVictory = (state: GameSessionState) => renderToStaticMarkup(<VictoryModalContent state={state}
  onAdvance={() => undefined} onBalancePreview={() => undefined} />);

describe("VictoryModalContent", () => {
  it("offers result sharing only for confirmed wins on a supporting target", () => {
    const capability: ReferralSharingCapability = {
      rewardCoins: 0, shareInvite: async () => "success", shareResult: async () => "success",
    };
    const renderShared = (state: GameSessionState, sharing = capability) => renderToStaticMarkup(
      <ReferralSharingProvider capability={sharing}><VictoryModalContent state={state}
        onAdvance={() => undefined} onBalancePreview={() => undefined} /></ReferralSharingProvider>,
    );
    expect(renderShared(completedState())).toContain('class="result-share"');
    expect(renderShared({...completedState(), completionAcknowledged: false})).not.toContain('class="result-share"');
    expect(renderShared(completedState(), {...capability, shareResult: undefined})).not.toContain('class="result-share"');
    expect(renderVictory(completedState())).not.toContain('class="result-share"');
  });

  it("keeps the Daily award, latest wallet and Next action without the extra heading or stats", () => {
    /** A newer wallet refresh must outrank the balance captured by this historical receipt. */
    const html = renderVictory(completedState());
    expect(html).toContain("+115 Coins");
    expect(html).toMatch(/900\s+coins/u);
    expect(html).not.toMatch(/415\s+coins/u);
    expect(html).not.toContain("YOU WON!");
    expect(html).not.toContain("<dl");
    expect(html).not.toContain("140 XP");
    expect(html).not.toContain("🔥");
    expect(html).toContain('class="play-primary reward-continue">Next</button>');
  });

  it("keeps the Classic award and Next Level action without reward rows", () => {
    /** Only the authoritative base grant contributes to this ordinary win. */
    const state = completedState("classic");
    state.lastRewards = {coinsEarned: 25, newlyUnlockedAchievementIds: [], rewardBreakdown: {
      baseWinCoins: 25, levelUpBonus: 0, dailyStreakBonus: 0, achievementBonus: 0, totalAwarded: 25, newBalance: 325,
    }};
    /** The total and action follow the completed Classic round. */
    const html = renderVictory(state);
    expect(html).toContain("+25 Coins");
    expect(html).toContain("Next Level");
    expect(html).not.toContain("<dl");
  });

  it("allows an advanced Classic round immediately while Daily still waits for its receipt", () => {
    const classic = renderVictory({...completedState("classic"), completionAcknowledged: false});
    expect(classic).toContain('class="play-primary reward-continue">Next Level</button>');
    const daily = renderVictory({...completedState("challenge"), completionAcknowledged: false});
    expect(daily).toContain('class="spinning-wheel-loader reward-continue-loading"');
    expect(daily).not.toContain('class="play-primary reward-continue"');
  });

  it("enables Next Level while confirmed milestones are still queued", () => {
    const state = completedState("classic");
    state.lastRewards = {coinsEarned: 115, leveledUp: true, newLevel: 2,
      newlyUnlockedAchievementIds: ["first_win", "perfect_guess"]};
    expect(renderVictory(state)).toContain('class="play-primary reward-continue">Next Level</button>');
  });

  it("waits for progression when a recovered Classic win is still on its completed index", () => {
    /** Accepted winning history does not itself prove that completion advanced the authority. */
    const state = completedState("classic");
    state.completionAcknowledged = false;
    state.profile = {...state.profile!, classicIndex: 1};
    const html = renderVictory(state);
    expect(html).toContain('class="spinning-wheel-loader reward-continue-loading"');
    expect(html).toContain('role="status"');
    expect(html).not.toContain("Next Level");
  });

  it("allows a provisional Classic win to continue without waiting for rewards", () => {
    const state = completedState("classic");
    state.completionAcknowledged = false;
    state.profile = {...state.profile!, classicIndex: 1};
    state.riddle = {...state.riddle!, attemptsUsed: 0, acceptedGuesses: []};
    expect(renderVictory(state)).toContain('class="play-primary reward-continue">Next Level</button>');
  });

  it("renders the chest, current balance and Next immediately while rewards arrive", () => {
    const state = completedState("classic");
    state.completionAcknowledged = false;
    state.lastRewards = null;
    state.riddle = {...state.riddle!, attemptsUsed: 0, acceptedGuesses: []};
    const html = renderVictory(state);
    expect(html).toContain('class="reward-chest waiting"');
    expect(html).toMatch(/900\s+coins/u);
    expect(html).toContain('class="play-primary reward-continue">Next Level</button>');
    expect(html).not.toContain("+0 Coins");
  });

  it.each(["index", "profile"])("waits for a recovered Classic win with an unknown %s", missing => {
    /** Missing progression proof cannot enable navigation back to a completed round. */
    const state = completedState("classic");
    state.completionAcknowledged = false;
    if (missing === "index") state.riddle = {...state.riddle!, index: undefined};
    else state.profile = null;
    const html = renderVictory(state);
    expect(html).toContain('class="spinning-wheel-loader reward-continue-loading"');
    expect(html).toContain('role="status"');
    expect(html).not.toContain("Next Level");
  });

  it("keeps a referral-inclusive total without rendering bonus rows", () => {
    /** The modal uses the server's total even when it includes a referral award. */
    const state = completedState();
    state.lastRewards = {coinsEarned: 125, newlyUnlockedAchievementIds: [],
      rewardBreakdown: {...dailyBreakdown, referralBonus: 10, totalAwarded: 125}};
    const html = renderVictory(state);
    expect(html).toContain("+125 Coins");
    expect(html).not.toContain("<dl");
    /** An unacknowledged Daily result still cannot advance. */
    const provisional = renderVictory({...state, completionAcknowledged: false});
    expect(provisional).toContain('class="spinning-wheel-loader reward-continue-loading"');
    expect(provisional).not.toContain('class="play-primary reward-continue"');
    expect(provisional).not.toContain("<dl");
  });
});
