import {createAndroidPlayerStorage} from "./androidPlayerStorage";
import {AndroidEntryInbox, parseAndroidInviteEntry, type AndroidInviteEntry} from "../entries/androidEntryInbox";
import {useEffect, useRef, useState, useSyncExternalStore} from "react";
import {Linking} from "react-native";
import {readPlayInstallReferrer} from "./playInstallReferrer";

/** Adapts native URLs and the optional Play receipt to the persistent shared inbox. */
export function useAndroidEntries({ignoreEntry, onDaily, recoverLaunchEntries = true}: {
  /** An already displayed race must not replace another queued invitation. */
  ignoreEntry(entry: AndroidInviteEntry): boolean;
  /** Daily navigation has no invitation receipt or acceptance semantics. */
  onDaily(): void;
  /** Account reset skips one-time native inputs that belong to the previous launch. */
  recoverLaunchEntries?: boolean;
}) {
  /** One inbox serializes all storage changes throughout the root lifetime. */
  const [inbox] = useState(() => new AndroidEntryInbox(createAndroidPlayerStorage()));
  /** Current callbacks are read without restarting native initial-URL queries. */
  const callbacks = useRef({ignoreEntry, onDaily});
  callbacks.current = {ignoreEntry, onDaily};
  /** Pending preview survives ordinary launches until an exact-handle acknowledgement. */
  const pending = useSyncExternalStore(inbox.subscribe, inbox.getSnapshot, inbox.getSnapshot);
  useEffect(() => {
    /** Retired effects cannot dispatch late native reads. */
    let current = true;
    /** Foreground navigation takes precedence over slower initial-URL and Play reads. */
    let foregroundRevision = 0;
    /** Validated native input never joins a match or binds a referral. */
    const receive = (url: string | null | undefined, initialRevision?: number) => {
      if (!current || !url || (initialRevision !== undefined && foregroundRevision !== initialRevision)) return;
      if (url === "riddlequest://daily") {inbox.prioritizeDirectNavigation(); callbacks.current.onDaily(); return;}
      /** Validated opaque invitation data, never authority to join or grant rewards. */
      const entry = parseAndroidInviteEntry(url);
      if (!entry) return;
      if (callbacks.current.ignoreEntry(entry)) inbox.prioritizeDirectNavigation();
      else void inbox.receiveDirect(url);
    };
    void inbox.load();
    if (recoverLaunchEntries) void Linking.getInitialURL().then(url => receive(url, 0), () => undefined);
    /** Foreground URL subscription removed when the native adapter retires. */
    const listener = Linking.addEventListener("url", event => {foregroundRevision++; receive(event.url);});
    if (recoverLaunchEntries) void readPlayInstallReferrer().then(referrer => {if (current) void inbox.receiveInstallReferrer(referrer);}, () => undefined);
    return () => {current = false; listener.remove();};
  }, [inbox, recoverLaunchEntries]);
  return {pending, acknowledge: (id: string) => inbox.acknowledge(id)};
}
