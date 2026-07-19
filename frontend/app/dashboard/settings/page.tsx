"use client";

import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  User,
  Bell,
  Shield,
  Palette,
  Moon,
  Sun,
  ChevronRight,
  SmartphoneNfc,
  Loader2,
} from "lucide-react";
import { GlassCard } from "@/components/ui";
import { useTheme } from "@/lib/useTheme";
import { ROUTES } from "@/lib/routes";
import { useWebPush } from "@/lib/useWebPush";
import { useState } from "react";

export default function SettingsPage() {
  const router = useRouter();
  const { theme, toggle } = useTheme();
  const { isSupported, isSubscribed, subscribe, unsubscribe } = useWebPush();
  const [pushLoading, setPushLoading] = useState(false);

  const handlePushToggle = async () => {
    setPushLoading(true);
    try {
      if (isSubscribed) {
        await unsubscribe();
      } else {
        await subscribe();
      }
    } finally {
      setPushLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Settings</h1>
        <p className="mt-1 text-muted">Manage your account and preferences</p>
      </motion.div>

      <div className="grid gap-4 sm:grid-cols-2">
        {/* Profile — navigates to the profile page */}
        <button
          type="button"
          onClick={() => router.push(ROUTES.dashboardProfile)}
          className="text-left"
          aria-label="Open profile settings"
        >
          <GlassCard className="flex h-full items-start gap-4 cursor-pointer hover:bg-surface-hover transition-all">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-trippy-500/10">
              <User size={20} className="text-trippy-500" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold flex items-center gap-1">
                Profile
                <ChevronRight size={16} className="text-muted" />
              </h3>
              <p className="text-sm text-muted mt-1">
                Update your name, bio, avatar, and contact info
              </p>
            </div>
          </GlassCard>
        </button>

        <GlassCard className="flex flex-col gap-4">
          <button
            type="button"
            onClick={() => router.push(ROUTES.dashboardNotifications)}
            className="text-left"
            aria-label="Open notification settings"
          >
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-trippy-500/10">
                <Bell size={20} className="text-trippy-500" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold flex items-center gap-1">
                  Notifications
                  <ChevronRight size={16} className="text-muted" />
                </h3>
                <p className="text-sm text-muted mt-1">
                  Configure email and push notification preferences
                </p>
              </div>
            </div>
          </button>
          <div className="mt-2 border-t border-border pt-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <SmartphoneNfc size={16} className="text-muted" />
                <span className="text-sm font-medium">Browser Push Notifications</span>
              </div>
              {isSupported ? (
                <button
                  type="button"
                  onClick={handlePushToggle}
                  disabled={pushLoading}
                  aria-label={isSubscribed ? "Disable browser push notifications" : "Enable browser push notifications"}
                  className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-trippy-500 focus:ring-offset-2 ${
                    isSubscribed ? "bg-trippy-500" : "bg-gray-200 dark:bg-gray-700"
                  } ${pushLoading ? "cursor-not-allowed opacity-70" : ""}`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      isSubscribed ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              ) : (
                <span className="text-xs text-muted">Not Supported</span>
              )}
            </div>
            {pushLoading ? (
              <div className="mt-2 flex items-center gap-2 text-xs text-muted">
                <Loader2 size={14} className="animate-spin" />
                Updating push notification setting...
              </div>
            ) : null}
          </div>
        </GlassCard>

        {/* Security — change password lands in an upcoming release */}
        <GlassCard className="flex h-full items-start gap-4 opacity-60" aria-disabled="true">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-trippy-500/10">
            <Shield size={20} className="text-trippy-500" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold flex items-center gap-2">
              Security
              <span className="rounded-full bg-trippy-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-trippy-500">
                Coming soon
              </span>
            </h3>
            <p className="text-sm text-muted mt-1">
              Change your password and manage sessions
            </p>
          </div>
        </GlassCard>

        {/* Appearance — inline dark mode toggle */}
        <GlassCard className="flex h-full items-start gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-trippy-500/10">
            <Palette size={20} className="text-trippy-500" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold">Appearance</h3>
            <p className="text-sm text-muted mt-1">
              Toggle dark mode and customize your theme
            </p>
            <button
              type="button"
              onClick={toggle}
              role="switch"
              aria-checked={theme === "dark"}
              aria-label="Toggle dark mode"
              className="mt-3 inline-flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-surface-hover transition-colors"
            >
              {theme === "light" ? <Moon size={16} /> : <Sun size={16} />}
              {theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
            </button>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
