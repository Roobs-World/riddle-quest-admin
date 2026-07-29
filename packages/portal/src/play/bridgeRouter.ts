import type {GameToHostMessage, HostToGameMessage} from "@qwordly/core/bridge";

type BridgeParsers = Pick<
  typeof import("@qwordly/core/bridge"),
  "parseGameToHostMessage" | "parseHostToGameMessage"
>;

let bridgeParsersPromise: Promise<BridgeParsers> | null = null;

const loadBridgeParsers = (): Promise<BridgeParsers> => {
  bridgeParsersPromise ??= import("@qwordly/core/bridge");
  return bridgeParsersPromise;
};

export type HostMessageHandlers = {
  ready(message: Extract<GameToHostMessage, {type: "game:ready"}>): void | Promise<void>;
  resize(message: Extract<GameToHostMessage, {type: "game:resize"}>): void | Promise<void>;
  loadRiddle(message: Extract<GameToHostMessage, {type: "game:loadRiddle"}>): void | Promise<void>;
  completeGame(message: Extract<GameToHostMessage, {type: "game:completeGame"}>): void | Promise<void>;
  requestHint(message: Extract<GameToHostMessage, {type: "game:requestHint"}>): void | Promise<void>;
  spendCoins(message: Extract<GameToHostMessage, {type: "game:spendCoins"}>): void | Promise<void>;
  requestPurchase(message: Extract<GameToHostMessage, {type: "game:requestPurchase"}>): void | Promise<void>;
  loadLeaderboard(message: Extract<GameToHostMessage, {type: "game:loadLeaderboard"}>): void | Promise<void>;
  updateUsername(message: Extract<GameToHostMessage, {type: "game:updateUsername"}>): void | Promise<void>;
  analytics(message: Extract<GameToHostMessage, {type: "game:analytics"}>): void | Promise<void>;
  error(message: Extract<GameToHostMessage, {type: "game:error"}>): void | Promise<void>;
};

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
      case "game:completeGame":
        await handlers.completeGame(message);
        break;
      case "game:requestHint":
        await handlers.requestHint(message);
        break;
      case "game:spendCoins":
        await handlers.spendCoins(message);
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

export type GameMessageHandlers = {
  init(message: Extract<HostToGameMessage, {type: "host:init"}>): void;
  authState(message: Extract<HostToGameMessage, {type: "host:authState"}>): void;
  riddleLoaded(message: Extract<HostToGameMessage, {type: "host:riddleLoaded"}>): void;
  operationResult(message: Extract<HostToGameMessage, {type: "host:operationResult"}>): void;
  pause(message: Extract<HostToGameMessage, {type: "host:pause"}>): void;
  resume(message: Extract<HostToGameMessage, {type: "host:resume"}>): void;
};

export const createGameMessageRouter = (handlers: GameMessageHandlers) => {
  return async (value: unknown): Promise<HostToGameMessage> => {
    const {parseHostToGameMessage} = await loadBridgeParsers();
    const message = parseHostToGameMessage(value);

    switch (message.type) {
      case "host:init":
        handlers.init(message);
        break;
      case "host:authState":
        handlers.authState(message);
        break;
      case "host:riddleLoaded":
        handlers.riddleLoaded(message);
        break;
      case "host:operationResult":
        handlers.operationResult(message);
        break;
      case "host:pause":
        handlers.pause(message);
        break;
      case "host:resume":
        handlers.resume(message);
        break;
      default:
        message satisfies never;
    }

    return message;
  };
};
