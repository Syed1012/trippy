"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const allowGuestTripView = /^\/dashboard\/trips\/[^/]+$/.test(pathname ?? "");

  useEffect(() => {
    if (!isLoading && !isAuthenticated && !allowGuestTripView) {
      router.replace("/login");
    }
  }, [allowGuestTripView, isLoading, isAuthenticated, router]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-trippy-500 border-t-transparent" />
      </div>
    );
  }

  if (!isAuthenticated && !allowGuestTripView) return null;
  return <>{children}</>;
}
