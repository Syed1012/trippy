"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  Loader2,
  Lock,
  Mail,
  PlaneTakeoff,
  User,
  X,
} from "lucide-react";
import { register, ApiError, type ApiErrorBody } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/lib/toast";
import { cn } from "@/lib/utils";

type AuthTab = "signin" | "signup";

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
  /** Called once the user is authenticated (sign-in or sign-up + auto login). */
  onSuccess: () => void;
  /** Destination of the drafted trip, used for context copy. */
  destination?: string;
}

const inputClass =
  "w-full rounded-xl border border-[#dfe5da] bg-[#fbf7ee]/90 py-3 pl-10 pr-4 text-sm font-semibold text-[#17211f] placeholder:text-[#8c978f] outline-none transition-all duration-200 focus:border-[#d5653e] focus:bg-white focus:shadow-[0_0_0_4px_rgba(213,101,62,0.12)]";

function Field({
  icon,
  error,
  children,
}: {
  icon: ReactNode;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <div className="relative">
        <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#d5653e]">
          {icon}
        </span>
        {children}
      </div>
      {error && <p className="mt-1 px-1 text-xs font-bold text-[#b95534]">{error}</p>}
    </div>
  );
}

export default function AuthModal({ open, onClose, onSuccess, destination }: AuthModalProps) {
  const { login } = useAuth();
  const { addToast } = useToast();

  const [tab, setTab] = useState<AuthTab>("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) {
      setTimeout(() => {
        setError("");
        setFieldErrors({});
        setPassword("");
        setConfirmPassword("");
        setLoading(false);
      }, 300);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  function switchTab(next: AuthTab) {
    setTab(next);
    setError("");
    setFieldErrors({});
  }

  function clearFieldError(field: string) {
    setFieldErrors((prev) => ({ ...prev, [field]: "" }));
  }

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!email.trim()) errs.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs.email = "Invalid email format";
    if (!password) errs.password = "Password is required";
    else if (password.length < 8) errs.password = "Must be at least 8 characters";

    if (tab === "signup") {
      if (!firstName.trim()) errs.firstName = "Required";
      if (!lastName.trim()) errs.lastName = "Required";
      if (password) {
        if (!/[a-z]/.test(password)) errs.password = "Needs a lowercase letter";
        else if (!/[A-Z]/.test(password)) errs.password = "Needs an uppercase letter";
        else if (!/\d/.test(password)) errs.password = "Needs a number";
        else if (!/[^A-Za-z0-9]/.test(password)) errs.password = "Needs a special character";
      }
      if (password !== confirmPassword) errs.confirmPassword = "Passwords do not match";
    }

    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (!validate()) return;
    setLoading(true);

    try {
      if (tab === "signup") {
        const displayName = `${firstName.trim()} ${lastName.trim()}`;
        await register(email.trim(), password, displayName);
        await login(email.trim(), password);
        addToast("Welcome aboard!", "success");
      } else {
        await login(email.trim(), password);
        addToast("Welcome back!", "success");
      }
      onSuccess();
    } catch (err) {
      if (err instanceof ApiError) {
        const body = err.body as ApiErrorBody;
        if (Array.isArray(body.details)) {
          const detailErrors = Object.fromEntries(
            body.details.map((detail) => [detail.field, detail.message]),
          );
          setFieldErrors((prev) => ({ ...prev, ...detailErrors }));
        }
        if (err.status === 401) {
          setError("Invalid email or password");
        } else if (err.status === 409) {
          setError("This email already has an account — sign in instead.");
          setTab("signin");
        } else {
          setError(typeof body.message === "string" ? body.message : "Something went wrong. Please try again.");
        }
      } else {
        setError("Connection error. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[130] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <motion.div
            className="absolute inset-0 bg-[#2a2018]/55 backdrop-blur-sm"
            onClick={onClose}
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Sign in or create an account"
            initial={{ opacity: 0, y: 28, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 28, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 320, damping: 30 }}
            className="relative z-10 w-full max-w-md overflow-hidden rounded-[1.6rem] border border-white/80 bg-[#fdfaf3] shadow-[0_44px_110px_-48px_rgba(20,47,43,0.9)]"
          >
            {/* Context header */}
            <div className="relative overflow-hidden bg-[#2a2018] px-6 pb-5 pt-6 text-left">
              <div className="pointer-events-none absolute -right-10 -top-12 h-36 w-36 rounded-full bg-[#d5653e]/25 blur-2xl" />
              <div className="pointer-events-none absolute -bottom-14 -left-8 h-32 w-32 rounded-full bg-white/8 blur-2xl" />
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-full bg-white/10 text-white/80 transition-colors hover:bg-white/20 hover:text-white"
              >
                <X size={15} />
              </button>
              <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[11px] font-black uppercase tracking-wide text-[#f0b091]">
                <PlaneTakeoff size={12} />
                Boarding almost complete
              </span>
              <h2 className="mt-3 font-display text-2xl font-black leading-snug text-white">
                Your trip is ready to board
              </h2>
              {destination && (
                <p className="mt-1 truncate text-sm font-black text-[#f0b091]">
                  “{destination}”
                </p>
              )}
              <p className="mt-1.5 text-sm font-semibold text-white/65">
                {tab === "signup"
                  ? "Create a free account and we'll save it to your dashboard."
                  : "Sign in and we'll save it to your dashboard."}
              </p>
            </div>

            <div className="px-6 pb-6 pt-5">
              {/* Tab switcher */}
              <div className="relative grid grid-cols-2 rounded-full border border-[#e3e8dd] bg-[#f3ecdd] p-1">
                {/* Single sliding indicator — always translates horizontally so
                    both directions animate the same way (no vertical drop). */}
                <motion.span
                  aria-hidden
                  className="pointer-events-none absolute inset-y-1 left-1 right-1/2 rounded-full bg-[#2a2018]"
                  initial={false}
                  animate={{ x: tab === "signup" ? "0%" : "100%" }}
                  transition={{ type: "spring", stiffness: 400, damping: 32 }}
                />
                {(
                  [
                    { key: "signup" as AuthTab, label: "Sign up" },
                    { key: "signin" as AuthTab, label: "Sign in" },
                  ]
                ).map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => switchTab(option.key)}
                    className={cn(
                      "relative z-10 rounded-full py-2 text-xs font-black uppercase tracking-wide transition-colors",
                      tab === option.key ? "text-white" : "text-[#6f7a73] hover:text-[#17211f]",
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              <form onSubmit={handleSubmit} className="mt-5 space-y-3.5">
                {error && (
                  <p className="rounded-xl border border-[#e8c4b2] bg-[#fbeee6] px-3 py-2 text-xs font-bold text-[#b95534]">
                    {error}
                  </p>
                )}

                <AnimatePresence initial={false} mode="popLayout">
                  {tab === "signup" && (
                    <motion.div
                      key="names"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                      className="grid grid-cols-2 gap-3 overflow-hidden"
                    >
                      <Field icon={<User size={15} />} error={fieldErrors.firstName}>
                        <input
                          value={firstName}
                          onChange={(e) => { setFirstName(e.target.value); clearFieldError("firstName"); }}
                          placeholder="First name"
                          className={inputClass}
                        />
                      </Field>
                      <Field icon={<User size={15} />} error={fieldErrors.lastName}>
                        <input
                          value={lastName}
                          onChange={(e) => { setLastName(e.target.value); clearFieldError("lastName"); }}
                          placeholder="Last name"
                          className={inputClass}
                        />
                      </Field>
                    </motion.div>
                  )}
                </AnimatePresence>

                <Field icon={<Mail size={15} />} error={fieldErrors.email}>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); clearFieldError("email"); }}
                    placeholder="Email address"
                    className={inputClass}
                  />
                </Field>

                <Field icon={<Lock size={15} />} error={fieldErrors.password}>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); clearFieldError("password"); }}
                    placeholder={tab === "signup" ? "Create password" : "Password"}
                    className={inputClass}
                  />
                </Field>

                <AnimatePresence initial={false} mode="popLayout">
                  {tab === "signup" && (
                    <motion.div
                      key="confirm"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <Field icon={<Lock size={15} />} error={fieldErrors.confirmPassword}>
                        <input
                          type="password"
                          value={confirmPassword}
                          onChange={(e) => { setConfirmPassword(e.target.value); clearFieldError("confirmPassword"); }}
                          placeholder="Confirm password"
                          className={inputClass}
                        />
                      </Field>
                      <p className="mt-2 px-1 text-[11px] font-semibold leading-snug text-[#8c978f]">
                        8+ characters with an uppercase letter, a number and a symbol.
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>

                <button
                  type="submit"
                  disabled={loading}
                  className={cn(
                    "group flex w-full items-center justify-center gap-2 rounded-xl bg-[#d5653e] py-3.5 text-sm font-black text-white",
                    "shadow-[0_22px_42px_-24px_rgba(213,101,62,0.95)] transition-all duration-300",
                    "hover:-translate-y-0.5 hover:bg-[#b95534]",
                    "disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0",
                  )}
                >
                  {loading ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <>
                      {tab === "signup" ? "Create account & save trip" : "Sign in & save trip"}
                      <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
                    </>
                  )}
                </button>

                <p className="text-center text-xs font-semibold text-[#8c978f]">
                  {tab === "signup" ? "Already have an account?" : "New to Trippy?"}{" "}
                  <button
                    type="button"
                    onClick={() => switchTab(tab === "signup" ? "signin" : "signup")}
                    className="font-black text-[#b95534] transition-colors hover:text-[#d5653e]"
                  >
                    {tab === "signup" ? "Sign in" : "Create an account"}
                  </button>
                </p>
              </form>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
