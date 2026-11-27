import type {RaceLocale} from "../../../../src/races/contracts/index";
import type {NativeSocialCapability, PlatformResult} from "../../../../src/platform/contracts/capabilities";

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
    const [{getFunctions}, {firebaseApp}, {encryptedHttpsCallable: httpsCallable}] = await Promise.all([
      import("firebase/functions"),
      import("../../../../src/platform/firebase/browserClient"),
      import("../../../../src/platform/firebase/encryptedCallable"),
    ]);
    await httpsCallable<typeof input, unknown>(getFunctions(firebaseApp, "us-central1"), "joinFacebookContext")(input);
  }

  /** Provides leave behavior. */
  async leave(input: {
    /** Stores context id. */ /** Stores context id. */ /** Stores context id. */
    contextId: string;
  }): Promise<void> {
    /** Provides [{get functions, https callable}, {firebase app}] behavior. */
    const [{getFunctions}, {firebaseApp}, {encryptedHttpsCallable: httpsCallable}] = await Promise.all([
      import("firebase/functions"),
      import("../../../../src/platform/firebase/browserClient"),
      import("../../../../src/platform/firebase/encryptedCallable"),
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
  /** Concurrent board adapters share one current-context reconciliation. */
  private reconciliation: Promise<PlatformResult<ContextValue>> | null = null;
  /** Stores requested revision. */
  private requestedRevision = 0;
  /** One session owns the native subscription; board consumers only observe invalidation. */
  private readonly contextListeners = new Set<() => void>();
  /** Account deletion and unmount retire queued membership operations as well as callbacks. */
  private sessionIsActive: () => boolean = () => true;
  /** Stores sdk social. */
  private readonly sdkSocial: NativeSocialCapability;
  /** Stores get locale. */
  private readonly getLocale: () => RaceLocale;
  /** Stores backend. */
  private readonly backend: FacebookContextBackendPort;
  readonly matchPlayer?: NativeSocialCapability["matchPlayer"];

  /** Creates a facebook context coordinator instance. */
  constructor(
    sdkSocial: NativeSocialCapability,
    getLocale: () => RaceLocale,
    backend: FacebookContextBackendPort = new FirebaseFacebookContextBackend(),
  ) {
    this.sdkSocial = sdkSocial;
    this.getLocale = getLocale;
    this.backend = backend;
    const matchPlayer = sdkSocial.matchPlayer;
    if (matchPlayer) {
      this.matchPlayer = async tag => this.reconcileChoice(await matchPlayer.call(sdkSocial, tag));
    }
  }

  /** Observes native changes for the entire authenticated session, including outside the race UI. */
  startObserving(isActive: () => boolean): () => void {
    /** This observation lifetime owns its native callback. */
    let active = true;
    /** The entry supplies its current account-operation gate. */
    const ownsSession = () => active && isActive();
    this.sessionIsActive = ownsSession;
    /** Exactly one native registration serves all mounted board consumers. */
    const stopSdk = this.sdkSocial.onContextChange?.(() => {
      if (!ownsSession()) return;
      /** Invalidate the old snapshot before notifying any consumer. */
      const operation = this.synchronizeCurrent();
      this.reconciliation = operation;
      for (const listener of this.contextListeners) listener();
      /** Native signals have no awaiting caller; consumers share this operation. */
      void operation.then(
        () => {if (this.reconciliation === operation) this.reconciliation = null;},
        () => {if (this.reconciliation === operation) this.reconciliation = null;},
      );
    });
    return () => {
      if (!active) return;
      active = false; stopSdk?.();
      if (this.sessionIsActive === ownsSession) {
        ++this.requestedRevision;
        this.synchronizedContext = undefined;
        this.synchronizedLocale = undefined;
        this.reconciliation = null;
      }
    };
  }

  /** Invalidates mounted provider-neutral views without registering another SDK callback. */
  onContextChange(callback: () => void): () => void {
    this.contextListeners.add(callback);
    return () => {this.contextListeners.delete(callback);};
  }

  /** Provides current context behavior. */
  currentContext(): PlatformResult<ContextValue> {
    if (!this.sessionIsActive()) return {status: "unavailable", message: "facebook-context-not-synchronized"};
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

  /** Reconciles restored preferences or external context changes before a board adapter proceeds. */
  async ensureCurrent(): Promise<PlatformResult<ContextValue>> {
    /** Already synchronized identity and language require no backend write. */
    const current = this.currentContext();
    if (current.status === "success") return current;
    /** Concurrent consumers retain one owned synchronization instead of superseding each other. */
    const operation = this.reconciliation ?? this.synchronizeCurrent();
    this.reconciliation = operation;
    try {
      /** Recheck mutable SDK context and language after asynchronous membership delivery. */
      const result = await operation;
      return result.status === "success" ? this.currentContext() : result;
    } finally {if (this.reconciliation === operation) this.reconciliation = null;}
  }

  /** Provides choose context behavior. */
  async chooseContext(): Promise<PlatformResult<ContextValue>> {
    return this.reconcileChoice(await this.sdkSocial.chooseContext());
  }

  /** Native events and chooser settlement share membership work without invalidating awaiting board consumers. */
  private async reconcileChoice(result: PlatformResult<ContextValue>): Promise<PlatformResult<ContextValue>> {
    /** Event delivery may already own synchronization for the same SDK selection. */
    const notify = !this.reconciliation && this.currentContext().status !== "success";
    /** Starting reconciliation first lets listeners share it on hosts without native context events. */
    const operation = this.ensureCurrent();
    if (notify) for (const listener of this.contextListeners) listener();
    /** A native event already notified its consumers and must not be repeated by chooser settlement. */
    const current = await operation;
    // A rejected or ineligible dialog says nothing about the actual native context.
    // Reconcile that context independently and preserve the original action result.
    if (result.status !== "success") return result;
    if (current.status !== "success") return current;
    return current.value.contextId === result.value.contextId && current.value.contextType === result.value.contextType
      ? current : {status: "unavailable", message: "facebook-context-not-synchronized"};
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
    if (revision !== this.requestedRevision || !this.sessionIsActive()) {
      return {status: "unavailable", message: "facebook-context-not-synchronized"};
    }
    /** Provides previous context id behavior. */
    const previousContextId = this.currentContextId;
    /** Provides locale behavior. */
    const locale = this.getLocale();
    try {
      if (result.status !== "success") {
        /** Returning to solo retires the former social membership, even with no mounted board. */
        if (result.status === "unavailable" && previousContextId) {
          await this.backend.leave({contextId: previousContextId});
          this.currentContextId = undefined;
        }
        return result;
      }
      await this.backend.join({...result.value, locale});
      if (!this.sessionIsActive()) return {status: "unavailable", message: "facebook-context-not-synchronized"};
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
