// Binds the shared local-game policy to the browser capability contract.
import type {PlatformRuntimePolicy} from "./capabilities";
import {YOUTUBE_RUNTIME_POLICY as SOLO_YOUTUBE_RUNTIME_POLICY} from "../../gameplay/local/types";
export {type YouTubeRuntimePolicy, type YouTubeLocale, type YouTubeGameMode, type YouTubeRiddle, type YouTubeContent, type YouTubeSdkPort, type YouTubeSavedGuess, type YouTubeActiveGame, type YouTubeProgress, type YouTubeOperationReceipt, type YouTubeSaveV1, type YouTubeResult} from "../../gameplay/local/types";
/** Defines the youtube runtime policy value. */
export const YOUTUBE_RUNTIME_POLICY: PlatformRuntimePolicy = SOLO_YOUTUBE_RUNTIME_POLICY;
