import {VictoryModal, LossModal, HintModal, SkipModal} from "../modals";

/**
 * Re-exported gameplay overlays so `GameScreen` and related modules can import
 * modal primitives from a single game-focused entry point.
 */
const GAME_OVERLAYS = {
  VictoryModal,
  LossModal,
  HintModal,
  SkipModal,
} as const;

export const {
  VictoryModal: GameVictoryModal,
  LossModal: GameLossModal,
  HintModal: GameHintModal,
  SkipModal: GameSkipModal,
} = GAME_OVERLAYS;

export {VictoryModal, LossModal, HintModal, SkipModal};
