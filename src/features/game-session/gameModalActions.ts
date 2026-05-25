/**
 * @fileoverview Centralized modal action creators used by game-session flows.
 */
import useModal from "../../hooks/useModal";

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
 * Strongly-typed modal action bundle used by gameplay orchestrators.
 */
export type GameModalActions = ReturnType<typeof createGameModalActions>;

/**
 * Creates reusable, intent-based modal actions to keep gameplay orchestration
 * code free from repeated literal modal payloads.
 *
 * @param modal Modal API returned from `useModal`.
 * @returns A set of convenience actions for common game modal scenarios.
 */
export const createGameModalActions = (modal: ReturnType<typeof useModal>): GameModalActionSet => ({
  showSpendCoinsError: () =>
    modal.showInfoModal({
      title: "Error",
      message: "Could not spend coins. Please try again.",
    }),

  showNoProductsAvailable: () =>
    modal.showInfoModal({
      title: "No Products Available",
      message: "Please try again later.",
    }),

  showAdNotReady: () =>
    modal.showInfoModal({
      title: "Ad Not Ready",
      message: "The rewarded ad couldn't be loaded at this time. Please try again later.",
    }),

  showAdError: () =>
    modal.showInfoModal({
      title: "Ad Error",
      message: "An error occurred while trying to show the rewarded ad.",
    }),
});

export default createGameModalActions;
