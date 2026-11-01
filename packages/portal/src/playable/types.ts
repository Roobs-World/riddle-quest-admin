// Shim: the Playable's types module now lives in @qwordly/solo so native targets share it verbatim.
import type {PlatformRuntimePolicy} from "../platform/types";
import {YOUTUBE_RUNTIME_POLICY as SOLO_YOUTUBE_RUNTIME_POLICY} from "@qwordly/solo";
export type {YouTubeRuntimePolicy, YouTubeLocale, YouTubeGameMode, YouTubeRiddle, YouTubeContent, YouTubeSdkPort, YouTubeSavedGuess, YouTubeActiveGame, YouTubeProgress, YouTubeOperationReceipt, YouTubeSaveV1, YouTubeResult} from "@qwordly/solo";
/** Defines the youtube runtime policy value. */
export const YOUTUBE_RUNTIME_POLICY: PlatformRuntimePolicy = SOLO_YOUTUBE_RUNTIME_POLICY;
