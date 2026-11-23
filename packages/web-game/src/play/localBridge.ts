/** Defines the game to host event value. */
export const GAME_TO_HOST_EVENT = "riddle-quest:game-to-host";
/** Defines the host to game event value. */
export const HOST_TO_GAME_EVENT = "riddle-quest:host-to-game";

/** Provides dispatch local bridge behavior. */
export const dispatchLocalBridge = (eventName: string, detail: unknown) =>
  window.dispatchEvent(new CustomEvent(eventName, {detail}));
