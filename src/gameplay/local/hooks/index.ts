/**
 * React controllers for self-contained solo play, shared by web and native hosts.
 *
 * @remarks
 * These hooks hold no DOM or React Native references. Hosts supply the content
 * source, the save transport, and small presentation callbacks instead.
 *
 * @packageDocumentation
 */
export * from "./useYouTubePlayableBoot";
export * from "./useYouTubeReadySession";
