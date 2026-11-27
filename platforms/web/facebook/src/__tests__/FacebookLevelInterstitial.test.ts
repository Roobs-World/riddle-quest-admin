import {describe, expect, it, jest} from "@jest/globals";
import {completionPresentationKey} from "../../../../../src/gameplay/session/completion/completionPresentation";
import type {CompletionResult} from "../../../../../src/platform/contracts/hostServices";
import type {HostCompletionInput} from "../../../../../src/progression/browser/hostCompletionEffects";
import {createFacebookLevelInterstitial} from "../FacebookLevelInterstitial";

/** Each issued puzzle has a stable identity across transport retries. */
const puzzle = (index: number, gameMode: HostCompletionInput["gameMode"] = "classic"): HostCompletionInput => ({
  gameMode, riddleId: `riddle-${index}`, sessionToken: `issued-session-${index}`,
});
/** Authoritative success, independent of XP-level changes and awarded coins. */
const win: CompletionResult = {isCorrect: true, attempts: 2, coinsEarned: 50, newlyUnlockedAchievementIds: []};

/** Controlled provider work exposes the final display guard without loading an SDK. */
const setup = () => {
  const show = jest.fn<(isCurrent: () => boolean) => Promise<void>>(async () => undefined);
  const isActive = jest.fn(() => true);
  return {show, isActive, cadence: createFacebookLevelInterstitial({show, isActive})};
};

/** Holds SDK loading until the test has changed the owning result. */
const deferred = () => {
  let release: () => void;
  const promise = new Promise<void>(resolve => {release = resolve;});
  return {promise, resolve: () => release()};
};

describe("Facebook completed-level interstitial cadence", () => {
  it("offers an ad after wins three, six and nine across Classic and Daily", async () => {
    const {cadence, show} = setup();
    for (let index = 1; index <= 9; index += 1) {
      await cadence.complete(puzzle(index, index % 2 ? "classic" : "challenge"), win);
      expect(show).toHaveBeenCalledTimes(Math.floor(index / 3));
    }
  });

  it("does not count losses, XP level changes or repeated receipts as additional wins", async () => {
    const {cadence, show} = setup();
    await cadence.complete(puzzle(1), {...win, isCorrect: false, leveledUp: true, newLevel: 20});
    await cadence.complete(puzzle(2), {...win, leveledUp: true, newLevel: 21});
    await cadence.complete({...puzzle(2)}, {...win, leveledUp: true, newLevel: 21});
    await cadence.complete(puzzle(3), win);
    expect(show).not.toHaveBeenCalled();
    await cadence.complete(puzzle(4), win);
    expect(show).toHaveBeenCalledTimes(1);
  });

  it("distinguishes game mode, riddle and issued session identities", async () => {
    const {cadence, show} = setup();
    await cadence.complete(puzzle(1), win);
    await cadence.complete({...puzzle(1), gameMode: "challenge"}, win);
    await cadence.complete({...puzzle(1), sessionToken: "another-issued-session"}, win);
    expect(show).toHaveBeenCalledTimes(1);
    await cadence.complete({...puzzle(1), riddleId: "another-riddle"}, win);
    expect(show).toHaveBeenCalledTimes(1);
  });

  it("consumes a suppressed or failed opportunity rather than retrying on the next level", async () => {
    const {cadence, show} = setup();
    await cadence.complete(puzzle(1), win);
    await cadence.complete(puzzle(2), win);
    show.mockRejectedValueOnce(new Error("ADS_NO_FILL"));
    await expect(cadence.complete(puzzle(3), win)).rejects.toThrow("ADS_NO_FILL");
    await cadence.complete(puzzle(3), win);
    await cadence.complete(puzzle(4), win);
    await cadence.complete(puzzle(5), win);
    expect(show).toHaveBeenCalledTimes(1);
    await cadence.complete(puzzle(6), win);
    expect(show).toHaveBeenCalledTimes(2);
  });

  it("remembers a dismissed result when its authoritative completion arrives later", async () => {
    const {cadence, show} = setup();
    await cadence.complete(puzzle(1), win);
    await cadence.complete(puzzle(2), win);
    cadence.dismiss(completionPresentationKey(puzzle(3)));
    await cadence.complete(puzzle(3), win);
    await cadence.complete(puzzle(4), win);
    expect(show).not.toHaveBeenCalled();
    await cadence.complete(puzzle(5), win);
    await cadence.complete(puzzle(6), win);
    expect(show).toHaveBeenCalledTimes(1);
  });

  it.each(["dismissed", "replacement", "failed replacement", "inactive", "retired"])(
    "revokes the SDK display guard while loading when the result becomes %s",
    async reason => {
      const {cadence, show, isActive} = setup();
      const loading = deferred();
      const displayed = jest.fn();
      show.mockImplementationOnce(async isCurrent => {
        await loading.promise;
        if (isCurrent()) displayed();
      });
      await cadence.complete(puzzle(1), win);
      await cadence.complete(puzzle(2), win);
      const pending = cadence.complete(puzzle(3), win);
      await cadence.complete(puzzle(3), win);
      expect(show).toHaveBeenCalledTimes(1);
      if (reason === "dismissed") cadence.dismiss(completionPresentationKey(puzzle(3)));
      if (reason === "replacement") await cadence.complete(puzzle(4), win);
      if (reason === "failed replacement") await cadence.complete(puzzle(4), {...win, isCorrect: false});
      if (reason === "inactive") isActive.mockReturnValue(false);
      if (reason === "retired") cadence.retire();
      loading.resolve();
      await pending;
      expect(displayed).not.toHaveBeenCalled();
    },
  );

  it("leaves a pending display valid when only the same receipt is replayed", async () => {
    const {cadence, show} = setup();
    const loading = deferred();
    const displayed = jest.fn();
    show.mockImplementationOnce(async isCurrent => {
      await loading.promise;
      if (isCurrent()) displayed();
    });
    await cadence.complete(puzzle(1), win);
    await cadence.complete(puzzle(2), win);
    const pending = cadence.complete(puzzle(3), win);
    await cadence.complete({...puzzle(3)}, {...win});
    loading.resolve();
    await pending;
    expect(displayed).toHaveBeenCalledTimes(1);
  });

  it("keeps account visits independent and ignores calls after retirement", async () => {
    const {cadence, show} = setup();
    await cadence.complete(puzzle(1), win);
    await cadence.complete(puzzle(2), win);
    cadence.retire();
    await cadence.complete(puzzle(3), win);
    expect(show).not.toHaveBeenCalled();
    const replacement = createFacebookLevelInterstitial({show, isActive: () => true});
    await replacement.complete(puzzle(3), win);
    await replacement.complete(puzzle(4), win);
    expect(show).not.toHaveBeenCalled();
    await replacement.complete(puzzle(5), win);
    expect(show).toHaveBeenCalledTimes(1);
  });
});
