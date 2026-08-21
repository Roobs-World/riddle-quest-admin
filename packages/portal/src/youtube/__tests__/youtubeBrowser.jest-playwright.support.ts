import {execFileSync} from "node:child_process";
import {createServer, type Server} from "node:http";
import {readFile} from "node:fs/promises";
import path from "node:path";
import type {Frame, Page} from "@playwright/test";

export type HarnessResult = Readonly<{
  kind: "resolve" | "reject";
  value?: string;
  message?: string;
  delayMs?: number;
}>;

export type YouTubeHarnessConfiguration = Readonly<{
  language?: string;
  audioEnabled?: boolean;
  pauseOnSubscribe?: boolean;
  loadResults?: readonly HarnessResult[];
  saveResults?: readonly HarnessResult[];
}>;

export type YouTubeHarnessSnapshot = Readonly<{
  events: string[];
  savedPayloads: string[];
  activePauseSubscribers: number;
  activeResumeSubscribers: number;
  activeAudioSubscribers: number;
}>;

declare global {
  interface Window {
    __youtubeHarness: {
      events: string[];
      savedPayloads: string[];
      emitPause(): void;
      emitResume(): void;
      emitAudio(enabled: boolean): void;
      snapshot(): YouTubeHarnessSnapshot;
    };
  }
}

const contentTypes: Readonly<Record<string, string>> = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
};

export type YouTubeArtifactServer = Readonly<{
  origin: string;
  close(): Promise<void>;
}>;

const closeServer = (server: Server): Promise<void> => new Promise((resolve, reject) => {
  server.close((error) => error ? reject(error) : resolve());
});

/** Builds the explicit non-release content fixture and serves only the emitted artifact. */
export async function startYouTubeArtifactServer(): Promise<YouTubeArtifactServer> {
  const packageRoot = path.resolve(__dirname, "../../..");
  if (process.env.PORTAL_USE_EXISTING_BUILD !== "1") {
    execFileSync("pnpm", ["--filter", "@qwordly/portal", "build:youtube:fixture"], {
      cwd: path.resolve(packageRoot, "../.."),
      stdio: "inherit",
    });
  }
  const distDirectory = path.join(packageRoot, "dist-youtube");
  const zeroSizeHost = `<!doctype html><html><body style="margin:0">
    <iframe id="playable" title="YouTube Playable" src="/" style="border:0;width:0;height:0"></iframe>
  </body></html>`;
  const server = createServer(async (request, response) => {
    const requestUrl = new URL(request.url ?? "/", "http://127.0.0.1");
    if (requestUrl.pathname === "/__zero-size-host.html") {
      response.writeHead(200, {"content-type": "text/html; charset=utf-8"});
      response.end(zeroSizeHost);
      return;
    }
    let requested: string;
    try {
      requested = decodeURIComponent(requestUrl.pathname === "/" ? "index.html" : requestUrl.pathname.slice(1));
    } catch {
      response.writeHead(400).end();
      return;
    }
    const filePath = path.resolve(distDirectory, requested);
    if (filePath !== path.join(distDirectory, "index.html") && !filePath.startsWith(`${distDirectory}${path.sep}`)) {
      response.writeHead(404).end();
      return;
    }
    try {
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
  const address = server.address();
  if (!address || typeof address === "string") {
    await closeServer(server);
    throw new Error("youtube-browser-server-address-unavailable");
  }
  return {
    origin: `http://127.0.0.1:${address.port}`,
    close: () => closeServer(server),
  };
}

/** Installs a deterministic implementation before the synchronous SDK script and app module execute. */
export async function installYouTubeSdkHarness(
  page: Page,
  configuration: YouTubeHarnessConfiguration = {},
): Promise<void> {
  await page.route("https://www.youtube.com/game_api/v1", (route) => route.fulfill({
    status: 200,
    contentType: "text/javascript",
    body: "/* YouTube SDK supplied by the injected certification harness. */",
  }));
  await page.addInitScript((options: YouTubeHarnessConfiguration) => {
    const events: string[] = [];
    const savedPayloads: string[] = [];
    const loadResults = [...(options.loadResults ?? [{kind: "resolve", value: ""}])];
    const saveResults = [...(options.saveResults ?? [])];
    const pauseSubscribers = new Set<() => void>();
    const resumeSubscribers = new Set<() => void>();
    const audioSubscribers = new Set<(enabled: boolean) => void>();
    let audioEnabled = options.audioEnabled ?? true;
    let loadCalls = 0;
    let saveCalls = 0;

    const settle = async (result: HarnessResult | undefined, fallback = ""): Promise<string> => {
      if (result?.delayMs) await new Promise((resolve) => setTimeout(resolve, result.delayMs));
      else await Promise.resolve();
      if (result?.kind === "reject") throw new Error(result.message ?? "injected-sdk-failure");
      return result?.value ?? fallback;
    };
    const unsubscribe = <T,>(subscribers: Set<T>, callback: T, name: string): (() => void) => {
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
      emitPause() {
        events.push("host:pause");
        for (const callback of pauseSubscribers) callback();
      },
      emitResume() {
        events.push("host:resume");
        for (const callback of resumeSubscribers) callback();
      },
      emitAudio(enabled) {
        audioEnabled = enabled;
        events.push(`host:audio:${enabled}`);
        for (const callback of audioSubscribers) callback(enabled);
      },
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
          firstFrameReady() { events.push("sdk:first-frame-ready"); },
          gameReady() { events.push("sdk:game-ready"); },
          async loadData() {
            loadCalls += 1;
            events.push(`sdk:load:start:${loadCalls}`);
            try {
              const value = await settle(loadResults.shift(), "");
              events.push(`sdk:load:success:${loadCalls}`);
              return value;
            } catch (error) {
              events.push(`sdk:load:failure:${loadCalls}`);
              throw error;
            }
          },
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
          async getLanguage() {
            events.push(`sdk:language:${options.language ?? "en"}`);
            return options.language ?? "en";
          },
          isAudioEnabled() {
            events.push(`sdk:audio:read:${audioEnabled}`);
            return audioEnabled;
          },
          onAudioEnabledChange(callback: (enabled: boolean) => void) {
            return unsubscribe(audioSubscribers, callback, "audio");
          },
          onPause(callback: () => void) {
            const remove = unsubscribe(pauseSubscribers, callback, "pause");
            if (options.pauseOnSubscribe) {
              events.push("host:pause-on-subscribe");
              callback();
            }
            return remove;
          },
          onResume(callback: () => void) {
            return unsubscribe(resumeSubscribers, callback, "resume");
          },
        },
        health: {
          logError() { events.push("sdk:health:error"); },
          logWarning() { events.push("sdk:health:warning"); },
        },
      },
    });
  }, configuration);
}

export async function youtubeHarnessSnapshot(context: Page | Frame): Promise<YouTubeHarnessSnapshot> {
  return context.evaluate(() => window.__youtubeHarness.snapshot());
}
