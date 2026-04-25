/**
 * @fileoverview ModalProvider component - runtime modal renderer for Riddle Quest.
 *
 * This provider now delegates all modal component resolution and prop mapping
 * to `ModalRegistry`, making the registry the single source of truth.
 */
import React from "react";
import { useModalContext } from "../../contexts/ModalContext";
import { getModalComponent } from "./ModalRegistry";
import { logger } from "../../utils/logger";
import { ModalInstance } from "../../types/ModalTypes";

interface RenderedModalProps {
  modal: ModalInstance;
  closeModal: (id: string) => void;
}

const RenderedModal = React.memo(
  ({ modal, closeModal }: RenderedModalProps) => {
    const modalComponent = getModalComponent(modal.type);
    if (!modalComponent) {
      logger.warn(`Skipping unknown modal type "${modal.type}"`);
      return null;
    }

    return React.createElement(modalComponent, {
      isVisible: true,
      onClose: () => closeModal(modal.id),
      ...modal.data,
    });
  },
  (prevProps, nextProps) =>
    prevProps.modal === nextProps.modal &&
    prevProps.closeModal === nextProps.closeModal
);

RenderedModal.displayName = "RenderedModal";

export const ModalProvider: React.FC = () => {
  const { modals, closeModal } = useModalContext();

  return (
    <>
      {modals.map((modal) => {
        return <RenderedModal key={modal.id} modal={modal} closeModal={closeModal} />;
      })}
    </>
  );
};

export default ModalProvider;
