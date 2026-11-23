import {useCallback, useEffect, useRef, useState} from "react";
import {resolveYouTubeLocale, type YouTubeContentSource} from "../../../content/catalog/bundledContent";
import {LocalSoloAuthority, YouTubeAuthorityRestoreSaveError} from "../LocalSoloAuthority";
import {cloneYouTubeSave, createEmptyYouTubeSave, parseYouTubeSave} from "../../persistence/localSave";
import type {YouTubeContent, YouTubeLocale, YouTubeSaveV1, YouTubeSdkPort} from "../types";
import {YouTubeSaveGate} from "../../persistence/YouTubeSaveGate";
/** Runtime prepared after save and locale initialization. */
export type YouTubeRuntime = Readonly<{
  /** Active locale. */
  locale: YouTubeLocale;
  /** Locale-aligned bundled content. */
  content: YouTubeContent;
  /** Platform-local gameplay authority. */
  authority: LocalSoloAuthority;
}>;
/** Invalid save awaiting explicit reset confirmation. */
type ResetState = Readonly<{
  /** Parse failure category. */
  kind: "invalid" | "future-version";
  /** Active locale. */
  locale: YouTubeLocale;
  /** Locale-aligned bundled content. */
  content: YouTubeContent;
  /** Original platform data. */
  raw: string;
}>;
/** Reset data retained after a save failure. */
type ResetFailure = Readonly<{
  /** Active locale. */
  locale: YouTubeLocale;
  /** Locale-aligned bundled content. */
  content: YouTubeContent;
  /** Fresh save awaiting persistence. */
  save: YouTubeSaveV1;
  /** Save gate retaining the failed write. */
  gate: YouTubeSaveGate;
}>;
/** Loaded save prepared for authority restoration. */
type PreparedLoadedSave = Readonly<{
  /** Validated save. */
  save: YouTubeSaveV1;
  /** Ordered save gate. */
  gate: YouTubeSaveGate;
  /** Whether an interrupted game was recovered. */
  recoveredActiveGame: boolean;
}>;
/** Result of restoring locale-specific runtime state. */
type PreparedRuntimeResult =
  | {
      /** Successful restoration. */
      kind: "ready";
      /** Prepared runtime. */
      runtime: YouTubeRuntime;
    }
  | {
      /** Authority restored while its repair write failed. */
      kind: "recovery-save-failed";
      /** Runtime retaining the failed write. */
      runtime: YouTubeRuntime;
    };
/** Complete state machine exposed to the boot view. */
export type YouTubeBootState =
  | {
      /** Startup is in progress. */
      kind: "loading";
    }
  | {
      /** Loading platform data failed. */
      kind: "load-failed";
    }
  | {
      /** A pre-locale write failed. */ kind: "pre-locale-save-failed";
      /** Prepared save. */ prepared: PreparedLoadedSave;
    }
  | {
      /** A recovery write failed. */
      kind: "recovery-save-failed";
      /** Retained runtime. */
      runtime: YouTubeRuntime;
    }
  | {
      /** Data requires reset. */ kind: "reset-required";
      /** Reset context. */ reset: ResetState;
      /** Confirmation state. */ confirming: boolean;
    }
  | {
      /** Reset persistence failed. */
      kind: "reset-save-failed";
      /** Retained reset. */
      reset: ResetFailure;
    }
  | {
      /** Runtime is ready. */
      kind: "ready";
      /** Prepared runtime. */
      runtime: YouTubeRuntime;
    };
