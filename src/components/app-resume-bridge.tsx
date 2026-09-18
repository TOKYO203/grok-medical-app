import { useEffect, useRef } from "react";

const RESUME_THROTTLE_MS = 3_000;

/**
 * Mobile browsers can suspend a PWA without changing network state. When the
 * app returns to the foreground, re-notify existing online listeners so sync,
 * purchase refreshes and revocation checks can resume without duplicating each
 * feature's lifecycle logic.
 */
export function AppResumeBridge() {
  const lastRefresh = useRef(0);

  useEffect(() => {
    const refreshOnlineWorkflows = () => {
      if (!navigator.onLine) return;
      const now = Date.now();
      if (now - lastRefresh.current < RESUME_THROTTLE_MS) return;
      lastRefresh.current = now;
      window.dispatchEvent(new Event("online"));
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") refreshOnlineWorkflows();
    };

    window.addEventListener("focus", refreshOnlineWorkflows);
    window.addEventListener("pageshow", refreshOnlineWorkflows);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("focus", refreshOnlineWorkflows);
      window.removeEventListener("pageshow", refreshOnlineWorkflows);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  return null;
}
