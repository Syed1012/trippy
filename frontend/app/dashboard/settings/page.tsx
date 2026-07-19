"use client";

import { motion } from "framer-motion";
import { Settings, User, Bell, Shield, Palette, SmartphoneNfc, Loader2 } from "lucide-react";
import { GlassCard } from "@/components/ui";
import { useWebPush } from "@/lib/useWebPush";
import { useState } from "react";

export default function SettingsPage() {
  const { isSupported, isSubscribed, subscribe, unsubscribe } = useWebPush();
  const [pushLoading, setPushLoading] = useState(false);

  const handlePushToggle = async () => {
    setPushLoading(true);
    if (isSubscribed) {
      await unsubscribe();
    } else {
      await subscribe();
    }
    setPushLoading(false);
  };

  return (
    <div className="space-y-8">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Settings</h1>
        <p className="mt-1 text-muted">Manage your account and preferences</p>
      </motion.div>

      <div className="grid gap-4 sm:grid-cols-2">
        <GlassCard className="flex items-start gap-4 cursor-pointer hover:bg-surface-hover transition-all">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-trippy-500/10">
            <User size={20} className="text-trippy-500" />
          </div>
          <div>
            <h3 className="font-semibold">Profile</h3>
            <p className="text-sm text-muted mt-1">Update your name, bio, avatar, and contact info</p>
          </div>
        </GlassCard>

        <GlassCard className="flex flex-col gap-4">
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-trippy-500/10">
              <Bell size={20} className="text-trippy-500" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold">Notifications</h3>
              <p className="text-sm text-muted mt-1">Configure email and push notification preferences</p>
            </div>
          </div>
          <div className="mt-2 border-t border-border pt-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <SmartphoneNfc size={16} className="text-muted" />
                <span className="text-sm font-medium">Browser Push Notifications</span>
              </div>
              {isSupported ? (
                <button
                  onClick={handlePushToggle}
                  disabled={pushLoading}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-trippy-500 focus:ring-offset-2 ${
                    isSubscribed ? 'bg-trippy-500' : 'bg-gray-200 dark:bg-gray-700'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      isSubscribed ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              ) : (
                <span className="text-xs text-muted">Not Supported</span>
              )}
            </div>
          </div>
        </GlassCard>

        <GlassCard className="flex items-start gap-4 cursor-pointer hover:bg-surface-hover transition-all">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-trippy-500/10">
            <Shield size={20} className="text-trippy-500" />
          </div>
          <div>
            <h3 className="font-semibold">Security</h3>
            <p className="text-sm text-muted mt-1">Change your password and manage sessions</p>
          </div>
        </GlassCard>

        <GlassCard className="flex items-start gap-4 cursor-pointer hover:bg-surface-hover transition-all">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-trippy-500/10">
            <Palette size={20} className="text-trippy-500" />
          </div>
          <div>
            <h3 className="font-semibold">Appearance</h3>
            <p className="text-sm text-muted mt-1">Toggle dark mode and customize your theme</p>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
