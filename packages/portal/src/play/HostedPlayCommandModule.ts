import type {GameToHostMessage} from "@qwordly/core/bridge";
import {createHostMessageRouter} from "./bridgeRouter";
import {createPlayHostMessageHandlers, type CreateHostMessageHandlersOptions} from "./hostMessageHandlers";

/** Deep command module consumed by hosted-play delivery and its tests. */
export type HostedPlayCommandModule = Readonly<{
  /** Parses and executes one untrusted game command. */
  execute(value: unknown): Promise<GameToHostMessage>;
}>;

/** Coherent inputs consumed by the command implementation. */
export type HostedPlayCommandContext = Readonly<{
  session: Pick<
    CreateHostMessageHandlersOptions,
    | "authSnapshot"
    | "gameMode"
    | "locale"
    | "loadedUserIdRef"
    | "playableReportedRef"
    | "accountDeletionCompletedRef"
  >;
  delivery: Pick<
    CreateHostMessageHandlersOptions,
    "setFrameReady" | "setNotice" | "sendInit" | "loadAndPostRiddle" | "postOperation"
  >;
  execution: Pick<
    CreateHostMessageHandlersOptions,
    "authority" | "runRaceOperation" | "withServerActivity" | "applyPurchaseBalance" | "syncRaceAchievementProgress"
  >;
  callbacks: Pick<
    CreateHostMessageHandlersOptions,
    | "onPlayable"
    | "onAuthoritativeComplete"
    | "onAuthoritativeRaceResult"
    | "onAccountDeleted"
    | "onAccountDeletionRequested"
  >;
}>;

/** Concentrates schema routing behind one hosted-play command interface. */
export function createHostedPlayCommandModule(context: HostedPlayCommandContext): HostedPlayCommandModule {
  return {
    execute: createHostMessageRouter(
      createPlayHostMessageHandlers({
        ...context.session,
        ...context.delivery,
        ...context.execution,
        ...context.callbacks,
      }),
    ),
  };
}
