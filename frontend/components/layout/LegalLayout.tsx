"use client";

import React from "react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import AmbientBackground from "@/components/layout/AmbientBackground";

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative isolate min-h-screen overflow-x-hidden bg-[#f8efe1] text-[#18211f] flex flex-col">
      <AmbientBackground />

      <Navbar variant="landing" />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-8 lg:py-12 z-10">
        <div className="glass-strong rounded-3xl p-6 lg:p-10 border border-white/30 min-h-[50vh] shadow-[0_8px_32px_0_rgba(20,47,43,0.03)]">
          {children}
        </div>
      </main>

      <Footer />
    </div>
  );
}
