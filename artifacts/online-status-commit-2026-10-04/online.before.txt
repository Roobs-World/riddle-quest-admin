import {useEffect, useState} from "react";

/** Provides online status. */
export function useOnlineStatus(): boolean {
  /** Provides [online, set online] behavior. */
  const [online, setOnline] = useState(() => typeof navigator === "undefined" || navigator.onLine);
  useEffect(() => {
    /** Handles online. */
    const handleOnline = () => setOnline(true);
    /** Handles offline. */
    const handleOffline = () => setOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);
  return online;
}
