"use client";

import { useState, useEffect, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Mail, Lock, ArrowRight, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import Logo from "@/components/Logo";
import { GlassCard, Button, Input } from "@/components/ui";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/lib/toast";
import { ApiError } from "@/lib/api";
import { ROUTES } from "@/lib/routes";

export default function LoginPage() {
  const router = useRouter();
  const { login, isAuthenticated, isLoading: authLoading } = useAuth();
  const { addToast } = useToast();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [registered, setRegistered] = useState(false);
  const [verified, setVerified] = useState(false);
  const [nextUrl, setNextUrl] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const isRegistered = params.get("registered") === "true";
    const isVerified = params.get("verified") === "true";
    const queryEmail = params.get("email");
    const queryNext = params.get("next");

    setRegistered(isRegistered);
    setVerified(isVerified);
    if (queryNext) {
      setNextUrl(queryNext);
    }

    if ((isRegistered || isVerified) && queryEmail) {
      setEmail(queryEmail);
    }
  }, []);

  // Redirect authenticated users away from login
  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      router.replace(nextUrl || ROUTES.home);
    }
  }, [authLoading, isAuthenticated, router, nextUrl]);

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!email.trim()) errs.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      errs.email = "Invalid email format";
    if (!password) errs.password = "Password is required";
    else if (password.length < 8)
      errs.password = "Must be at least 8 characters";
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!validate()) return;
    setLoading(true);

    try {
      await login(email, password, rememberMe);
      addToast("Welcome back!", "success");
      router.push(nextUrl || ROUTES.home);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 401) {
          setError("Invalid email or password");
        } else {
          setError(
            typeof err.body?.message === "string"
              ? err.body.message
              : "Login failed. Please try again.",
          );
        }
        addToast("Login failed", "error");
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
        <div className="absolute -top-40 -right-40 h-[500px] w-[500px] rounded-full bg-trippy-600/15 blur-3xl" />
        <div className="absolute bottom-0 left-0 h-[400px] w-[400px] rounded-full bg-accent-500/10 blur-3xl" />
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
          <p className="mt-3 text-muted">Welcome back, traveler</p>
        </div>

        <GlassCard variant="strong" className="space-y-5">
          <form onSubmit={handleSubmit} className="space-y-5">
            {registered && (
              <p className="rounded-lg bg-trippy-500/10 px-3 py-2 text-sm text-trippy-200">
                Your account was created. Sign in with your new credentials.
              </p>
            )}
            {verified && (
              <p className="rounded-lg bg-green-500/10 px-3 py-2 text-sm text-green-300">
                Email verified. You can sign in now.
              </p>
            )}
            {error && (
              <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">
                {error}
              </p>
            )}

            <div className="space-y-4">
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
                  onChange={(e) => { setEmail(e.target.value); setFieldErrors((p) => ({ ...p, email: "" })); }}
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
                  placeholder="Password"
                  className="pl-10"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setFieldErrors((p) => ({ ...p, password: "" })); }}
                  error={fieldErrors.password}
                  required
                />
              </div>
            </div>

            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2 text-muted">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-border bg-surface accent-trippy-500"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                />
                Remember me
              </label>
              <Link
                href={ROUTES.forgotPassword}
                className="text-trippy-400 hover:text-trippy-300 transition-colors"
              >
                Forgot password?
              </Link>
            </div>

            <Button className="w-full" size="lg" type="submit" disabled={loading}>
              {loading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <>
                  Sign in <ArrowRight size={16} />
                </>
              )}
            </Button>
          </form>

          <div className="relative my-2">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-transparent px-3 text-muted">or</span>
            </div>
          </div>

          <p className="text-center text-sm text-muted">
            Don&apos;t have an account?{" "}
            <Link
              href={nextUrl ? `${ROUTES.register}?next=${encodeURIComponent(nextUrl)}` : ROUTES.register}
              className="font-medium text-trippy-400 hover:text-trippy-300 transition-colors"
            >
              Sign up
            </Link>
          </p>
        </GlassCard>
      </motion.div>
    </div>
  );
}
