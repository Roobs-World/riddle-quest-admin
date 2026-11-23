import {execFileSync} from "node:child_process";
import {createServer, type Server} from "node:http";
import {mkdtemp, readFile, rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import path from "node:path";
import type {Frame, Page} from "@playwright/test";

/** Describes harness result. */
export type HarnessResult = Readonly<{
  /** Stores kind. */
  kind: "resolve" | "reject";
  /** Stores value. */
  value?: string;
  /** Stores message. */
  message?: string;
  /** Stores delay ms. */
  delayMs?: number;
}>;

/** Describes you tube harness configuration. */
export type YouTubeHarnessConfiguration = Readonly<{
  /** Stores language. */
  language?: string;
  /** Stores audio enabled. */
  audioEnabled?: boolean;
  /** Stores pause on subscribe. */
  pauseOnSubscribe?: boolean;
  /** Stores load results. */
  loadResults?: readonly HarnessResult[];
  /** Stores save results. */
  saveResults?: readonly HarnessResult[];
}>;

/** Describes you tube harness snapshot. */
export type YouTubeHarnessSnapshot = Readonly<{
  /** Stores events. */
  events: string[];
  /** Stores saved payloads. */
  savedPayloads: string[];
  /** Stores active pause subscribers. */
  activePauseSubscribers: number;
  /** Stores active resume subscribers. */
  activeResumeSubscribers: number;
  /** Stores active audio subscribers. */
  activeAudioSubscribers: number;
}>;

/** Documents global. */
declare global {
  /** Defines the contract for window. */
  interface Window {
    /** Stores youtube harness. */
    __youtubeHarness: {
      /** Stores events. */
      events: string[];
      /** Stores saved payloads. */
      savedPayloads: string[];
      /** Provides emit pause behavior. */
      emitPause(): void;
      /** Provides emit resume behavior. */
      emitResume(): void;
      /** Provides emit audio behavior. */
      emitAudio(enabled: boolean): void;
      /** Provides snapshot behavior. */
      snapshot(): YouTubeHarnessSnapshot;
    };
  }
}

/** Provides content types behavior. */
const contentTypes: Readonly<Record<string, string>> = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
};

/** Describes you tube artifact server. */
export type YouTubeArtifactServer = Readonly<{
  /** Exact artifact served, including an isolated fixture when requested. */
  directory: string;
  /** Stores origin. */
  origin: string;
  /** Provides close behavior. */
  close(): Promise<void>;
}>;

/** Provides close server behavior. */
const closeServer = (server: Server): Promise<void> =>
  new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });

