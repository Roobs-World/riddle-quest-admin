import type {ModalData, ModalOptions} from "../../types/ModalTypes";

export type ModalCommand =
  | {type: "info"; title: string; message: string; actionButtonText?: string; onAction?: () => void}
  | {type: "offline"; title?: string; message?: string}
  | {type: "open"; modalType: string; data?: ModalData; options?: ModalOptions};

export type OpenModalFn = <T extends ModalData>(type: string, data?: T, options?: ModalOptions) => string;

/**
 * Routes high-level modal intents through the modal registry keys.
 */
export class ModalCommandBus {
  constructor(private readonly openModal: OpenModalFn) {}

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
      default: {
        const exhaustive: never = command;
        return exhaustive;
      }
    }
  }
}

export function createModalCommandBus(openModal: OpenModalFn): ModalCommandBus {
  return new ModalCommandBus(openModal);
}
