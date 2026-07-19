"use client";

import { useState, useEffect, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Mail, Lock, User, ArrowRight, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import Logo from "@/components/Logo";
import { GlassCard, Button, Input } from "@/components/ui";
import { register, ApiError, type ApiErrorBody } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/lib/toast";
import { ROUTES } from "@/lib/routes";

export default function RegisterPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { addToast } = useToast();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  // Redirect authenticated users away from register
  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      router.replace(ROUTES.home);
    }
  }, [authLoading, isAuthenticated, router]);

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!firstName.trim()) errs.firstName = "First name is required";
    if (!lastName.trim()) errs.lastName = "Last name is required";
    if (!email.trim()) errs.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      errs.email = "Invalid email format";
    if (!password) errs.password = "Password is required";
    else if (password.length < 8)
      errs.password = "Must be at least 8 characters";
    else if (!/[a-z]/.test(password))
      errs.password = "Must contain a lowercase letter";
    else if (!/[A-Z]/.test(password))
      errs.password = "Must contain an uppercase letter";
    else if (!/\d/.test(password))
      errs.password = "Must contain a number";
    else if (!/[^A-Za-z0-9]/.test(password))
      errs.password = "Must contain a special character";
    if (password !== confirmPassword)
      errs.confirmPassword = "Passwords do not match";
    if (!agreed) errs.agreed = "You must accept the Terms of Service";
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function clearFieldError(field: string) {
    setFieldErrors((p) => ({ ...p, [field]: "" }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!validate()) return;
    setLoading(true);

    try {
      const displayName = `${firstName.trim()} ${lastName.trim()}`;
      await register(email.trim(), password, displayName);
      addToast("Account created. You can sign in now.", "success");
      router.push(`${ROUTES.login}?registered=true&email=${encodeURIComponent(email.trim())}`);
    } catch (err) {
      if (err instanceof ApiError) {
        const body = err.body as ApiErrorBody;
        if (Array.isArray(body.details)) {
          const nextFieldErrors = body.details.reduce<Record<string, string>>((acc, detail) => {
            acc[detail.field] = detail.message;
            return acc;
          }, {});
          setFieldErrors((prev) => ({ ...prev, ...nextFieldErrors }));
        }

        if (err.status === 409) {
          setError("An account with this email already exists");
          setFieldErrors((p) => ({ ...p, email: "Email already registered" }));
        } else {
          setError(
            typeof body.message === "string"
              ? body.message
              : "Registration failed. Please try again.",
          );
        }
        addToast("Registration failed", "error");
      } else {
        setError("Something went wrong. Please try again.");
        addToast("Connection error", "error");
      }
    } finally {
      setLoading(false);
    }
  }

  if (authLoading || isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-trippy-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center px-4 py-12">
      {/* Ambient gradients */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-40 -left-40 h-[500px] w-[500px] rounded-full bg-accent-500/12 blur-3xl" />
        <div className="absolute bottom-20 right-0 h-[400px] w-[400px] rounded-full bg-trippy-600/15 blur-3xl" />
      </div>

      <motion.div
        className="w-full max-w-md"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <div className="mb-8 text-center">
          <Link href={ROUTES.home} className="inline-block">
            <Logo size="lg" className="justify-center" />
          </Link>
          <p className="mt-3 text-muted">Start your journey</p>
        </div>

        <GlassCard variant="strong" className="space-y-5">
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">
                {error}
              </p>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="relative">
                <User
                  size={16}
                  className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted"
                />
                <Input
                  id="firstName"
                  placeholder="First name"
                  className="pl-10"
                  value={firstName}
                  onChange={(e) => { setFirstName(e.target.value); clearFieldError("firstName"); }}
                  error={fieldErrors.firstName}
                  required
                />
              </div>
              <div className="relative">
                <User
                  size={16}
                  className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted"
                />
                <Input
                  id="lastName"
                  placeholder="Last name"
                  className="pl-10"
                  value={lastName}
                  onChange={(e) => { setLastName(e.target.value); clearFieldError("lastName"); }}
                  error={fieldErrors.lastName}
                  required
                />
              </div>
            </div>

            <div className="relative">
              <Mail
                size={16}
                className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted"
              />
              <Input
                id="email"
                type="email"
                placeholder="Email address"
                className="pl-10"
                value={email}
                onChange={(e) => { setEmail(e.target.value); clearFieldError("email"); }}
                error={fieldErrors.email}
                required
              />
            </div>

            <div className="relative">
              <Lock
                size={16}
                className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted"
              />
              <Input
                id="password"
                type="password"
                placeholder="Create password"
                className="pl-10"
                value={password}
                onChange={(e) => { setPassword(e.target.value); clearFieldError("password"); }}
                error={fieldErrors.password}
                required
                minLength={8}
              />
            </div>

            <div className="relative">
              <Lock
                size={16}
                className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted"
              />
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Confirm password"
                className="pl-10"
                value={confirmPassword}
                onChange={(e) => { setConfirmPassword(e.target.value); clearFieldError("confirmPassword"); }}
                error={fieldErrors.confirmPassword}
                required
                minLength={8}
              />
            </div>

            {/* Password strength hints */}
            <div className="space-y-1 text-xs text-muted">
              <p className={password.length >= 8 ? "text-success" : ""}>• At least 8 characters</p>
              <p className={/[a-z]/.test(password) ? "text-success" : ""}>• One lowercase letter</p>
              <p className={/[A-Z]/.test(password) ? "text-success" : ""}>• One uppercase letter</p>
              <p className={/\d/.test(password) ? "text-success" : ""}>• One number</p>
              <p className={/[^A-Za-z0-9]/.test(password) ? "text-success" : ""}>• One special character</p>
            </div>

            <label className="flex items-start gap-2 text-sm text-muted">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 rounded border-border bg-surface accent-trippy-500"
                checked={agreed}
                onChange={(e) => { setAgreed(e.target.checked); clearFieldError("agreed"); }}
              />
              <span>
                I agree to the{" "}
                <span className="text-trippy-400 cursor-pointer hover:text-trippy-300">
                  Terms of Service
                </span>{" "}
                and{" "}
                <span className="text-trippy-400 cursor-pointer hover:text-trippy-300">
                  Privacy Policy
                </span>
              </span>
            </label>
            {fieldErrors.agreed && (
              <p className="text-xs text-danger">{fieldErrors.agreed}</p>
            )}

            <Button className="w-full" size="lg" type="submit" disabled={loading}>
              {loading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <>
                  Create account <ArrowRight size={16} />
                </>
              )}
            </Button>
          </form>

          <p className="text-center text-sm text-muted">
            Already have an account?{" "}
            <Link
              href={ROUTES.login}
              className="font-medium text-trippy-400 hover:text-trippy-300 transition-colors"
            >
              Sign in
            </Link>
          </p>
        </GlassCard>
      </motion.div>
    </div>
  );
}
