"use client";

import Navbar from "@/components/layout/Navbar";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import AmbientBackground from "@/components/layout/AmbientBackground";
import { RightRailProvider, useRightRail } from "@/lib/right-rail";
import { AIGenerationProvider } from "@/lib/ai-generation";
import { cn } from "@/lib/utils";

/** Main content region that reflows to fill the space left of the right rail. */
function ShellMain({ children }: { children: React.ReactNode }) {
  const { reserve, dragging } = useRightRail();
  return (
    <main
      className={cn(
        "relative z-10 px-4 py-8 lg:px-8",
        reserve > 0 ? "max-w-none" : "mx-auto max-w-7xl",
        dragging ? "" : "transition-[margin,max-width] duration-300 ease-out",
      )}
      style={{ marginRight: reserve > 0 ? reserve : undefined }}
    >
      {children}
    </main>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProtectedRoute>
      <RightRailProvider>
        <AIGenerationProvider>
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

            <ShellMain>{children}</ShellMain>
          </div>
        </AIGenerationProvider>
      </RightRailProvider>
    </ProtectedRoute>
  );
}
