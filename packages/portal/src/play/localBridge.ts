export const GAME_TO_HOST_EVENT = "riddle-quest:game-to-host";
export const HOST_TO_GAME_EVENT = "riddle-quest:host-to-game";

export const dispatchLocalBridge = (eventName: string, detail: unknown) =>
  window.dispatchEvent(new CustomEvent(eventName, {detail}));
