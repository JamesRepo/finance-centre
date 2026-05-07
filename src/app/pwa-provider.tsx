"use client";

import { useEffect, useState } from "react";

export function PwaProvider() {
  const [offline, setOffline] = useState(
    typeof navigator !== "undefined" ? !navigator.onLine : false,
  );

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Service worker registration failed — non-critical
      });
    }
  }, []);

  useEffect(() => {
    function handleOffline() {
      setOffline(true);
    }
    function handleOnline() {
      setOffline(false);
    }

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);

    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  if (!offline) return null;

  return (
    <div
      role="status"
      className="fixed bottom-0 left-0 right-0 z-50 bg-red-900/90 px-4 py-2 text-center text-sm text-red-100"
    >
      You are offline. Some features may be unavailable.
    </div>
  );
}
