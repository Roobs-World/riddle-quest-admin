import {ModalCommandBus, modalCommands} from "../ModalCommandBus";

describe("ModalCommandBus", () => {
  it("dispatches info commands through openModal", () => {
    const openModal = jest.fn(() => "modal-1");
    const bus = new ModalCommandBus(openModal);

    bus.dispatch({type: "info", title: "Error", message: "Failed"});

    expect(openModal).toHaveBeenCalledWith("info", expect.objectContaining({title: "Error", message: "Failed"}));
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

  it("dispatches typed game modal commands through the registry key", () => {
    const openModal = jest.fn(() => "modal-3");
    const bus = new ModalCommandBus(openModal);
    const onNext = jest.fn();

    bus.dispatch(
      modalCommands.game("victory", {
        attempts: 2,
        coinsEarned: 50,
        guesses: [],
        onNext,
      }),
    );

    expect(openModal).toHaveBeenCalledWith(
      "victory",
      {
        attempts: 2,
        coinsEarned: 50,
        guesses: [],
        onNext,
      },
      undefined,
    );
  });
});
