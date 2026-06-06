import { MODAL_REGISTRY_TYPES } from "../../components/modals/modalTypes";
import {
  QA_MODAL_SURFACE_TO_REGISTRY_TYPE,
  QA_MODAL_SURFACES,
  QA_MODAL_VARIANT_SURFACES,
  QA_PAGE_SURFACES,
  QA_POPUP_SURFACES,
  QA_REGISTRY_MODAL_SURFACES,
  QA_STANDALONE_MODAL_SURFACES,
  QA_SURFACES,
  extractQASurfaceIdFromUrl,
} from "../qaSurfaces";

describe("QA Android screenshot surfaces", () => {
  it("keeps every app page in the screenshot inventory", () => {
    expect(QA_PAGE_SURFACES.map((surface) => surface.id)).toEqual([
      "page-app-loading",
      "page-landing",
      "page-riddle-loading",
      "page-initialization-error",
      "page-game",
    ]);
  });

  it("includes every registered modal plus standalone modal surfaces", () => {
    const registeredModalTypes = new Set(MODAL_REGISTRY_TYPES);
    const mappedRegistryModalTypes = new Set(
      QA_REGISTRY_MODAL_SURFACES.map(
        (surface) =>
          QA_MODAL_SURFACE_TO_REGISTRY_TYPE[
            surface.id as keyof typeof QA_MODAL_SURFACE_TO_REGISTRY_TYPE
          ]
      )
    );

    expect(mappedRegistryModalTypes).toEqual(registeredModalTypes);
    expect(QA_MODAL_SURFACES.map((surface) => surface.id)).toEqual(
      expect.arrayContaining([
        ...QA_REGISTRY_MODAL_SURFACES.map((surface) => surface.id),
        ...QA_STANDALONE_MODAL_SURFACES.map((surface) => surface.id),
      ])
    );
  });

  it("captures important modal state variants that are easy to miss", () => {
    expect(QA_MODAL_VARIANT_SURFACES.map((surface) => surface.id)).toEqual(
      expect.arrayContaining([
        "modal-welcome-onboarding-progress",
        "modal-info-onboarding-upgrade-action",
        "modal-hint-insufficient-coins",
        "modal-skip-insufficient-coins",
        "modal-loss-no-continue-options",
        "modal-loss-coin-continue",
        "modal-coin-shop-loading",
        "modal-coin-shop-error",
        "modal-coin-shop-empty",
        "modal-victory-sequence",
        "modal-settings-language-picker",
        "modal-upgrade-account-existing-account",
      ])
    );
  });

  it("captures non-modal popups and overlays", () => {
    expect(QA_POPUP_SURFACES.map((surface) => surface.id)).toEqual([
      "popup-tooltip-submit-answer",
      "popup-global-mute-overlay",
    ]);
  });

  it("does not duplicate screenshot surface ids", () => {
    const ids = QA_SURFACES.map((surface) => surface.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("extracts QA surface ids from supported launch urls", () => {
    expect(extractQASurfaceIdFromUrl("exp+riddle-quest://qa/page-game")).toBe("page-game");
    expect(extractQASurfaceIdFromUrl("exp+riddle-quest://expo-development-client/?surface=page-game")).toBe(
      "page-game",
    );
    expect(extractQASurfaceIdFromUrl("exp+riddle-quest://qa/popup-tooltip-submit-answer")).toBe(
      "popup-tooltip-submit-answer",
    );
    expect(extractQASurfaceIdFromUrl("exp+riddle-quest://not-qa/page-game")).toBe(null);
    expect(extractQASurfaceIdFromUrl(null)).toBe(null);
  });
});
