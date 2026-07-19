"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { GlassCard, Avatar, Button, Badge } from "@/components/ui";
import Input from "@/components/ui/Input";
import { useAuth } from "@/lib/auth-context";
import { updateProfile, deleteAccount, type UpdateProfileRequest } from "@/lib/api";
import { Mail, Phone, MapPin, LogOut, ShieldCheck, Save, X, Pencil, Trash2, AlertTriangle } from "lucide-react";

export default function ProfilePage() {
  const { user, setUser, logout } = useAuth();
  const router = useRouter();

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [form, setForm] = useState<UpdateProfileRequest>({
    displayName: user?.displayName ?? "",
    bio: user?.bio ?? "",
    phoneNumber: user?.phoneNumber ?? "",
    country: user?.country ?? "",
  });

  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof UpdateProfileRequest, string>>>({});

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setFieldErrors((prev) => ({ ...prev, [e.target.name]: undefined }));
    setSuccess(false);
    setError(null);
  }

  function validate(): boolean {
    const errs: typeof fieldErrors = {};
    if (!form.displayName?.trim()) errs.displayName = "Display name is required";
    else if (form.displayName.length > 100) errs.displayName = "Max 100 characters";
    if (form.bio && form.bio.length > 500) errs.bio = "Max 500 characters";
    if (form.phoneNumber && form.phoneNumber.length > 20) errs.phoneNumber = "Max 20 characters";
    if (form.country && form.country.length > 100) errs.country = "Max 100 characters";
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSave() {
    if (!validate()) return;
    setSaving(true);
    setError(null);
    try {
      const payload: UpdateProfileRequest = {};
      if (form.displayName !== user?.displayName) payload.displayName = form.displayName;
      if (form.bio !== (user?.bio ?? "")) payload.bio = form.bio;
      if (form.phoneNumber !== (user?.phoneNumber ?? "")) payload.phoneNumber = form.phoneNumber;
      if (form.country !== (user?.country ?? "")) payload.country = form.country;

      const updated = await updateProfile(payload);
      setUser({ ...user!, ...updated });
      setEditing(false);
      setSuccess(true);
    } catch {
      setError("Failed to save changes. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    setForm({
      displayName: user?.displayName ?? "",
      bio: user?.bio ?? "",
      phoneNumber: user?.phoneNumber ?? "",
      country: user?.country ?? "",
    });
    setFieldErrors({});
    setError(null);
    setEditing(false);
  }

  async function handleLogout() {
    setLoggingOut(true);
    await logout();
    router.replace("/login");
  }

  async function handleDeleteAccount() {
    if (!deletePassword) {
      setDeleteError("Please enter your password to confirm.");
      return;
    }
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteAccount(deletePassword);
      await logout();
      router.replace("/");
    } catch {
      setDeleteError("Failed to delete account. Please check your password.");
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-8 max-w-2xl">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Profile</h1>
        <p className="mt-1 text-muted">Manage your personal information</p>
      </motion.div>

      {/* Profile header card */}
      <GlassCard className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
        <Avatar name={user?.displayName ?? "User"} src={user?.avatarUrl} size="lg" />
        <div className="flex-1 text-center sm:text-left">
          <div className="flex items-center gap-2 justify-center sm:justify-start">
            <h2 className="text-xl font-bold">{user?.displayName ?? "Unknown"}</h2>
            {user?.role && (
              <Badge variant={user.role === "HOST" ? "accent" : user.role === "ADMIN" ? "danger" : "default"}>
                <ShieldCheck size={11} className="mr-1" />
                {user.role}
              </Badge>
            )}
          </div>
          <div className="mt-2 flex flex-col gap-1 text-sm text-muted">
            {user?.email && (
              <p className="flex items-center gap-2 justify-center sm:justify-start">
                <Mail size={14} /> {user.email}
              </p>
            )}
            {user?.phoneNumber && (
              <p className="flex items-center gap-2 justify-center sm:justify-start">
                <Phone size={14} /> {user.phoneNumber}
              </p>
            )}
            {user?.country && (
              <p className="flex items-center gap-2 justify-center sm:justify-start">
                <MapPin size={14} /> {user.country}
              </p>
            )}
          </div>
          {user?.bio && <p className="mt-3 text-sm">{user.bio}</p>}
        </div>
        {!editing && (
          <Button variant="secondary" size="sm" onClick={() => { setEditing(true); setSuccess(false); }}>
            <Pencil size={14} /> Edit
          </Button>
        )}
      </GlassCard>

      {/* Edit form */}
      {editing && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <GlassCard className="space-y-5">
            <h3 className="text-base font-semibold">Edit Profile</h3>

            <Input
              id="displayName"
              name="displayName"
              label="Display Name"
              value={form.displayName}
              onChange={handleChange}
              error={fieldErrors.displayName}
              placeholder="How others see your name"
              maxLength={100}
            />

            <div className="flex flex-col gap-1.5">
              <label htmlFor="bio" className="text-sm font-medium text-foreground">Bio</label>
              <textarea
                id="bio"
                name="bio"
                value={form.bio}
                onChange={handleChange}
                rows={3}
                maxLength={500}
                placeholder="A short description about yourself"
                className="rounded-xl border border-border bg-surface px-4 py-2.5 text-sm text-foreground placeholder:text-muted shadow-sm outline-none transition-all duration-200 focus:border-trippy-500 focus:shadow-md resize-none"
              />
              <div className="flex justify-between">
                {fieldErrors.bio ? <p className="text-xs text-danger">{fieldErrors.bio}</p> : <span />}
                <p className="text-xs text-muted">{(form.bio ?? "").length}/500</p>
              </div>
            </div>

            <Input
              id="phoneNumber"
              name="phoneNumber"
              label="Phone Number"
              value={form.phoneNumber}
              onChange={handleChange}
              error={fieldErrors.phoneNumber}
              placeholder="+1 555 000 0000"
              maxLength={20}
            />

            <Input
              id="country"
              name="country"
              label="Country"
              value={form.country}
              onChange={handleChange}
              error={fieldErrors.country}
              placeholder="e.g. Germany"
              maxLength={100}
            />

            {error && <p className="text-sm text-danger">{error}</p>}

            <div className="flex gap-3 pt-1">
              <Button onClick={handleSave} disabled={saving}>
                <Save size={14} />
                {saving ? "Saving…" : "Save Changes"}
              </Button>
              <Button variant="secondary" onClick={handleCancel} disabled={saving}>
                <X size={14} /> Cancel
              </Button>
            </div>
          </GlassCard>
        </motion.div>
      )}

      {/* Success banner */}
      {success && !editing && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-400"
        >
          Profile updated successfully.
        </motion.div>
      )}

      {/* Danger zone */}
      <GlassCard className="border-red-500/20">
        <h3 className="text-base font-semibold">Danger Zone</h3>
        <p className="mt-1 text-sm text-muted">Sign out of your account on this device.</p>
        <div className="mt-4">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleLogout}
            disabled={loggingOut}
            className="border-red-500/40 text-red-500 hover:bg-red-500/10"
          >
            <LogOut size={14} />
            {loggingOut ? "Signing out…" : "Sign out"}
          </Button>
        </div>

        <div className="mt-6 border-t border-red-500/20 pt-5">
          <h4 className="text-sm font-semibold text-red-500">Delete Account</h4>
          <p className="mt-1 text-sm text-muted">
            Permanently delete your account and all associated data. This action cannot be undone.
          </p>
          <div className="mt-4">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setShowDeleteModal(true);
                setDeletePassword("");
                setDeleteError(null);
              }}
              className="border-red-500/40 text-red-500 hover:bg-red-500/10"
            >
              <Trash2 size={14} />
              Delete my account
            </Button>
          </div>
        </div>
      </GlassCard>

      {/* Delete confirmation modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md"
          >
            <GlassCard className="space-y-4 border-red-500/30">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-500/10">
                  <AlertTriangle size={20} className="text-red-500" />
                </div>
                <h3 className="text-base font-semibold">Delete your account?</h3>
              </div>
              <p className="text-sm text-muted">
                This will permanently remove your profile, preferences, and sessions. Trips you
                created may become inaccessible to other participants. This cannot be undone.
              </p>
              <Input
                id="deletePassword"
                name="deletePassword"
                type="password"
                label="Confirm with your password"
                value={deletePassword}
                onChange={(e) => {
                  setDeletePassword(e.target.value);
                  setDeleteError(null);
                }}
                placeholder="Enter your password"
                autoComplete="current-password"
              />
              {deleteError && <p className="text-sm text-danger">{deleteError}</p>}
              <div className="flex gap-3 pt-1">
                <Button
                  size="sm"
                  onClick={handleDeleteAccount}
                  disabled={deleting}
                  className="bg-red-600 hover:bg-red-700 text-white border-transparent"
                >
                  <Trash2 size={14} />
                  {deleting ? "Deleting…" : "Delete permanently"}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowDeleteModal(false)}
                  disabled={deleting}
                >
                  Cancel
                </Button>
              </div>
            </GlassCard>
          </motion.div>
        </div>
      )}
    </div>
  );
}