/** Serves an isolated playable artifact; YouTube defaults to its explicit content fixture. */
export async function startYouTubeArtifactServer(
  target: "youtube" | "netflix" | "yahoo" = "youtube",
): Promise<YouTubeArtifactServer> {
  /** Provides package root behavior. */
  const packageRoot = path.resolve(__dirname, "../../..");
  /** Explicit caller output takes precedence over both release and fixture defaults. */
  const requestedDirectory = process.env[`${target.toUpperCase()}_BUILD_OUT_DIR`]?.trim();
  /** Automatic fixture builds must never replace the canonical release artifact. */
  const fixtureDirectory = target === "youtube" && process.env.PORTAL_USE_EXISTING_BUILD !== "1" && !requestedDirectory
    ? await mkdtemp(path.join(tmpdir(), "riddle-youtube-browser-")) : null;
  /** Provides dist directory behavior. */
  const distDirectory = path.resolve(requestedDirectory || fixtureDirectory || path.join(packageRoot, `../../builds/${target}`));
  if (process.env.PORTAL_USE_EXISTING_BUILD !== "1") {
    try {
      execFileSync("pnpm", ["--filter", "riddle-quest", target === "youtube" ? "build:youtube:fixture" : `build:${target}`], {
        cwd: path.resolve(packageRoot, "../.."), stdio: "inherit",
        env: {...process.env, [`${target.toUpperCase()}_BUILD_OUT_DIR`]: distDirectory},
      });
    } catch (error) {
      if (fixtureDirectory) await rm(fixtureDirectory, {recursive: true, force: true});
      throw error;
    }
  }
  /** Provides zero size host behavior. */
  const zeroSizeHost = `<!doctype html><html><body style="margin:0">
    <iframe id="playable" title="YouTube Playable" src="/" style="border:0;width:0;height:0"></iframe>
  </body></html>`;
  /** Provides server behavior. */
  const server = createServer(async (request, response) => {
    /** Requests url. */
    const requestUrl = new URL(request.url ?? "/", "http://127.0.0.1");
    if (requestUrl.pathname === "/__zero-size-host.html") {
      response.writeHead(200, {"content-type": "text/html; charset=utf-8"});
      response.end(zeroSizeHost);
      return;
    }
    /** Requests ed. */
    let requested: string;
    try {
      requested = decodeURIComponent(requestUrl.pathname === "/" ? "index.html" : requestUrl.pathname.slice(1));
    } catch {
      response.writeHead(400).end();
      return;
    }
    /** Provides file path behavior. */
    const filePath = path.resolve(distDirectory, requested);
    if (filePath !== path.join(distDirectory, "index.html") && !filePath.startsWith(`${distDirectory}${path.sep}`)) {
      response.writeHead(404).end();
      return;
    }
    try {
      /** Provides body behavior. */
      const body = await readFile(filePath);
      response.writeHead(200, {
        "cache-control": "no-store",
        "content-type": contentTypes[path.extname(filePath)] ?? "application/octet-stream",
      });
      response.end(body);
    } catch {
      response.writeHead(404).end();
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  /** Provides address behavior. */
  const address = server.address();
  if (!address || typeof address === "string") {
    await closeServer(server);
    if (fixtureDirectory) await rm(fixtureDirectory, {recursive: true, force: true});
    throw new Error("youtube-browser-server-address-unavailable");
  }
  return {
    directory: distDirectory,
    origin: `http://127.0.0.1:${address.port}`,
    close: async () => {
      await closeServer(server);
      if (fixtureDirectory) await rm(fixtureDirectory, {recursive: true, force: true});
    },
  };
}

/** Installs a deterministic implementation before the synchronous SDK script and app module execute. */
export async function installYouTubeSdkHarness(
  page: Page,
  configuration: YouTubeHarnessConfiguration = {},
): Promise<void> {
  await page.route("https://www.youtube.com/game_api/v1", (route) =>
    route.fulfill({
      status: 200,
      contentType: "text/javascript",
      body: "/* YouTube SDK supplied by the injected certification harness. */",
    }),
  );
  await page.addInitScript((options: YouTubeHarnessConfiguration) => {
    /** Provides events behavior. */
    const events: string[] = [];
    /** Saves d payloads. */
    const savedPayloads: string[] = [];
    /** Loads results. */
    const loadResults = [...(options.loadResults ?? [{kind: "resolve", value: ""}])];
    /** Saves results. */
    const saveResults = [...(options.saveResults ?? [])];
    /** Provides pause subscribers behavior. */
    const pauseSubscribers = new Set<() => void>();
    /** Provides resume subscribers behavior. */
    const resumeSubscribers = new Set<() => void>();
    /** Provides audio subscribers behavior. */
    const audioSubscribers = new Set<(enabled: boolean) => void>();
    /** Provides audio enabled behavior. */
    let audioEnabled = options.audioEnabled ?? true;
    /** Loads calls. */
    let loadCalls = 0;
    /** Saves calls. */
    let saveCalls = 0;

    /** Sets tle. */
    const settle = async (result: HarnessResult | undefined, fallback = ""): Promise<string> => {
      if (result?.delayMs) await new Promise((resolve) => setTimeout(resolve, result.delayMs));
      else await Promise.resolve();
      if (result?.kind === "reject") throw new Error(result.message ?? "injected-sdk-failure");
      return result?.value ?? fallback;
    };
    /** Provides unsubscribe behavior. */
    const unsubscribe = <T>(subscribers: Set<T>, callback: T, name: string): (() => void) => {
      subscribers.add(callback);
      events.push(`subscribe:${name}`);
      return () => {
        subscribers.delete(callback);
        events.push(`unsubscribe:${name}`);
      };
    };

    window.__youtubeHarness = {
      events,
      savedPayloads,
      /** Provides emit pause behavior. */
      emitPause() {
        events.push("host:pause");
        for (const callback of pauseSubscribers) callback();
      },
      /** Provides emit resume behavior. */
      emitResume() {
        events.push("host:resume");
        for (const callback of resumeSubscribers) callback();
      },
      /** Provides emit audio behavior. */
      emitAudio(enabled) {
        audioEnabled = enabled;
        events.push(`host:audio:${enabled}`);
        for (const callback of audioSubscribers) callback(enabled);
      },
      /** Provides snapshot behavior. */
      snapshot() {
        return {
          events: [...events],
          savedPayloads: [...savedPayloads],
          activePauseSubscribers: pauseSubscribers.size,
          activeResumeSubscribers: resumeSubscribers.size,
          activeAudioSubscribers: audioSubscribers.size,
        };
      },
    };

    Object.assign(globalThis, {
      ytgame: {
        IN_PLAYABLES_ENV: true,
        game: {
          /** Provides first frame ready behavior. */
          firstFrameReady() {
            events.push("sdk:first-frame-ready");
          },
          /** Provides game ready behavior. */
          gameReady() {
            events.push("sdk:game-ready");
          },
          /** Loads data. */
          async loadData() {
            loadCalls += 1;
            events.push(`sdk:load:start:${loadCalls}`);
            try {
              /** Provides value behavior. */
              const value = await settle(loadResults.shift(), "");
              events.push(`sdk:load:success:${loadCalls}`);
              return value;
            } catch (error) {
              events.push(`sdk:load:failure:${loadCalls}`);
              throw error;
            }
          },
          /** Saves data. */
          async saveData(data: string) {
            saveCalls += 1;
            events.push(`sdk:save:start:${saveCalls}`);
            savedPayloads.push(data);
            try {
              await settle(saveResults.shift());
              events.push(`sdk:save:success:${saveCalls}`);
            } catch (error) {
              events.push(`sdk:save:failure:${saveCalls}`);
              throw error;
            }
          },
        },
        system: {
          /** Gets language. */
          async getLanguage() {
            events.push(`sdk:language:${options.language ?? "en"}`);
            return options.language ?? "en";
          },
          /** Indicates whether is audio enabled. */
          isAudioEnabled() {
            events.push(`sdk:audio:read:${audioEnabled}`);
            return audioEnabled;
          },
          /** Provides on audio enabled change behavior. */
          onAudioEnabledChange(callback: (enabled: boolean) => void) {
            return unsubscribe(audioSubscribers, callback, "audio");
          },
          /** Provides on pause behavior. */
          onPause(callback: () => void) {
            /** Provides remove behavior. */
            const remove = unsubscribe(pauseSubscribers, callback, "pause");
            if (options.pauseOnSubscribe) {
              events.push("host:pause-on-subscribe");
              callback();
            }
            return remove;
          },
          /** Provides on resume behavior. */
          onResume(callback: () => void) {
            return unsubscribe(resumeSubscribers, callback, "resume");
          },
        },
        health: {
          /** Provides log error behavior. */
          logError() {
            events.push("sdk:health:error");
          },
          /** Provides log warning behavior. */
          logWarning() {
            events.push("sdk:health:warning");
          },
        },
      },
    });
  }, configuration);
}

/** Provides youtube harness snapshot behavior. */
export async function youtubeHarnessSnapshot(context: Page | Frame): Promise<YouTubeHarnessSnapshot> {
  return context.evaluate(() => window.__youtubeHarness.snapshot());
}
