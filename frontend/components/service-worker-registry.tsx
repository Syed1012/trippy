"use client";
import { useEffect } from "react";
import { useWebPush } from "@/lib/useWebPush";
import { useAuth } from "@/lib/auth-context";

export function ServiceWorkerRegistry() {
  const { subscribe, permission } = useWebPush();
  const { user } = useAuth();

  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((registration) => console.log("Service Worker registered with scope:", registration.scope))
        .catch((error) => console.error("Service Worker registration failed:", error));
    }
  }, []);

  // Ask for permission automatically if user is logged in and permission is unasked
  useEffect(() => {
    if (user && permission === "default") {
      // Small delay to let the app render first before popping the browser prompt
      const timer = setTimeout(() => {
        subscribe().catch(console.error);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [user, permission, subscribe]);
  
  return null;
}
