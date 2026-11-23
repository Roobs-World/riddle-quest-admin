import {createYouTubeSdkPort} from "../sdk";
import {LEGACY_PLATFORM_RUNTIME_POLICY} from "../../../../../src/platform/contracts/capabilities";
import {YOUTUBE_RUNTIME_POLICY} from "../../../../../src/platform/contracts/localGamePolicy";
/** Creates sdk. */
const createSdk = () => {
  /** Provides callbacks behavior. */
  const callbacks = {
    audio: null as ((enabled: boolean) => void) | null,
    pause: null as (() => void) | null,
    resume: null as (() => void) | null,
  };
  /** Provides unsubscribe behavior. */
  const unsubscribe = jest.fn();
  /** Provides candidate behavior. */
  const candidate = {
    IN_PLAYABLES_ENV: true,
    game: {
      firstFrameReady: jest.fn(),
      gameReady: jest.fn(),
      loadData: jest.fn(async () => ""),
      saveData: jest.fn(async (_data: string) => undefined),
    },
    system: {
      getLanguage: jest.fn(async () => "es-419"),
      isAudioEnabled: jest.fn(() => true),
      onAudioEnabledChange: jest.fn((callback: (enabled: boolean) => void) => {
        callbacks.audio = callback;
        return unsubscribe;
      }),
      onPause: jest.fn((callback: () => void) => {
        callbacks.pause = callback;
        return unsubscribe;
      }),
      onResume: jest.fn((callback: () => void) => {
        callbacks.resume = callback;
        return unsubscribe;
      }),
    },
    health: {logError: jest.fn(), logWarning: jest.fn()},
  };
  return {candidate, callbacks, unsubscribe};
};

describe("createYouTubeSdkPort", () => {
  it("selects platform-owned runtime signals without changing the legacy target default", () => {
    expect(LEGACY_PLATFORM_RUNTIME_POLICY).toMatchObject({
      lifecycleSource: "browser",
      browserConnectivityRequired: true,
      platformOwnsMasterAudio: false,
      platformOwnsLocale: false,
      allowCommerce: true,
      preventEscapeDefault: true,
    });
    expect(YOUTUBE_RUNTIME_POLICY).toEqual({
      lifecycleSource: "platform",
      browserConnectivityRequired: false,
      platformOwnsMasterAudio: true,
      platformOwnsLocale: true,
      allowSharingPrompts: false,
      allowAccountManagement: false,
      allowCommerce: false,
      allowExternalNavigation: false,
      allowMultiplayer: false,
      preventEscapeDefault: false,
    });
  });

  it("fails closed when a required SDK namespace is absent", () => {
    expect(() => createYouTubeSdkPort({IN_PLAYABLES_ENV: true})).toThrow("youtube-sdk-unavailable");
  });

  it("requires first-frame readiness and emits each readiness signal once", () => {
    /** Provides {candidate} behavior. */
    const {candidate} = createSdk();
    /** Provides port behavior. */
    const port = createYouTubeSdkPort(candidate);
    expect(() => port.gameReady()).toThrow("youtube-first-frame-required");
    port.firstFrameReady();
    port.firstFrameReady();
    port.gameReady();
    port.gameReady();
    expect(candidate.game.firstFrameReady).toHaveBeenCalledTimes(1);
    expect(candidate.game.gameReady).toHaveBeenCalledTimes(1);
  });

  it("delegates Cloud Save, locale, audio, and lifecycle without exposing ads or engagement", async () => {
    /** Provides {candidate, callbacks, unsubscribe} behavior. */
    const {candidate, callbacks, unsubscribe} = createSdk();
    /** Provides port behavior. */
    const port = createYouTubeSdkPort(candidate);
    expect(await port.loadData()).toBe("");
    await port.saveData("save");
    expect(await port.getLanguage()).toBe("es-419");
    expect(port.isAudioEnabled()).toBe(true);
    /** Provides audio behavior. */
    const audio = jest.fn();
    /** Provides pause behavior. */
    const pause = jest.fn();
    /** Provides resume behavior. */
    const resume = jest.fn();
    expect(port.onAudioEnabledChange(audio)).toBe(unsubscribe);
    expect(port.onPause(pause)).toBe(unsubscribe);
    expect(port.onResume(resume)).toBe(unsubscribe);
    callbacks.audio?.(false);
    callbacks.pause?.();
    callbacks.resume?.();
    expect(audio).toHaveBeenCalledWith(false);
    expect(pause).toHaveBeenCalledTimes(1);
    expect(resume).toHaveBeenCalledTimes(1);
    expect(candidate.game.saveData).toHaveBeenCalledWith("save");
    expect(port).not.toHaveProperty("ads");
    expect(port).not.toHaveProperty("engagement");
  });
});
