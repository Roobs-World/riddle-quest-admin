/**
 * @fileoverview
 * Hook that shows the welcome modal on every app load.
 */
import {useEffect, useRef} from "react";
import {useModal} from "./useModal";

export const useFirstTimeExperience = () => {
  const modal = useModal();
  const modalRef = useRef(modal);

  useEffect(() => {
    modalRef.current.showWelcomeModal();
  }, []);
};
