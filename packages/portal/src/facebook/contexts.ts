import type {RaceLocale} from "@qwordly/core/race";
import type {NativeSocialCapability, PlatformResult} from "../platform/types";

/** Describes context value. */
type ContextValue = {
  /** Stores context id. */
  /** Stores context id. */
  contextId: string; /** Stores context type. */
  /** Stores context type. */
  contextType: "THREAD" | "GROUP";
};

/** Defines the contract for facebook context backend port. */
export interface FacebookContextBackendPort {
  /** Provides join behavior. */
  join(
    input: ContextValue & {
      /** Stores locale. */
      locale: RaceLocale;
    },
  ): Promise<void>;
  /** Provides leave behavior. */
  leave(input: {
    /** Stores context id. */ /** Stores context id. */ /** Stores context id. */
    contextId: string;
  }): Promise<void>;
}

/** Provides firebase facebook context backend behavior. */
class FirebaseFacebookContextBackend implements FacebookContextBackendPort {
  /** Provides join behavior. */
  async join(
    input: ContextValue & {
      /** Stores locale. */
      locale: RaceLocale;
    },
  ): Promise<void> {
    /** Provides [{get functions, https callable}, {firebase app}] behavior. */
    const [{getFunctions, httpsCallable}, {firebaseApp}] = await Promise.all([
      import("firebase/functions"),
      import("../firebase"),
    ]);
    await httpsCallable<typeof input, unknown>(getFunctions(firebaseApp, "us-central1"), "joinFacebookContext")(input);
  }

  /** Provides leave behavior. */
  async leave(input: {
    /** Stores context id. */ /** Stores context id. */ /** Stores context id. */
    contextId: string;
  }): Promise<void> {
    /** Provides [{get functions, https callable}, {firebase app}] behavior. */
    const [{getFunctions, httpsCallable}, {firebaseApp}] = await Promise.all([
      import("firebase/functions"),
      import("../firebase"),
    ]);
    await httpsCallable<typeof input, unknown>(getFunctions(firebaseApp, "us-central1"), "leaveFacebookContext")(input);
  }
}

/** Keeps SDK context changes and the server's hashed context membership convergent. */
export class FacebookContextCoordinator implements NativeSocialCapability {
  /** Stores current context id. */
  private currentContextId?: string;
  /** Stores synchronized context. */
  private synchronizedContext?: ContextValue;
  /** Stores synchronized locale. */
  private synchronizedLocale?: RaceLocale;
  /** Stores synchronization. */
  private synchronization: Promise<void> = Promise.resolve();
  /** Stores requested revision. */
  private requestedRevision = 0;
  /** Stores sdk social. */
  private readonly sdkSocial: NativeSocialCapability;
  /** Stores get locale. */
  private readonly getLocale: () => RaceLocale;
  /** Stores backend. */
  private readonly backend: FacebookContextBackendPort;

  /** Creates a facebook context coordinator instance. */
  constructor(
    sdkSocial: NativeSocialCapability,
    getLocale: () => RaceLocale,
    backend: FacebookContextBackendPort = new FirebaseFacebookContextBackend(),
  ) {
    this.sdkSocial = sdkSocial;
    this.getLocale = getLocale;
    this.backend = backend;
  }

  /** Provides current context behavior. */
  currentContext(): PlatformResult<ContextValue> {
    /** Provides sdk context behavior. */
    const sdkContext = this.sdkSocial.currentContext();
    if (
      sdkContext.status !== "success" ||
      !this.synchronizedContext ||
      this.synchronizedLocale !== this.getLocale() ||
      sdkContext.value.contextId !== this.synchronizedContext.contextId ||
      sdkContext.value.contextType !== this.synchronizedContext.contextType
    ) {
      return {status: "unavailable", message: "facebook-context-not-synchronized"};
    }
    return {status: "success", value: this.synchronizedContext};
  }

  /** Provides synchronize current behavior. */
  async synchronizeCurrent(): Promise<PlatformResult<ContextValue>> {
    return this.synchronize(this.sdkSocial.currentContext());
  }

  /** Provides choose context behavior. */
  async chooseContext(): Promise<PlatformResult<ContextValue>> {
    return this.synchronize(await this.sdkSocial.chooseContext());
  }

  /** Provides match player behavior. */
  async matchPlayer(tag?: string): Promise<PlatformResult<ContextValue>> {
    return this.synchronize(await this.sdkSocial.matchPlayer(tag));
  }

  /** Provides synchronize behavior. */
  private synchronize(result: PlatformResult<ContextValue>): Promise<PlatformResult<ContextValue>> {
    /** Provides revision behavior. */
    const revision = ++this.requestedRevision;
    this.synchronizedContext = undefined;
    this.synchronizedLocale = undefined;
    /** Provides operation behavior. */
    const operation = this.synchronization.then(() => this.applySynchronization(result, revision));
    this.synchronization = operation.then(
      () => undefined,
      () => undefined,
    );
    return operation;
  }

  /** Applies synchronization. */
  private async applySynchronization(
    result: PlatformResult<ContextValue>,
    revision: number,
  ): Promise<PlatformResult<ContextValue>> {
    if (result.status !== "success") return result;
    if (revision !== this.requestedRevision) {
      return {status: "unavailable", message: "facebook-context-not-synchronized"};
    }
    /** Provides previous context id behavior. */
    const previousContextId = this.currentContextId;
    /** Provides locale behavior. */
    const locale = this.getLocale();
    try {
      await this.backend.join({...result.value, locale});
      if (previousContextId && previousContextId !== result.value.contextId) {
        await this.backend.leave({contextId: previousContextId});
      }
      this.currentContextId = result.value.contextId;
      if (revision !== this.requestedRevision || locale !== this.getLocale()) {
        return {status: "unavailable", message: "facebook-context-not-synchronized"};
      }
      this.synchronizedContext = result.value;
      this.synchronizedLocale = locale;
      return result;
    } catch {
      return {status: "retryable-failure", message: "facebook-context-sync-failed"};
    }
  }
}
