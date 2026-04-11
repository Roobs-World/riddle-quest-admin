import { createGameModalActions } from "../gameModalActions";

describe("createGameModalActions", () => {
  const createModalMock = () => ({
    showInfoModal: jest.fn(),
  });

  it("shows spend coins error modal", () => {
    const modal = createModalMock() as any;
    const actions = createGameModalActions(modal);

    actions.showSpendCoinsError();

    expect(modal.showInfoModal).toHaveBeenCalledWith({
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

    expect(modal.showInfoModal).toHaveBeenNthCalledWith(1, {
      title: "No Products Available",
      message: "Please try again later.",
    });
    expect(modal.showInfoModal).toHaveBeenNthCalledWith(2, {
      title: "Ad Not Ready",
      message:
        "The rewarded ad couldn't be loaded at this time. Please try again later.",
    });
    expect(modal.showInfoModal).toHaveBeenNthCalledWith(3, {
      title: "Ad Error",
      message: "An error occurred while trying to show the rewarded ad.",
    });
  });
});
