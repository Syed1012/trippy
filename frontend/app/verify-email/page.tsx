"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2, Mail, ShieldCheck } from "lucide-react";
import { motion } from "framer-motion";
import Logo from "@/components/Logo";
import { Button, GlassCard, Input } from "@/components/ui";
import { ApiError, resendVerification, verifyEmail } from "@/lib/api";
import { useToast } from "@/lib/toast";
import { ROUTES } from "@/lib/routes";

export default function VerifyEmailPage() {
  const router = useRouter();
  const { addToast } = useToast();

  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [verifyError, setVerifyError] = useState("");
  const [resendError, setResendError] = useState("");
  const [loadingVerify, setLoadingVerify] = useState(false);
  const [loadingResend, setLoadingResend] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const queryEmail = params.get("email");
    if (queryEmail) {
      setEmail(queryEmail);
    }
  }, []);

  async function handleVerify(e: FormEvent) {
    e.preventDefault();
    setVerifyError("");

    if (!token.trim()) {
      setVerifyError("Verification code is required");
      return;
    }

    setLoadingVerify(true);
    try {
      await verifyEmail(token.trim());
      addToast("Email verified. You can sign in now.", "success");
      router.push(`${ROUTES.login}?verified=true&email=${encodeURIComponent(email.trim())}`);
    } catch (err) {
      if (err instanceof ApiError) {
        setVerifyError(
          typeof err.body?.message === "string"
            ? err.body.message
            : "Verification failed. Please try again.",
        );
      } else {
        setVerifyError("Something went wrong. Please try again.");
      }
    } finally {
      setLoadingVerify(false);
    }
  }

  async function handleResend(e: FormEvent) {
    e.preventDefault();
    setResendError("");

    if (!email.trim()) {
      setResendError("Email is required");
      return;
    }

    setLoadingResend(true);
    try {
      await resendVerification(email.trim());
      addToast("Verification email sent.", "success");
    } catch (err) {
      if (err instanceof ApiError) {
        setResendError(
          typeof err.body?.message === "string"
            ? err.body.message
            : "Could not resend verification email.",
        );
      } else {
        setResendError("Something went wrong. Please try again.");
      }
    } finally {
      setLoadingResend(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center px-4 py-12">
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-32 right-0 h-[420px] w-[420px] rounded-full bg-trippy-600/12 blur-3xl" />
        <div className="absolute bottom-0 left-0 h-[360px] w-[360px] rounded-full bg-accent-500/10 blur-3xl" />
      </div>

      <motion.div
        className="w-full max-w-md"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="mb-8 text-center">
          <Link href={ROUTES.home} className="inline-block">
            <Logo size="lg" className="justify-center" />
          </Link>
          <p className="mt-3 text-muted">Confirm your email to activate your account</p>
        </div>

        <GlassCard variant="strong" className="space-y-6">
          <form onSubmit={handleVerify} className="space-y-4">
            {verifyError && (
              <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">
                {verifyError}
              </p>
            )}

            <div className="relative">
              <ShieldCheck
                size={16}
                className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted"
              />
              <Input
                id="token"
                placeholder="Verification code"
                className="pl-10"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                required
              />
            </div>

            <Button className="w-full" size="lg" type="submit" disabled={loadingVerify}>
              {loadingVerify ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <>
                  Verify email <ArrowRight size={16} />
                </>
              )}
            </Button>
          </form>

          <div className="border-t border-border pt-5">
            <form onSubmit={handleResend} className="space-y-4">
              {resendError && (
                <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">
                  {resendError}
                </p>
              )}

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
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <Button
                className="w-full"
                variant="secondary"
                size="lg"
                type="submit"
                disabled={loadingResend}
              >
                {loadingResend ? <Loader2 size={16} className="animate-spin" /> : "Resend code"}
              </Button>
            </form>
          </div>

          <p className="text-center text-sm text-muted">
            Already verified?{" "}
            <Link
              href={ROUTES.login}
              className="font-medium text-trippy-400 transition-colors hover:text-trippy-300"
            >
              Sign in
            </Link>
          </p>
        </GlassCard>
      </motion.div>
    </div>
  );
}
