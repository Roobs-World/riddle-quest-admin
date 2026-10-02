import {RaceConfirmedHistory} from "./logic/raceConfirmedHistory";
import type {RaceOutcome, RaceRunView} from "@qwordly/core/race";
import {isolateConfirmedRace} from "./RaceSessionAuthority";

/** Owns canonical snapshots and receipt timing separately from mutable UI presentation. */
export class RaceOwnedAuthority {
  /** Accepted immutable run facts retain compatible optional content privately. */
  private snapshot: RaceRunView | null = null;
  /** Confirmed competitive outcome never aliases the rendered result. */
  private result: RaceOutcome | null = null;
  /** Canonical lifecycle timing anchors to the exact accepted receipt observation. */
  private receipt = 0;
  /** Private confirmed rows survive optional omissions without trusting rendering state. */
  private readonly history = new RaceConfirmedHistory();
  /** Validate candidate rows before any action checkpoint is consumed. */
  previewHistory(run: RaceRunView): RaceRunView {return this.history.preview(run);}
  /** Projects private sparse facts without trusting mutable rendered board references. */
  attempts(run: RaceRunView) {return this.history.attempts(run);}
  /** Internal authority consumers read the privately retained contract. */
  get run(): RaceRunView | null {return this.snapshot;}
  /** Internal outcome validation reads the privately retained terminal contract. */
  get outcome(): RaceOutcome | null {return this.result;}
  /** Lifecycle and draft adapters share the canonical receipt timestamp. */
  get receivedAtMs(): number {return this.receipt;}
  /** Account replacement, rematch and disposal retire the complete private contract together. */
  reset(): void {this.history.reset();this.snapshot = null; this.result = null; this.receipt = 0;}
  /** Only validated, still-owned run responses may reach this commit boundary. */
  confirmRun(run: RaceRunView, receivedAtMs: number): RaceRunView {
    /** Commit the reconciled public view and its independent private snapshot together. */
    const confirmed = this.history.accept(run);
    this.snapshot = isolateConfirmedRace(confirmed, this.snapshot);
    this.receipt = receivedAtMs;
    return confirmed;
  }
  /** Only validated, still-owned terminal responses may pin competitive facts. */
  confirmOutcome(outcome: RaceOutcome): void {this.result = structuredClone(outcome);}
}
