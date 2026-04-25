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

export const ModalProvider: React.FC = () => {
  const { modals, closeModal } = useModalContext();

  return (
    <>
      {modals.map((modal) => {
        const ModalComponent = getModalComponent(modal.type);
        if (!ModalComponent) {
          logger.warn(`Skipping unknown modal type "${modal.type}"`);
          return null;
        }
        return (
          <ModalComponent
            key={modal.id}
            isVisible={true}
            onClose={() => closeModal(modal.id)}
            {...modal.data}
          />
        );
      })}
    </>
  );
};

export default ModalProvider;
