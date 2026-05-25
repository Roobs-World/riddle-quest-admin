import {renderHook, act} from "@testing-library/react-native";
import {useGameSessionController} from "../useGameSessionController";

describe("useGameSessionController", () => {
  it("tracks loading state while async work runs", async () => {
    let resolveWork: (() => void) | undefined;
    const workPromise = new Promise<void>((resolve) => {
      resolveWork = resolve;
    });

    const {result} = renderHook(() => useGameSessionController());

    let runnerPromise: Promise<void> | undefined;
    await act(async () => {
      runnerPromise = result.current.runWithServerLoading(() => workPromise);
    });

    expect(result.current.isLoading).toBe(true);

    await act(async () => {
      resolveWork?.();
      await runnerPromise;
    });

    expect(result.current.isLoading).toBe(false);
  });

  it("resets loading state when work throws", async () => {
    const {result} = renderHook(() => useGameSessionController());

    await expect(
      act(async () => {
        await result.current.runWithServerLoading(() => {
          throw new Error("boom");
        });
      }),
    ).rejects.toThrow("boom");

    expect(result.current.isLoading).toBe(false);
  });
});
