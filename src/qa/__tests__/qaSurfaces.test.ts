import { MODAL_REGISTRY_TYPES } from "../../components/modals/modalTypes";
import {
  QA_MODAL_SURFACE_TO_REGISTRY_TYPE,
  QA_MODAL_SURFACES,
  QA_PAGE_SURFACES,
  QA_SURFACES,
} from "../qaSurfaces";

describe("QA Android screenshot surfaces", () => {
  it("keeps every app page in the screenshot inventory", () => {
    expect(QA_PAGE_SURFACES.map((surface) => surface.id)).toEqual([
      "page-app-loading",
      "page-landing",
      "page-login",
      "page-sign-up",
      "page-forgot-password",
      "page-new-password",
      "page-riddle-loading",
      "page-initialization-error",
      "page-game",
    ]);
  });

  it("includes every registered modal plus the two standalone modals", () => {
    const registeredModalTypes = [...MODAL_REGISTRY_TYPES].sort();
    const mappedModalTypes = Object.values(QA_MODAL_SURFACE_TO_REGISTRY_TYPE).sort();

    expect(mappedModalTypes).toEqual(registeredModalTypes);
    expect(QA_MODAL_SURFACES.map((surface) => surface.id)).toEqual(
      expect.arrayContaining([
        ...Object.keys(QA_MODAL_SURFACE_TO_REGISTRY_TYPE),
        "modal-delete-account-confirmation",
        "modal-offline-blocking",
      ])
    );
  });

  it("does not duplicate screenshot surface ids", () => {
    const ids = QA_SURFACES.map((surface) => surface.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
