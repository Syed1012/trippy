"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, KeyRound, Save, ShieldCheck } from "lucide-react";
import { GlassCard, Button } from "@/components/ui";
import Input from "@/components/ui/Input";
import { changePassword } from "@/lib/api";
import { ROUTES } from "@/lib/routes";

export default function SecuritySettingsPage() {
  const router = useRouter();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{
    currentPassword?: string;
    newPassword?: string;
    confirmPassword?: string;
  }>({});

  function validate(): boolean {
    const errs: typeof fieldErrors = {};
    if (!currentPassword) errs.currentPassword = "Current password is required";
    if (!newPassword) errs.newPassword = "New password is required";
    else if (newPassword.length < 8) errs.newPassword = "Must be at least 8 characters";
    else if (newPassword === currentPassword)
      errs.newPassword = "New password must be different from the current one";
    if (confirmPassword !== newPassword) errs.confirmPassword = "Passwords do not match";
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    if (!validate()) return;

    setSaving(true);
    try {
      await changePassword(currentPassword, newPassword);
      setSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      const message =
        err instanceof Error && err.message.includes("400")
          ? "Current password is incorrect."
          : "Failed to change password. Please check your current password and try again.";
      setError(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-8 max-w-2xl">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <button
          type="button"
          onClick={() => router.push(ROUTES.dashboardSettings)}
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground transition-colors"
        >
          <ArrowLeft size={16} /> Back to Settings
        </button>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Security</h1>
        <p className="mt-1 text-muted">Change your password and manage account security</p>
      </motion.div>

      <GlassCard className="space-y-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-trippy-500/10">
            <KeyRound size={20} className="text-trippy-500" />
          </div>
          <div>
            <h3 className="font-semibold">Change Password</h3>
            <p className="text-sm text-muted">
              Changing your password signs you out of all other devices
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            id="currentPassword"
            name="currentPassword"
            type="password"
            label="Current Password"
            value={currentPassword}
            onChange={(e) => {
              setCurrentPassword(e.target.value);
              setFieldErrors((p) => ({ ...p, currentPassword: undefined }));
            }}
            error={fieldErrors.currentPassword}
            placeholder="Enter your current password"
            autoComplete="current-password"
          />

          <Input
            id="newPassword"
            name="newPassword"
            type="password"
            label="New Password"
            value={newPassword}
            onChange={(e) => {
              setNewPassword(e.target.value);
              setFieldErrors((p) => ({ ...p, newPassword: undefined }));
            }}
            error={fieldErrors.newPassword}
            placeholder="At least 8 characters"
            autoComplete="new-password"
          />

          <Input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            label="Confirm New Password"
            value={confirmPassword}
            onChange={(e) => {
              setConfirmPassword(e.target.value);
              setFieldErrors((p) => ({ ...p, confirmPassword: undefined }));
            }}
            error={fieldErrors.confirmPassword}
            placeholder="Repeat the new password"
            autoComplete="new-password"
          />

          {error && <p className="text-sm text-danger">{error}</p>}

          {success && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2 rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-400"
            >
              <ShieldCheck size={16} />
              Password changed successfully. Other sessions have been signed out.
            </motion.div>
          )}

          <div className="pt-1">
            <Button type="submit" disabled={saving}>
              <Save size={14} />
              {saving ? "Saving…" : "Change Password"}
            </Button>
          </div>
        </form>
      </GlassCard>
    </div>
  );
}
