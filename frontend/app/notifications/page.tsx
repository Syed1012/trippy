"use client";

import NotificationsPage from "../dashboard/notifications/page";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import AmbientBackground from "@/components/layout/AmbientBackground";
import { Button } from "@/components/ui";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

export default function NotificationsPageWrapper() {
  const router = useRouter();

  return (
    <div className="relative isolate min-h-screen overflow-x-hidden bg-[#f8efe1] text-[#18211f] flex flex-col">
      <AmbientBackground />
      <Navbar variant="landing" />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-8 lg:py-12 z-10 space-y-6">
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => router.back()}
            className="flex items-center gap-1.5 font-bold cursor-pointer"
          >
            <ArrowLeft size={16} />
            Go Back
          </Button>
        </div>

        <div className="glass-strong rounded-3xl p-6 lg:p-10 border border-white/30 min-h-[50vh] shadow-[0_8px_32px_0_rgba(20,47,43,0.03)]">
          <NotificationsPage />
        </div>
      </main>

      <Footer />
    </div>
  );
}
