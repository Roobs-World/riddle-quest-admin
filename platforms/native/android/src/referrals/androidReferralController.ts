import {trackEvent} from "../../../../../src/observability/analytics/eventsRuntime";
import {androidReferralUrl, type AndroidReferralBackend, type AndroidReferralStatus} from "./androidReferrals";
/** Native-independent invite state, with rewards supplied only by the backend. */
export type AndroidReferralState = Readonly<{
/** Stores status. */
status: AndroidReferralStatus | null;
/** Stores busy. */
busy: boolean;
/** Stores failed. */
failed: boolean}>;
/** Controls one account's invite surface; sharing never grants a reward. */
export class AndroidReferralController {
  /** Stores active. */
  private active = true;
  /** Identifies the native-view lifetime that owns each asynchronous operation. */
  private lifetime = 0;
  /** Stores revision. */
  private revision = 0;
  /** Stores state. */
  private state: AndroidReferralState = {status: null, busy: false, failed: false};
  /** Stores listeners. */
  private readonly listeners = new Set<() => void>();
  /** Stores backend. */
  private readonly backend: AndroidReferralBackend;
  /** Stores share. */
  /** Expected authenticated account included in every native referral request. */
  private readonly ownerId: string | undefined;
  /** Stores share. */
  private readonly share: (url: string) => Promise<unknown>;
  /** Creates a android referral controller instance. */
  constructor(backend: AndroidReferralBackend, share: (url: string) => Promise<unknown>, ownerId?: string) {this.backend = backend; this.share = share; this.ownerId = ownerId;}
  /** Starts an explicit native-view lifetime. */
  start(): Promise<void> {this.active = true; this.lifetime++; return this.refresh();}
  /** Gets snapshot. */
  readonly getSnapshot = (): AndroidReferralState => this.state;
  /** Retains subscribe for this operation. */
  readonly subscribe = (listener: () => void): (() => void) => {this.listeners.add(listener); return () => this.listeners.delete(listener);};
  /** Retains publish for this operation. */
  private publish(state: AndroidReferralState): void {
    if (!this.active) return;
    this.state = state;
    this.listeners.forEach(listener => listener());
  }
  /** Refreshes authoritative eligibility without binding an incoming invite. */
  readonly refresh = async (): Promise<void> => {
    /** Retains revision for this operation. */
    if (!this.active) return;
    /** Retains revision for this operation. */
    const revision = ++this.revision;
    /** Retains lifetime for this operation. */
    const lifetime = this.lifetime;
    this.publish({...this.state, busy: true, failed: false});
    if (!this.owns(lifetime)) return;
    try {
      /** Retains status for this operation. */
      const status = await this.backend.status(this.ownerId);
      if (this.owns(lifetime) && revision === this.revision) this.publish({status, busy: false, failed: false});
    } catch {if (this.owns(lifetime) && revision === this.revision) this.publish({...this.state, busy: false, failed: true});}
  };
  /** Explicit acceptance precedes the first confirmed online win. */
  async accept(token: string): Promise<void> {
    if (!this.active || this.state.busy || this.state.status?.kind !== "ready" || !this.state.status.canBind) return;
    /** Retains lifetime for this operation. */
    const lifetime = this.lifetime;
    this.publish({...this.state, busy: true, failed: false});
    if (!this.owns(lifetime)) return;
    trackEvent("referral_accept_requested");
    try {await this.backend.bind(token, this.ownerId); trackEvent("referral_accept_result", {status: "success"}); if (this.owns(lifetime)) await this.refresh();}
    catch {trackEvent("referral_accept_result", {status: "failed"}); if (this.owns(lifetime)) this.publish({...this.state, busy: false, failed: true});}
  }
  /** Mints an opaque server invite before opening the target's share sheet. */
  readonly invite = async (): Promise<void> => {
    if (!this.active || this.state.busy || this.state.status?.kind !== "ready") return;
    /** Retains lifetime for this operation. */
    const lifetime = this.lifetime;
    this.publish({...this.state, busy: true, failed: false});
    if (!this.owns(lifetime)) return;
    try {
      /** Retains entry for this operation. */
      trackEvent("referral_share_requested");
      const entry = await this.backend.create(this.ownerId);
      if (this.owns(lifetime)) {await this.share(androidReferralUrl(entry.token)); trackEvent("referral_share_opened");}
      if (this.owns(lifetime)) this.publish({...this.state, busy: false});
    } catch {trackEvent("referral_share_failed"); if (this.owns(lifetime)) this.publish({...this.state, busy: false, failed: true});}
  };
  /** A retired or replaced view cannot dispatch or publish account work. */
  private owns(lifetime: number): boolean {return this.active && this.lifetime === lifetime;}
  /** Drops late requests when an account or native view retires. */
  dispose(): void {this.active = false; this.lifetime++; this.revision++;}
}
