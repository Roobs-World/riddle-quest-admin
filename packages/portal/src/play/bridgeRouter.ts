import type {GameToHostMessage, HostToGameMessage} from "@qwordly/core/bridge";

/** Describes bridge parsers. */
type BridgeParsers = Pick<typeof import("@qwordly/core/bridge"), "parseGameToHostMessage" | "parseHostToGameMessage">;

/** Provides bridge parsers promise behavior. */
let bridgeParsersPromise: Promise<BridgeParsers> | null = null;

/** Loads bridge parsers. */
const loadBridgeParsers = (): Promise<BridgeParsers> => {
  bridgeParsersPromise ??= import("@qwordly/core/bridge");
  return bridgeParsersPromise;
};

/** Describes host message handlers. */
export type HostMessageHandlers = {
  /** Reads y. */
  ready(message: Extract<GameToHostMessage, {type: "game:ready"}>): void | Promise<void>;
  /** Provides resize behavior. */
  resize(message: Extract<GameToHostMessage, {type: "game:resize"}>): void | Promise<void>;
  /** Loads riddle. */
  loadRiddle(message: Extract<GameToHostMessage, {type: "game:loadRiddle"}>): void | Promise<void>;
  /** Submits one authoritative single-player guess. */
  submitGuess(message: Extract<GameToHostMessage, {type: "game:submitGuess"}>): void | Promise<void>;
  /** Completes game. */
  completeGame(message: Extract<GameToHostMessage, {type: "game:completeGame"}>): void | Promise<void>;
  /** Requests hint. */
  requestHint(message: Extract<GameToHostMessage, {type: "game:requestHint"}>): void | Promise<void>;
  /** Provides spend coins behavior. */
  spendCoins(message: Extract<GameToHostMessage, {type: "game:spendCoins"}>): void | Promise<void>;
  /** Skips one authoritative Classic riddle. */
  skipRiddle(message: Extract<GameToHostMessage, {type: "game:skipRiddle"}>): void | Promise<void>;
  /** Requests purchase. */
  requestPurchase(message: Extract<GameToHostMessage, {type: "game:requestPurchase"}>): void | Promise<void>;
  /** Loads leaderboard. */
  loadLeaderboard(message: Extract<GameToHostMessage, {type: "game:loadLeaderboard"}>): void | Promise<void>;
  /** Updates username. */
  updateUsername(message: Extract<GameToHostMessage, {type: "game:updateUsername"}>): void | Promise<void>;
  /** Updates avatar. */
  updateAvatar(message: Extract<GameToHostMessage, {type: "game:updateAvatar"}>): void | Promise<void>;
  /** Deletes account. */
  deleteAccount(message: Extract<GameToHostMessage, {type: "game:deleteAccount"}>): void | Promise<void>;
  /** Lists race categories. */
  listRaceCategories(message: Extract<GameToHostMessage, {type: "game:listRaceCategories"}>): void | Promise<void>;
  /** Starts race. */
  startRace(message: Extract<GameToHostMessage, {type: "game:startRace"}>): void | Promise<void>;
  /** Submits race guess. */
  submitRaceGuess(message: Extract<GameToHostMessage, {type: "game:submitRaceGuess"}>): void | Promise<void>;
  /** Requests race hint. */
  requestRaceHint(message: Extract<GameToHostMessage, {type: "game:requestRaceHint"}>): void | Promise<void>;
  /** Provides skip race riddle behavior. */
  skipRaceRiddle(message: Extract<GameToHostMessage, {type: "game:skipRaceRiddle"}>): void | Promise<void>;
  /** Provides resume race behavior. */
  resumeRace(message: Extract<GameToHostMessage, {type: "game:resumeRace"}>): void | Promise<void>;
  /** Provides abandon race behavior. */
  abandonRace(message: Extract<GameToHostMessage, {type: "game:abandonRace"}>): void | Promise<void>;
  /** Publishes race. */
  publishRace(message: Extract<GameToHostMessage, {type: "game:publishRace"}>): void | Promise<void>;
  /** Gets race challenge. */
  getRaceChallenge(message: Extract<GameToHostMessage, {type: "game:getRaceChallenge"}>): void | Promise<void>;
  /** Gets race outcome. */
  getRaceOutcome(message: Extract<GameToHostMessage, {type: "game:getRaceOutcome"}>): void | Promise<void>;
  /** Lists race inbox. */
  listRaceInbox(message: Extract<GameToHostMessage, {type: "game:listRaceInbox"}>): void | Promise<void>;
  /** Blocks one server-established rival. */
  blockRival(message: Extract<GameToHostMessage, {type: "game:blockRival"}>): void | Promise<void>;
  /** Reports one server-established rival. */
  reportRival(message: Extract<GameToHostMessage, {type: "game:reportRival"}>): void | Promise<void>;
  /** Provides analytics behavior. */
  analytics(message: Extract<GameToHostMessage, {type: "game:analytics"}>): void | Promise<void>;
  /** Provides error behavior. */
  error(message: Extract<GameToHostMessage, {type: "game:error"}>): void | Promise<void>;
};

