import {createJestStartupRiddlePreload} from "../startupRiddlePreload";
import type {HostServices} from "../../../../../src/platform/contracts/hostServices";
import type {BridgeRiddle} from "../../../../../src/platform/bridge/messages";

/** Controls optional authority requests independently from actual game loading. */
const deferred = () => {
  /** Resolves the issued question. */
  let resolve!: (value: BridgeRiddle) => void;
  /** Rejects an optional speculative read. */
  let reject!: (error: Error) => void;
  /** Request observed by both preparation and a matching fallback. */
  const promise = new Promise<BridgeRiddle>((done, fail) => {resolve = done; reject = fail;});
  return {promise, resolve, reject};
};

/** Server-issued fixture shared by assertions without encoding answers. */
const riddle: BridgeRiddle = {gameMode: "classic", locale: "en", index: 7,
  riddleId: "issued", sessionToken: "signed-session", text: "Fixture", answerLength: 5};

it("starts Classic before Daily and reuses the pending response exactly once", async () => {
  /** Independent authority request remains pending through the launch decision. */
  const pending = deferred();
  /** Existing adapter still owns every read. */
  const loadRiddle = jest.fn<HostServices["loadRiddle"]>().mockReturnValueOnce(pending.promise).mockResolvedValue(riddle);
  /** Isolated startup adapter. */
  const startup = createJestStartupRiddlePreload({loadRiddle});
  startup.preloadClassic("en", 7);
  await startup.services.loadRiddle({gameMode: "challenge", locale: "en"});
  /** Fallback consumes the already-issued request instead of starting another. */
  const classic = startup.services.loadRiddle({gameMode: "classic", locale: "en", classicIndex: 7});
  expect(loadRiddle.mock.calls.map(([input]) => input.gameMode)).toEqual(["classic", "challenge"]);
  pending.resolve(riddle);
  await expect(classic).resolves.toEqual(riddle);
  await startup.services.loadRiddle({gameMode: "classic", locale: "en", classicIndex: 7});
  expect(loadRiddle).toHaveBeenCalledTimes(3);
});

it.each([
  {locale: "tr", classicIndex: 7},
  {locale: "en", classicIndex: 8},
  {locale: "en", classicIndex: 7, authoritative: true},
  {locale: "en", classicIndex: 7, sessionToken: "resume"},
  {locale: "en", classicIndex: 7, riddleId: "resume"},
])("does not substitute startup content for a different or authoritative request: %j", async (input) => {
  /** Adapter observes the exact requested locale, progression, or recovery token. */
  const loadRiddle = jest.fn<HostServices["loadRiddle"]>().mockResolvedValue(riddle);
  /** Speculative entry may only satisfy an ordinary matching first load. */
  const startup = createJestStartupRiddlePreload({loadRiddle});
  startup.preloadClassic("en", 7);
  await startup.services.loadRiddle({gameMode: "classic", ...input});
  expect(loadRiddle).toHaveBeenCalledTimes(2);
  expect(loadRiddle).toHaveBeenLastCalledWith({gameMode: "classic", ...input});
});

it.each(["expired", "retired"])("does not reuse an %s startup snapshot", async (scenario) => {
  /** Deterministic expiry clock. */
  let time = 0;
  /** Tracks the next ordinary authority request. */
  const loadRiddle = jest.fn<HostServices["loadRiddle"]>().mockResolvedValue(riddle);
  /** Startup entry is scoped to this attempt and a short freshness window. */
  const startup = createJestStartupRiddlePreload({loadRiddle}, () => time);
  startup.preloadClassic("en", 7);
  if (scenario === "expired") time = 30_000; else startup.clear();
  await startup.services.loadRiddle({gameMode: "classic", locale: "en", classicIndex: 7});
  expect(loadRiddle).toHaveBeenCalledTimes(2);
});

it("retries the ordinary authority path after an optional preload failure", async () => {
  /** Optional read fails while the actual matching load is waiting for it. */
  const pending = deferred();
  /** Second read succeeds through the same target adapter. */
  const loadRiddle = jest.fn<HostServices["loadRiddle"]>().mockReturnValueOnce(pending.promise).mockResolvedValue(riddle);
  /** Tracks one launch preparation attempt. */
  const startup = createJestStartupRiddlePreload({loadRiddle});
  startup.preloadClassic("en", 7);
  /** The actual load must not fail only because speculation failed. */
  const load = startup.services.loadRiddle({gameMode: "classic", locale: "en", classicIndex: 7});
  pending.reject(new Error("preload-offline"));
  await expect(load).resolves.toEqual(riddle);
  expect(loadRiddle).toHaveBeenCalledTimes(2);
});

it("does not let an older failure retire a replacement startup attempt", async () => {
  /** First attempt retires while its network read remains pending. */
  const older = deferred();
  /** Replacement attempt owns a different locale. */
  const replacement = deferred();
  /** Records requests from both attempts. */
  const loadRiddle = jest.fn<HostServices["loadRiddle"]>().mockReturnValueOnce(older.promise).mockReturnValueOnce(replacement.promise);
  /** Adapter lives through a startup retry. */
  const startup = createJestStartupRiddlePreload({loadRiddle});
  startup.preloadClassic("en", 7);
  startup.clear(); startup.preloadClassic("tr", 7);
  older.reject(new Error("previous-attempt-offline"));
  await Promise.resolve();
  /** Replacement fallback must share its own issued request. */
  const load = startup.services.loadRiddle({gameMode: "classic", locale: "tr", classicIndex: 7});
  replacement.resolve(riddle);
  await expect(load).resolves.toEqual(riddle);
  expect(loadRiddle).toHaveBeenCalledTimes(2);
});

it.each([0, -1, 1.5, Number.NaN])("does not issue Classic using invalid profile position %s", (index) => {
  /** No read may use malformed projection state. */
  const loadRiddle = jest.fn<HostServices["loadRiddle"]>();
  createJestStartupRiddlePreload({loadRiddle}).preloadClassic("en", index);
  expect(loadRiddle).not.toHaveBeenCalled();
});
