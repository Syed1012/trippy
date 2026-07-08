"use client";

import Navbar from "@/components/layout/Navbar";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import AmbientBackground from "@/components/layout/AmbientBackground";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProtectedRoute>
      <div className="neu-scope relative min-h-screen">
        {/* Landing-matched ambient scene */}
        <AmbientBackground />

        {/* Warm aurora accents layered over the scene for depth */}
        <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
          <div className="absolute -top-44 -left-36 h-[540px] w-[540px] rounded-full bg-accent-400/12 blur-3xl" />
          <div className="absolute top-1/4 -right-44 h-[480px] w-[480px] rounded-full bg-trippy-500/10 blur-3xl" />
          <div className="absolute bottom-[-6rem] left-1/3 h-[420px] w-[420px] rounded-full bg-accent-300/10 blur-3xl" />
        </div>

        <Navbar />

        <main className="relative z-10 mx-auto max-w-7xl px-4 py-8 lg:px-8">
          {children}
        </main>
      </div>
    </ProtectedRoute>
  );
}
