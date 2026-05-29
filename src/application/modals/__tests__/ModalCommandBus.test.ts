import {ModalCommandBus} from "../ModalCommandBus";

describe("ModalCommandBus", () => {
  it("dispatches info commands through openModal", () => {
    const openModal = jest.fn(() => "modal-1");
    const bus = new ModalCommandBus(openModal);

    bus.dispatch({type: "info", title: "Error", message: "Failed"});

    expect(openModal).toHaveBeenCalledWith("info", {title: "Error", message: "Failed"});
  });

  it("dispatches offline commands with defaults", () => {
    const openModal = jest.fn(() => "modal-2");
    const bus = new ModalCommandBus(openModal);

    bus.dispatch({type: "offline"});

    expect(openModal).toHaveBeenCalledWith("info", {
      title: "No Internet Connection",
      message: "Please check your connection and try again.",
    });
  });
});
