"use client";

import Navbar from "@/components/layout/Navbar";
import ProtectedRoute from "@/components/auth/ProtectedRoute";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProtectedRoute>
      <div className="neu-scope min-h-screen bg-background">
        {/* Decorative gradient blobs */}
        <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
          <div className="absolute -top-40 -left-40 h-[500px] w-[500px] rounded-full bg-trippy-600/10 blur-3xl" />
          <div className="absolute top-1/3 -right-32 h-[400px] w-[400px] rounded-full bg-accent-500/8 blur-3xl" />
          <div className="absolute bottom-0 left-1/2 h-[350px] w-[350px] -translate-x-1/2 rounded-full bg-trippy-400/6 blur-3xl" />
        </div>

        <Navbar />

        <main className="mx-auto max-w-7xl px-4 py-8 lg:px-8">
          {children}
        </main>
      </div>
    </ProtectedRoute>
  );
}
