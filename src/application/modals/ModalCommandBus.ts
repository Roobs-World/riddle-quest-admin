import type {GameModalTypes, ModalData, ModalDataType, ModalOptions} from "../../types/ModalTypes";

/**
 * Typed command variant for game-modal registry entries.
 */
export type GameModalCommandFor<TModalType extends keyof GameModalTypes> = {
  type: "game";
  modalType: TModalType;
  data: ModalDataType<TModalType>;
  options?: ModalOptions;
};

/**
 * Union of all typed game-modal command variants.
 */
export type GameModalCommand = {
  [TModalType in keyof GameModalTypes]: GameModalCommandFor<TModalType>;
}[keyof GameModalTypes];

/**
 * High-level command object understood by {@link ModalCommandBus}.
 */
export type ModalCommand =
  | {type: "info"; title: string; message: string; actionButtonText?: string; onAction?: () => void}
  | {type: "offline"; title?: string; message?: string}
  | {type: "open"; modalType: string; data?: ModalData; options?: ModalOptions}
  | GameModalCommand;

export type OpenModalFn = <T extends ModalData>(type: string, data?: T, options?: ModalOptions) => string;

/**
 * Routes high-level modal intents through the modal registry keys.
 *
 * @remarks
 * Pattern: Command. Gameplay and application orchestration dispatch named
 * modal intents instead of depending on registry string literals and payload
 * mapping at every call site.
 *
 * Boundary: application layer. The bus knows modal registry keys and payloads,
 * but it does not import React components or mutate modal context state.
 *
 * Invariants:
 * - Each dispatch opens at most one modal.
 * - Offline UX is normalized to the shared `info` modal until the blocking
 *   offline surface is fully migrated behind the registry.
 */
export class ModalCommandBus {
  constructor(private readonly openModal: OpenModalFn) {}

  /**
   * Opens the modal represented by a command and returns the created modal id.
   */
  dispatch(command: ModalCommand): string {
    switch (command.type) {
      case "info":
        return this.openModal("info", {
          title: command.title,
          message: command.message,
          actionButtonText: command.actionButtonText,
          onAction: command.onAction,
        });
      case "offline":
        return this.openModal("info", {
          title: command.title ?? "No Internet Connection",
          message: command.message ?? "Please check your connection and try again.",
        });
      case "open":
        return this.openModal(command.modalType, command.data, command.options);
      case "game":
        return this.openModal(command.modalType, command.data, command.options);
      default: {
        const exhaustive: never = command;
        return exhaustive;
      }
    }
  }
}

/**
 * Creates a command bus adapter around the raw modal-context open function.
 */
export function createModalCommandBus(openModal: OpenModalFn): ModalCommandBus {
  return new ModalCommandBus(openModal);
}

/**
 * Factory helpers for building modal commands without spreading registry keys
 * through feature code.
 *
 * @remarks
 * Pattern: Factory Method. Callers choose an intent and provide the data,
 * while the factory owns the command shape consumed by {@link ModalCommandBus}.
 */
export const modalCommands = {
  info: (title: string, message: string, actionButtonText?: string, onAction?: () => void): ModalCommand => ({
    type: "info",
    title,
    message,
    actionButtonText,
    onAction,
  }),

  offline: (title?: string, message?: string): ModalCommand => ({
    type: "offline",
    title,
    message,
  }),

  open: (modalType: string, data?: ModalData, options?: ModalOptions): ModalCommand => ({
    type: "open",
    modalType,
    data,
    options,
  }),

  game: <TModalType extends keyof GameModalTypes>(
    modalType: TModalType,
    data: ModalDataType<TModalType>,
    options?: ModalOptions,
  ): GameModalCommandFor<TModalType> => ({
    type: "game",
    modalType,
    data,
    options,
  }),
};
