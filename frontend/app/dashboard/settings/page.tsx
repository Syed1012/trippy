"use client";

import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { User, Bell, Shield, Palette, Moon, Sun, ChevronRight } from "lucide-react";
import { GlassCard } from "@/components/ui";
import { useTheme } from "@/lib/useTheme";
import { ROUTES } from "@/lib/routes";

export default function SettingsPage() {
  const router = useRouter();
  const { theme, toggle } = useTheme();

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

        {/* Notifications — navigates to notification settings */}
        <button
          type="button"
          onClick={() => router.push(ROUTES.dashboardNotifications)}
          className="text-left"
          aria-label="Open notification settings"
        >
          <GlassCard className="flex h-full items-start gap-4 cursor-pointer hover:bg-surface-hover transition-all">
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
          </GlassCard>
        </button>

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
              className="mt-3 inline-flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-sm font-medium
                         text-foreground hover:bg-surface-hover transition-colors"
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
