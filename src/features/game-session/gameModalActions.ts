/**
 * @fileoverview Centralized modal action creators used by game-session flows.
 */
import useModal from "../../hooks/useModal";
import {t} from "../../i18n";
import {createModalCommandBus} from "../../application/modals/ModalCommandBus";

/**
 * Action creators for common modal scenarios in gameplay orchestration.
 */
interface GameModalActionSet {
  /** Shows generic failure messaging for coin spend attempts. */
  showSpendCoinsError: () => void;
  /** Shows fallback when shop product data is unavailable. */
  showNoProductsAvailable: () => void;
  /** Shows fallback when rewarded ad inventory is not ready. */
  showAdNotReady: () => void;
  /** Shows fallback when rewarded ad playback fails. */
  showAdError: () => void;
}

/**
 * Creates reusable, intent-based modal actions to keep gameplay orchestration
 * code free from repeated literal modal payloads.
 *
 * @param modal Modal API returned from `useModal`.
 * @returns A set of convenience actions for common game modal scenarios.
 */
export const createGameModalActions = (modal: ReturnType<typeof useModal>): GameModalActionSet => {
  const commandBus = createModalCommandBus(modal.openModal);

  return {
    showSpendCoinsError: () =>
      commandBus.dispatch({
        type: "info",
        title: t("CommonAlerts.ERROR_TITLE"),
        message: t("GameScreenAlerts.SPEND_COINS_ERROR_MESSAGE"),
      }),

    showNoProductsAvailable: () =>
      commandBus.dispatch({
        type: "info",
        title: t("GameScreenAlerts.NO_PRODUCTS_AVAILABLE_TITLE"),
        message: t("CommonAlerts.TRY_AGAIN_LATER_MESSAGE"),
      }),

    showAdNotReady: () =>
      commandBus.dispatch({
        type: "info",
        title: t("GameScreenAlerts.AD_NOT_READY_TITLE"),
        message: t("CommonAlerts.TRY_AGAIN_LATER_MESSAGE"),
      }),

    showAdError: () =>
      commandBus.dispatch({
        type: "info",
        title: t("GameScreenAlerts.AD_ERROR_TITLE"),
        message: t("GameScreenAlerts.AD_ERROR_MESSAGE"),
      }),
  };
};