/** Small interface consumed by the boot view. */
export type YouTubeBootController = Readonly<{
  /** Current boot state. */
  state: YouTubeBootState;
  /** Whether platform lifecycle paused interaction. */
  platformPaused: boolean;
  /** Retries the current failure. */
  retry: () => void;
  /** Changes destructive-reset confirmation. */
  setResetConfirmation: (confirming: boolean) => void;
  /** Replaces incompatible platform data after confirmation. */
  resetSave: () => void;
}>;
/** Host presentation callbacks invoked synchronously at the same lifecycle points on every platform. */
export type YouTubeBootPresentation = Readonly<{
  /** Applies platform pause state to the host surface. */
  onPausedChange?: (paused: boolean) => void;
  /** Applies the platform audio preference without resuming paused media. */
  onAudioChange?: (enabled: boolean) => void;
}>;
/** Frame scheduler shape shared by browsers and React Native without a DOM type dependency. */
type FrameScheduler = {
  /** Schedules a callback before the next paint. */
  requestAnimationFrame?: (callback: () => void) => number;
  /** Cancels a scheduled frame. */
  cancelAnimationFrame?: (id: number) => void;
};
/** Schedules startup after an initial paint opportunity. */
const requestNextFrame = (callback: () => void): number => {
  /** Host frame scheduler when one exists. */
  const scheduler = globalThis as FrameScheduler;
  if (typeof scheduler.requestAnimationFrame === "function") return scheduler.requestAnimationFrame(callback);
  callback();
  return 0;
};
/** Cancels a scheduled startup frame. */
const cancelNextFrame = (id: number): void => {
  /** Host frame scheduler when one exists. */
  const scheduler = globalThis as FrameScheduler;
  if (id && typeof scheduler.cancelAnimationFrame === "function") scheduler.cancelAnimationFrame(id);
};
/** Owns load, migration, recovery, and lifecycle ordering behind one interface. */
export function useYouTubePlayableBoot(
  sdk: YouTubeSdkPort,
  contentSource: YouTubeContentSource,
  presentation: YouTubeBootPresentation = {},
): YouTubeBootController {
  /** Current boot state. */
  const [state, setState] = useState<YouTubeBootState>({kind: "loading"});
  /** Explicit retry generation. */
  const [bootAttempt, setBootAttempt] = useState(0);
  /** Current platform pause state. */
  const [platformPaused, setPlatformPaused] = useState(false);
  /** Active gameplay authority. */
  const authorityRef = useRef<LocalSoloAuthority | null>(null);
  /** Pause state visible to asynchronous work. */
  const pausedRef = useRef(false);
  /** Operations awaiting platform resume. */
  const resumeWaitersRef = useRef(new Set<() => void>());
  /** Latest platform audio preference. */
  const pendingAudioRef = useRef(false);
  /** Latest host presentation; identity changes must not resubscribe platform lifecycle. */
  const presentationRef = useRef(presentation);

  useEffect(() => {
    presentationRef.current = presentation;
  });
  /** Suspends ordered work while the platform is paused. */
  const waitUntilActive = useCallback((): Promise<void> => {
    if (!pausedRef.current) return Promise.resolve();
    return new Promise((resolve) => resumeWaitersRef.current.add(resolve));
  }, []);
  /** Publishes a fully prepared runtime. */
  const finishBoot = useCallback((runtime: YouTubeRuntime) => {
    authorityRef.current = runtime.authority;
    if (pausedRef.current) runtime.authority.setPaused(true);
    setState({kind: "ready", runtime});
  }, []);
  /** Restores locale-specific authority from a validated save. */
  const resolvePreparedRuntime = useCallback(
    async (
      prepared: PreparedLoadedSave,
      cancelled: () => boolean = () => false,
    ): Promise<PreparedRuntimeResult | null> => {
      /** Platform language tag. */
      const languageTag = await sdk.getLanguage();
      await waitUntilActive();
      if (cancelled()) return null;
      /** Supported locale. */
      const locale = resolveYouTubeLocale(languageTag);
      /** Locale-aligned content. */
      const content = await contentSource.load(locale);
      await waitUntilActive();
      if (cancelled()) return null;
      /** Restored gameplay authority. */
      let authority: LocalSoloAuthority;
      try {
        authority = await LocalSoloAuthority.restore(
          prepared.save,
          content,
          prepared.gate,
          undefined,
          false,
          false,
          prepared.recoveredActiveGame,
        );
      } catch (error) {
        if (!(error instanceof YouTubeAuthorityRestoreSaveError)) throw error;
        return {kind: "recovery-save-failed", runtime: {locale, content, authority: error.authority}};
      }
      await waitUntilActive();
      return cancelled() ? null : {kind: "ready", runtime: {locale, content, authority}};
    },
    [contentSource, sdk, waitUntilActive],
  );
  /** Publishes a ready runtime or its retained recovery failure. */
  const applyPreparedRuntime = useCallback(
    (result: PreparedRuntimeResult): void => {
      if (result.kind === "ready") finishBoot(result.runtime);
      else setState(result);
    },
    [finishBoot],
  );

  useEffect(() => {
    /** Whether this boot attempt is no longer active. */
    let cancelled = false;
    /** Scheduled startup frame. */
    const frame = requestNextFrame(() => {
      void (async () => {
        try {
          await waitUntilActive();
          if (cancelled) return;
          sdk.firstFrameReady();
          /** Raw platform save. */
          const raw = await sdk.loadData();
          await waitUntilActive();
          if (cancelled) return;
          /** Validated platform save result. */
          const parsed = parseYouTubeSave(raw, contentSource.contentVersion);
          if (parsed.kind === "invalid" || parsed.kind === "future-version") {
            /** Platform language tag. */
            const languageTag = await sdk.getLanguage();
            await waitUntilActive();
            if (cancelled) return;
            /** Supported locale. */
            const locale = resolveYouTubeLocale(languageTag);
            /** Locale-aligned content. */
            const content = await contentSource.load(locale);
            await waitUntilActive();
            if (cancelled) return;
            setState({
              kind: "reset-required",
              reset: {kind: parsed.kind, locale, content, raw: parsed.raw},
              confirming: false,
            });
            return;
          }
          /** Ordered platform save gate. */
          const gate = new YouTubeSaveGate(sdk);
          /** Whether an interrupted game was repaired. */
          const recoveredActiveGame = parsed.kind === "valid" && parsed.recoveredActiveGame === true;
          /** Whether the loaded schema needs an immediate migration write. */
          const requiresMigrationSave = parsed.kind === "valid" && parsed.migratedFromSchemaVersion === 0;
          /** Validated save prepared for restoration. */
          let prepared: PreparedLoadedSave = {save: parsed.save, gate, recoveredActiveGame};
          if (recoveredActiveGame || requiresMigrationSave) {
            /** Migrated or repaired save. */
            const migrated = cloneYouTubeSave(parsed.save);
            migrated.revision += 1;
            gate.stage(migrated);
            prepared = {save: migrated, gate, recoveredActiveGame};
            try {
              await gate.commitStaged();
            } catch {
              await waitUntilActive();
              if (!cancelled) setState({kind: "pre-locale-save-failed", prepared});
              return;
            }
          }
          /** Runtime restoration result. */
          const result = await resolvePreparedRuntime(prepared, () => cancelled);
          if (result) applyPreparedRuntime(result);
        } catch {
          await waitUntilActive();
          if (!cancelled) {
            sdk.logError();
            setState({kind: "load-failed"});
          }
        }
      })();
    });
    return () => {
      cancelled = true;
      cancelNextFrame(frame);
    };
  }, [applyPreparedRuntime, bootAttempt, contentSource, resolvePreparedRuntime, sdk, waitUntilActive]);

  useEffect(() => {
    /** Applies audio state without resuming paused media. */
    const setAudio = (enabled: boolean): void => {
      pendingAudioRef.current = enabled;
      if (!pausedRef.current) presentationRef.current.onAudioChange?.(enabled);
    };
    setAudio(sdk.isAudioEnabled());
    /** Removes the audio listener. */
    const removeAudio = sdk.onAudioEnabledChange(setAudio);
    /** Removes the pause listener. */
    const removePause = sdk.onPause(() => {
      pausedRef.current = true;
      setPlatformPaused(true);
      presentationRef.current.onPausedChange?.(true);
      authorityRef.current?.setPaused(true);
    });
    /** Removes the resume listener. */
    const removeResume = sdk.onResume(() => {
      pausedRef.current = false;
      setPlatformPaused(false);
      presentationRef.current.onPausedChange?.(false);
      presentationRef.current.onAudioChange?.(pendingAudioRef.current);
      authorityRef.current?.setPaused(false);
      for (const resume of resumeWaitersRef.current) resume();
      resumeWaitersRef.current.clear();
    });
    return () => {
      removeAudio();
      removePause();
      removeResume();
      for (const resume of resumeWaitersRef.current) resume();
      resumeWaitersRef.current.clear();
      presentationRef.current.onPausedChange?.(false);
    };
  }, [sdk]);
  /** Retries the operation associated with the current failure. */
  const retry = useCallback((): void => {
    if (state.kind === "load-failed") {
      setState({kind: "loading"});
      setBootAttempt((attempt) => attempt + 1);
      return;
    }
    if (state.kind === "pre-locale-save-failed") {
      /** Prepared save retained by the failed operation. */
      const prepared = state.prepared;
      setState({kind: "loading"});
      void (async () => {
        try {
          await prepared.gate.retry();
          await waitUntilActive();
          /** Retried runtime restoration result. */
          const result = await resolvePreparedRuntime(prepared);
          await waitUntilActive();
          if (result) applyPreparedRuntime(result);
        } catch {
          await waitUntilActive();
          setState({kind: "pre-locale-save-failed", prepared});
        }
      })();
      return;
    }
    if (state.kind === "recovery-save-failed") {
      /** Runtime retaining the failed repair write. */
      const runtime = state.runtime;
      setState({kind: "loading"});
      void runtime.authority
        .retryPendingSave()
        .then(() => waitUntilActive())
        .then(() => finishBoot(runtime))
        .catch(async () => {
          await waitUntilActive();
          setState({kind: "recovery-save-failed", runtime});
        });
      return;
    }
    if (state.kind === "reset-save-failed") {
      /** Reset context retaining the failed write. */
      const reset = state.reset;
      setState({kind: "loading"});
      void reset.gate
        .retry()
        .then(() => waitUntilActive())
        .then(() => LocalSoloAuthority.restore(reset.save, reset.content, reset.gate))
        .then(async (authority) => {
          await waitUntilActive();
          finishBoot({locale: reset.locale, content: reset.content, authority});
        })
        .catch(async () => {
          await waitUntilActive();
          setState({kind: "reset-save-failed", reset});
        });
    }
  }, [applyPreparedRuntime, finishBoot, resolvePreparedRuntime, state, waitUntilActive]);
  /** Changes reset confirmation without exposing state mutation. */
  const setResetConfirmation = useCallback((confirming: boolean): void => {
    setState((current) => (current.kind === "reset-required" ? {...current, confirming} : current));
  }, []);
  /** Persists a fresh save after player confirmation. */
  const resetSave = useCallback((): void => {
    if (state.kind !== "reset-required") return;
    /** Confirmed reset context. */
    const reset = state.reset;
    /** Fresh platform-local save. */
    const save = createEmptyYouTubeSave(reset.content.contentVersion);
    save.revision = 1;
    /** Ordered platform save gate. */
    const gate = new YouTubeSaveGate(sdk);
    setState({kind: "loading"});
    void gate
      .commit(save)
      .then(() => waitUntilActive())
      .then(() => LocalSoloAuthority.restore(save, reset.content, gate))
      .then(async (authority) => {
        await waitUntilActive();
        finishBoot({locale: reset.locale, content: reset.content, authority});
      })
      .catch(async () => {
        await waitUntilActive();
        sdk.logWarning();
        setState({kind: "reset-save-failed", reset: {locale: reset.locale, content: reset.content, save, gate}});
      });
  }, [finishBoot, sdk, state, waitUntilActive]);

  return {state, platformPaused, retry, setResetConfirmation, resetSave};
}
