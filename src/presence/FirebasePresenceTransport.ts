import {getDatabase, onDisconnect, onValue, ref, remove, serverTimestamp, set, update} from "firebase/database";
import {firebaseApp} from "../platform/firebase/browserClient";
import type {ActivePresenceState, PresenceConnection, PresenceTransport} from "./PlatformPresenceSession";

/** Provides safe path segment behavior. */
const safePathSegment = /^[A-Za-z0-9_-]{1,160}$/;

/** RTDB transport for one authenticated user's per-session presence records. */
export class FirebasePresenceTransport implements PresenceTransport {
  /** Stores user id. */
  private readonly userId: string;
  /** Stores database. */
  private readonly database = getDatabase(firebaseApp);

  /** Creates a firebase presence transport instance. */
  constructor(userId: string) {
    if (!safePathSegment.test(userId)) throw new Error("presence-user-id-invalid");
    this.userId = userId;
  }

  /** Provides connection ref behavior. */
  private connectionRef(sessionId: string) {
    if (!safePathSegment.test(sessionId)) throw new Error("presence-session-id-invalid");
    return ref(this.database, `presenceConnections/${this.userId}/${sessionId}`);
  }

  /** Provides register behavior. */
  async register(connection: PresenceConnection): Promise<void> {
    await set(this.connectionRef(connection.sessionId), {
      platform: connection.platform,
      state: connection.state,
      updatedAt: serverTimestamp(),
    });
  }

  /** Provides update behavior. */
  async update(sessionId: string, state: ActivePresenceState): Promise<void> {
    await update(this.connectionRef(sessionId), {state, updatedAt: serverTimestamp()});
  }

  /** Provides remove behavior. */
  async remove(sessionId: string): Promise<void> {
    await remove(this.connectionRef(sessionId));
  }

  /** Provides on reconnect behavior. */
  onReconnect(callback: () => void | Promise<void>): () => void {
    return onValue(ref(this.database, ".info/connected"), (snapshot) => {
      if (snapshot.val() === true) void callback();
    });
  }

  /** Provides arm disconnect removal behavior. */
  async armDisconnectRemoval(sessionId: string): Promise<void> {
    await onDisconnect(this.connectionRef(sessionId)).remove();
  }
}
