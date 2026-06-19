import {createGameModalActions} from "../gameModalActions";

describe("createGameModalActions", () => {
  const createModalMock = () => ({
    openModal: jest.fn(() => "modal-id"),
  });

  it("shows spend coins error modal", () => {
    const modal = createModalMock() as any;
    const actions = createGameModalActions(modal);

    actions.showSpendCoinsError();

    expect(modal.openModal).toHaveBeenCalledWith("info", {
      title: "Error",
      message: "Could not spend coins. Please try again.",
    });
  });

  it("shows ad and product informational modals", () => {
    const modal = createModalMock() as any;
    const actions = createGameModalActions(modal);

    actions.showNoProductsAvailable();
    actions.showAdNotReady();
    actions.showAdError();

    expect(modal.openModal).toHaveBeenNthCalledWith(
      1,
      "info",
      expect.objectContaining({
        title: "No Products Available",
        message: "Please try again later.",
      }),
    );
    expect(modal.openModal).toHaveBeenNthCalledWith(
      2,
      "info",
      expect.objectContaining({
        title: "Ad Not Ready",
        message: "Please try again later.",
      }),
    );
    expect(modal.openModal).toHaveBeenNthCalledWith(
      3,
      "info",
      expect.objectContaining({
        title: "Ad Error",
        message: "An error occurred while trying to show the rewarded ad.",
      }),
    );
  });
});
