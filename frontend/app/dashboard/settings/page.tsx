"use client";

import { motion } from "framer-motion";
import { User, Shield, Palette, SmartphoneNfc, Loader2, Check } from "lucide-react";
import { GlassCard } from "@/components/ui";
import { useWebPush } from "@/lib/useWebPush";
import { useState, useEffect } from "react";
import Link from "next/link";
import { notificationsApi, type NotificationPreference } from "@/lib/api";

const ToggleSwitch = ({ checked, onChange, disabled }: { checked: boolean; onChange: () => void; disabled?: boolean }) => (
  <button
    onClick={onChange}
    disabled={disabled}
    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-trippy-500 focus:ring-offset-2 ${
      checked ? 'bg-trippy-500' : 'bg-gray-200 dark:bg-gray-700'
    } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
  >
    <span
      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
        checked ? 'translate-x-6' : 'translate-x-1'
      }`}
    />
  </button>
);

const categories = [
  {
    type: 'TRIP_INVITE',
    label: 'Trip Invitations',
    desc: 'When someone invites you to join their trip',
  },
  {
    type: 'TRIP_JOINED',
    label: 'Trip Join Activities',
    desc: 'When someone accepts your invitation or joins your trip',
  },
  {
    type: 'TRIP_UPDATED',
    label: 'Trip Plan Updates',
    desc: 'When details of a trip you are participating in are changed',
  },
  {
    type: 'ITINERARY_READY',
    label: 'AI Itinerary Ready',
    desc: 'When your requested AI trip plan is generated and ready to view',
  },
  {
    type: 'PAYMENT_SUCCESS',
    label: 'Payments & Billings',
    desc: 'Receipts, billing alerts, and subscription changes',
  },
  {
    type: 'SYSTEM',
    label: 'System Announcements',
    desc: 'Important security updates and platform news from Trippy',
  },
];

export default function SettingsPage() {
  const { isSupported, isSubscribed, subscribe, unsubscribe } = useWebPush();
  const [pushLoading, setPushLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'general' | 'notifications'>('general');

  // Preferences states
  const [preferences, setPreferences] = useState<NotificationPreference[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    async function loadPrefs() {
      try {
        const data = await notificationsApi.getPreferences();
        setPreferences(data);
      } catch (err) {
        console.error("Failed to load preferences", err);
        setError("Failed to load notification preferences.");
      } finally {
        setLoading(false);
      }
    }
    if (activeTab === 'notifications') {
      loadPrefs();
    }
  }, [activeTab]);

  const handlePushToggle = async () => {
    setPushLoading(true);
    if (isSubscribed) {
      await unsubscribe();
    } else {
      await subscribe();
    }
    setPushLoading(false);
  };

  const handlePreferenceChange = async (type: string, channel: 'email' | 'push' | 'inApp', value: boolean) => {
    const updatedPreferences = preferences.map(pref => {
      if (pref.type === type) {
        return {
          ...pref,
          [`${channel}Enabled`]: value
        };
      }
      return pref;
    });

    setPreferences(updatedPreferences);
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const targetPref = updatedPreferences.find(p => p.type === type);
      if (!targetPref) return;

      await notificationsApi.updatePreferences([{
        type: targetPref.type,
        emailEnabled: targetPref.emailEnabled,
        pushEnabled: targetPref.pushEnabled,
        inAppEnabled: targetPref.inAppEnabled
      }]);

      setSuccess("Changes saved");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error("Failed to update preferences", err);
      setError("Failed to save changes. Reverting...");
      const original = await notificationsApi.getPreferences();
      setPreferences(original);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8 max-w-4xl">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Settings</h1>
        <p className="mt-1 text-muted">Manage your account and preferences</p>
      </motion.div>

      {/* Tabs Switcher */}
      <div className="flex border-b border-border">
        <button
          onClick={() => setActiveTab('general')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-[2px] ${
            activeTab === 'general'
              ? 'border-trippy-500 text-trippy-500'
              : 'border-transparent text-muted hover:text-foreground'
          }`}
        >
          General Settings
        </button>
        <button
          onClick={() => setActiveTab('notifications')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-[2px] ${
            activeTab === 'notifications'
              ? 'border-trippy-500 text-trippy-500'
              : 'border-transparent text-muted hover:text-foreground'
          }`}
        >
          Notification Settings
        </button>
      </div>

      {activeTab === 'general' ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Link href="/dashboard/profile">
            <GlassCard className="flex items-start gap-4 cursor-pointer hover:bg-surface-hover transition-all h-full">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-trippy-500/10">
                <User size={20} className="text-trippy-500" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">Profile</h3>
                <p className="text-sm text-muted mt-1">Update your name, bio, avatar, and contact info</p>
              </div>
            </GlassCard>
          </Link>

          <Link href="/dashboard/settings/security">
            <GlassCard className="flex items-start gap-4 cursor-pointer hover:bg-surface-hover transition-all h-full">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-trippy-500/10">
                <Shield size={20} className="text-trippy-500" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">Security</h3>
                <p className="text-sm text-muted mt-1">Change your password and manage sessions</p>
              </div>
            </GlassCard>
          </Link>

          <GlassCard className="flex items-start gap-4 cursor-not-allowed opacity-75 hover:bg-surface transition-all h-full">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-trippy-500/10">
              <Palette size={20} className="text-trippy-500" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Appearance</h3>
              <p className="text-sm text-muted mt-1">Toggle dark mode and customize your theme (coming soon)</p>
            </div>
          </GlassCard>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Global Push Toggle */}
          <GlassCard className="flex flex-col gap-4">
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-trippy-500/10">
                <SmartphoneNfc size={20} className="text-trippy-500" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold">Browser Push Notifications</h3>
                <p className="text-sm text-muted mt-1">Subscribe this device to receive real-time push alerts</p>
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
          </GlassCard>

          {/* Preferences matrix */}
          <GlassCard className="space-y-4">
            <div className="flex items-center justify-between pb-4 border-b border-border">
              <div>
                <h3 className="text-lg font-semibold">Preferences Matrix</h3>
                <p className="text-sm text-muted">Configure your notification preferences per category</p>
              </div>
              <div className="flex items-center gap-2 text-sm font-medium">
                {saving && (
                  <span className="flex items-center gap-1 text-trippy-500">
                    <Loader2 size={14} className="animate-spin" /> Saving...
                  </span>
                )}
                {success && (
                  <span className="flex items-center gap-1 text-green-500">
                    <Check size={14} /> {success}
                  </span>
                )}
                {error && (
                  <span className="text-red-500">{error}</span>
                )}
              </div>
            </div>

            {loading ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted gap-2">
                <Loader2 size={32} className="animate-spin text-trippy-500" />
                <span>Loading preferences...</span>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-border text-xs uppercase text-muted tracking-wider">
                      <th className="py-3 pr-4 font-semibold">Activity Category</th>
                      <th className="py-3 px-4 font-semibold text-center">In-App Feed</th>
                      <th className="py-3 px-4 font-semibold text-center">Email</th>
                      <th className="py-3 pl-4 font-semibold text-center">Browser Push</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {categories.map((cat) => {
                      const pref = preferences.find(p => p.type === cat.type) || {
                        emailEnabled: true,
                        pushEnabled: true,
                        inAppEnabled: true
                      };

                      return (
                        <tr key={cat.type} className="hover:bg-white/5 transition-colors">
                          <td className="py-4 pr-4">
                            <h4 className="font-medium text-sm text-foreground">{cat.label}</h4>
                            <p className="text-xs text-muted mt-0.5">{cat.desc}</p>
                          </td>
                          <td className="py-4 px-4 text-center">
                            <div className="flex justify-center">
                              <ToggleSwitch
                                checked={pref.inAppEnabled}
                                onChange={() => handlePreferenceChange(cat.type, 'inApp', !pref.inAppEnabled)}
                                disabled={saving}
                              />
                            </div>
                          </td>
                          <td className="py-4 px-4 text-center">
                            <div className="flex justify-center">
                              <ToggleSwitch
                                checked={pref.emailEnabled}
                                onChange={() => handlePreferenceChange(cat.type, 'email', !pref.emailEnabled)}
                                disabled={saving}
                              />
                            </div>
                          </td>
                          <td className="py-4 pl-4 text-center">
                            <div className="flex justify-center">
                              <ToggleSwitch
                                checked={pref.pushEnabled}
                                onChange={() => handlePreferenceChange(cat.type, 'push', !pref.pushEnabled)}
                                disabled={saving || !isSubscribed}
                              />
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {!isSubscribed && (
                  <div className="mt-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-500 flex gap-2">
                    <span>⚠️</span>
                    <span>
                      Browser Push toggles are disabled because this device is not subscribed. Enable <strong>Browser Push Notifications</strong> above to customize push settings.
                    </span>
                  </div>
                )}
              </div>
            )}
          </GlassCard>
        </div>
      )}
    </div>
  );
}
