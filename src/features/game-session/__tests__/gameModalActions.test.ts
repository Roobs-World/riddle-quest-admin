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

    expect(modal.openModal).toHaveBeenNthCalledWith(1, "info", {
      title: "No Products Available",
      message: "Please try again later.",
    });
    expect(modal.openModal).toHaveBeenNthCalledWith(2, "info", {
      title: "Ad Not Ready",
      message: "The rewarded ad couldn't be loaded at this time. Please try again later.",
    });
    expect(modal.openModal).toHaveBeenNthCalledWith(3, "info", {
      title: "Ad Error",
      message: "An error occurred while trying to show the rewarded ad.",
    });
  });
});