/** Creates host message router. */
export const createHostMessageRouter = (handlers: HostMessageHandlers) => {
  return async (value: unknown): Promise<GameToHostMessage> => {
    const {parseGameToHostMessage} = await loadBridgeParsers();
    const message = parseGameToHostMessage(value);

    switch (message.type) {
      case "game:ready":
        await handlers.ready(message);
        break;
      case "game:resize":
        await handlers.resize(message);
        break;
      case "game:loadRiddle":
        await handlers.loadRiddle(message);
        break;
      case "game:submitGuess":
        await handlers.submitGuess(message);
        break;
      case "game:completeGame":
        await handlers.completeGame(message);
        break;
      case "game:requestHint":
        await handlers.requestHint(message);
        break;
      case "game:spendCoins":
        await handlers.spendCoins(message);
        break;
      case "game:skipRiddle":
        await handlers.skipRiddle(message);
        break;
      case "game:requestPurchase":
        await handlers.requestPurchase(message);
        break;
      case "game:loadLeaderboard":
        await handlers.loadLeaderboard(message);
        break;
      case "game:updateUsername":
        await handlers.updateUsername(message);
        break;
      case "game:updateAvatar":
        await handlers.updateAvatar(message);
        break;
      case "game:deleteAccount":
        await handlers.deleteAccount(message);
        break;
      case "game:listRaceCategories":
        await handlers.listRaceCategories(message);
        break;
      case "game:startRace":
        await handlers.startRace(message);
        break;
      case "game:submitRaceGuess":
        await handlers.submitRaceGuess(message);
        break;
      case "game:requestRaceHint":
        await handlers.requestRaceHint(message);
        break;
      case "game:skipRaceRiddle":
        await handlers.skipRaceRiddle(message);
        break;
      case "game:resumeRace":
        await handlers.resumeRace(message);
        break;
      case "game:abandonRace":
        await handlers.abandonRace(message);
        break;
      case "game:publishRace":
        await handlers.publishRace(message);
        break;
      case "game:getRaceChallenge":
        await handlers.getRaceChallenge(message);
        break;
      case "game:getRaceOutcome":
        await handlers.getRaceOutcome(message);
        break;
      case "game:listRaceInbox":
        await handlers.listRaceInbox(message);
        break;
      case "game:blockRival":
        await handlers.blockRival(message);
        break;
      case "game:reportRival":
        await handlers.reportRival(message);
        break;
      case "game:analytics":
        await handlers.analytics(message);
        break;
      case "game:error":
        await handlers.error(message);
        break;
      default:
        message satisfies never;
    }

    return message;
  };
};

/** Describes game message handlers. */
export type GameMessageHandlers = {
  /** Provides init behavior. */
  init(message: Extract<HostToGameMessage, {type: "host:init"}>): void | Promise<void>;
  /** Provides auth state behavior. */
  authState(message: Extract<HostToGameMessage, {type: "host:authState"}>): void | Promise<void>;
  /** Provides riddle loaded behavior. */
  riddleLoaded(message: Extract<HostToGameMessage, {type: "host:riddleLoaded"}>): void | Promise<void>;
  /** Provides operation result behavior. */
  operationResult(message: Extract<HostToGameMessage, {type: "host:operationResult"}>): void | Promise<void>;
  /** Provides pause behavior. */
  pause(message: Extract<HostToGameMessage, {type: "host:pause"}>): void | Promise<void>;
  /** Provides resume behavior. */
  resume(message: Extract<HostToGameMessage, {type: "host:resume"}>): void | Promise<void>;
};

/** Creates game message router. */
export const createGameMessageRouter = (handlers: GameMessageHandlers) => {
  return async (value: unknown): Promise<HostToGameMessage> => {
    const {parseHostToGameMessage} = await loadBridgeParsers();
    const message = parseHostToGameMessage(value);

    switch (message.type) {
      case "host:init":
        await handlers.init(message);
        break;
      case "host:authState":
        await handlers.authState(message);
        break;
      case "host:riddleLoaded":
        await handlers.riddleLoaded(message);
        break;
      case "host:operationResult":
        await handlers.operationResult(message);
        break;
      case "host:pause":
        await handlers.pause(message);
        break;
      case "host:resume":
        await handlers.resume(message);
        break;
      default:
        message satisfies never;
    }

    return message;
  };
};
