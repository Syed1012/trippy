"use client";

import { useState, useRef, useEffect, type FormEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Loader2,
  MapPin,
  FileText,
  Plane,
  Sparkles,
  Lock,
  Globe,
  Package,
  Wallet,
  Gem,
  Crown,
  Mountain,
  TreePalm,
  Sun,
  CloudSun,
  Navigation,
  Calendar,
  Building2,
  Trees,
  Compass,
  Landmark,
  Snowflake,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDestinationInput } from "@/lib/destination-format";
import type {
  CreateTripRequest,
  TripType,
  PreferredWeather,
  TripPreferenceInput,
} from "@/lib/api";
import type { CreateTripInitialValues } from "@/lib/pending-trip";

interface CreateTripModalProps {
  open: boolean;
  onClose: () => void;
  onCreate?: (
    data: CreateTripRequest,
    preferences: TripPreferenceInput,
  ) => Promise<void>;
  /** Pre-fills the form when opening, e.g. from a trip drafted on the landing page. */
  initialValues?: CreateTripInitialValues;
}

type Visibility = "PRIVATE" | "PUBLIC";
type Budget = "ECONOMY" | "MODERATE" | "LUXURY";

/* ─── Floating particles for the visual side ─────────────────────── */
function FloatingParticles() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {[...Array(6)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full bg-white/10"
          style={{
            width: 8 + ((i * 7) % 24),
            height: 8 + ((i * 7) % 24),
            left: `${10 + ((i * 17) % 80)}%`,
            top: `${10 + ((i * 13) % 80)}%`,
          }}
          animate={{
            y: [0, -30 - ((i * 11) % 40), 0],
            x: [0, ((i * 5) % 20) - 10, 0],
            opacity: [0.2, 0.5, 0.2],
          }}
          transition={{
            duration: 4 + (i % 3),
            repeat: Infinity,
            delay: i * 0.4,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}

/* ─── Live trip card preview ─────────────────────────────────────── */
function TripPreviewCard({
  title,
  destination,
  visibility,
  budget,
  isPackage,
}: {
  title: string;
  destination: string;
  visibility: Visibility;
  budget: Budget;
  isPackage: boolean;
}) {

  return (
    <motion.div
      layout
      className="relative w-full max-w-xs overflow-hidden rounded-3xl bg-white/10 backdrop-blur-xl border border-white/20 shadow-2xl"
    >
      {/* Card gradient top */}
      <div className="relative h-28 overflow-hidden bg-gradient-to-br from-white/20 via-white/5 to-transparent">
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.div
            animate={{ rotate: [0, 5, -5, 0] }}
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
          >
            <Plane size={48} className="text-white/30" />
          </motion.div>
        </div>
        {/* Status badge */}
        <div className="absolute top-3 right-3">
          <span className="inline-flex items-center gap-1 rounded-full bg-white/20 backdrop-blur-sm px-2.5 py-1 text-[10px] font-semibold text-white">
            {visibility === "PUBLIC" ? (
              <Globe size={10} />
            ) : (
              <Lock size={10} />
            )}
            {visibility === "PUBLIC" ? "Public" : "Private"}
          </span>
        </div>
      </div>

      {/* Card content */}
      <div className="p-5 space-y-3">
        <div>
          <motion.p
            key={`title-${title || "placeholder"}`}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-base font-bold text-white truncate"
          >
            {title || "Your next adventure"}
          </motion.p>
          <motion.div
            key={`destination-${destination || "placeholder"}`}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-1.5 mt-1"
          >
            <MapPin size={12} className="text-white/60" />
            <p className="text-xs text-white/70 truncate">
              {destination || "Anywhere in the world"}
            </p>
          </motion.div>
        </div>

        {/* Budget badge */}
        {isPackage && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center gap-1.5"
          >
            <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-medium text-white/80">
              {budget === "ECONOMY" && <Wallet size={10} />}
              {budget === "MODERATE" && <Gem size={10} />}
              {budget === "LUXURY" && <Crown size={10} />}
              {budget.charAt(0) + budget.slice(1).toLowerCase()} trip
            </span>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}

/* ─── Main component ─────────────────────────────────────────────── */
export default function CreateTripModal({
  open,
  onClose,
  onCreate,
  initialValues,
}: CreateTripModalProps) {
  const [title, setTitle] = useState("");
  const [destination, setDestination] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [visibility, setVisibility] = useState<Visibility>("PRIVATE");
  const [isPackage, setIsPackage] = useState(false);
  const [budget, setBudget] = useState<Budget>("MODERATE");
  const [tripType, setTripType] = useState<TripType[]>([]);
  const [preferredWeather, setPreferredWeather] = useState<PreferredWeather | null>(null);
  const [preferenceNotes, setPreferenceNotes] = useState("");
  const [budgetTier, setBudgetTier] = useState<Budget | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => titleRef.current?.focus(), 400);
    }
  }, [open]);

  useEffect(() => {
    if (!open || !initialValues) return;
    if (initialValues.title) setTitle(initialValues.title);
    if (initialValues.destination) setDestination(formatDestinationInput(initialValues.destination));
    if (initialValues.startDate) setStartDate(initialValues.startDate);
    if (initialValues.endDate) setEndDate(initialValues.endDate);
    if (initialValues.tripType) setTripType([initialValues.tripType]);
    if (initialValues.budgetTier) setBudgetTier(initialValues.budgetTier);
    if (initialValues.visibility) setVisibility(initialValues.visibility);
    if (initialValues.preferenceNotes) setPreferenceNotes(initialValues.preferenceNotes);
  }, [open, initialValues]);

  useEffect(() => {
    if (!open) {
      setTimeout(() => {
        setTitle("");
        setDestination("");
        setDescription("");
        setStartDate("");
        setEndDate("");
        setVisibility("PRIVATE");
        setIsPackage(false);
        setBudget("MODERATE");
        setTripType([]);
        setPreferredWeather(null);
        setPreferenceNotes("");
        setBudgetTier(undefined);
      }, 400);
    }
  }, [open]);

  // Block body scroll when modal is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const canSubmit = title.trim() && destination.trim() && startDate && endDate;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!onCreate || !canSubmit) return;
    setLoading(true);
    try {
      await onCreate(
        {
          title,
          destination,
          description: description || undefined,
          startDate,
          endDate,
          visibility,
          ...(isPackage ? { budgetLevel: budget } : {}),
        },
        {
          tripType: tripType.length ? tripType.join(",") : undefined,
          budgetTier,
          preferredWeather: preferredWeather ?? undefined,
          notes: preferenceNotes.trim() || undefined,
        },
      );
    } finally {
      setLoading(false);
    }
  }

  const budgetOptions: {
    key: Budget;
    label: string;
    icon: typeof Wallet;
    desc: string;
  }[] = [
    {
      key: "ECONOMY",
      label: "Economy",
      icon: Wallet,
      desc: "Budget-friendly",
    },
    {
      key: "MODERATE",
      label: "Moderate",
      icon: Gem,
      desc: "Balanced comfort",
    },
    {
      key: "LUXURY",
      label: "Luxury",
      icon: Crown,
      desc: "Premium everything",
    },
  ];

  const tripTypeOptions: {
    key: TripType;
    label: string;
    icon: typeof Wallet;
  }[] = [
    { key: "BEACH", label: "Beach", icon: TreePalm },
    { key: "MOUNTAIN", label: "Mountains", icon: Mountain },
    { key: "CITY", label: "City", icon: Building2 },
    { key: "NATURE", label: "Nature", icon: Trees },
    { key: "ADVENTURE", label: "Adventure", icon: Compass },
    { key: "CULTURE", label: "Culture", icon: Landmark },
  ];

  const weatherOptions: {
    key: PreferredWeather;
    label: string;
    icon: typeof Sun;
  }[] = [
    { key: "WARM", label: "Warm", icon: Sun },
    { key: "MILD", label: "Mild", icon: CloudSun },
    { key: "COLD", label: "Cold", icon: Snowflake },
    { key: "ANY", label: "Any", icon: Globe },
  ];

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          {/* ─── Full-screen backdrop ──────────────────────── */}
          <motion.div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* ─── Main container ────────────────────────────── */}
          <motion.div
            ref={containerRef}
            className="relative z-10 m-auto flex w-full max-w-5xl max-h-[92vh] overflow-hidden rounded-[2rem] bg-surface shadow-[0_32px_64px_-12px_rgba(0,0,0,0.4)] border border-border/50"
            initial={{ opacity: 0, scale: 0.9, y: 40 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 40 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
          >
            {/* ─── LEFT: Visual inspiration panel ──────────── */}
            <div className="hidden lg:flex lg:w-[42%] relative flex-col items-center justify-center bg-gradient-to-br from-trippy-600 via-trippy-700 to-trippy-800 p-8 overflow-hidden">
              <FloatingParticles />

              {/* Decorative shapes */}
              <div className="pointer-events-none absolute -top-20 -right-20 h-64 w-64 rounded-full bg-accent-500/10 blur-3xl" />
              <div className="pointer-events-none absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-accent-500/5 blur-2xl" />

              {/* Title area */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="relative z-10 text-center mb-8"
              >
                <div className="inline-flex items-center gap-2 rounded-full bg-white/10 backdrop-blur-sm px-4 py-2 mb-4">
                  <Navigation size={14} className="text-accent-400" />
                  <span className="text-xs font-medium text-white/80">
                    Plan your journey
                  </span>
                </div>
                <h2 className="text-2xl font-bold text-white leading-tight">
                  Every great story
                  <br />
                  <span className="bg-gradient-to-r from-accent-300 to-accent-500 bg-clip-text text-transparent">
                    starts with a destination
                  </span>
                </h2>
              </motion.div>

              {/* Live preview card */}
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35 }}
                className="relative z-10"
              >
                <TripPreviewCard
                  title={title}
                  destination={destination}
                  visibility={visibility}
                  budget={budget}
                  isPackage={isPackage}
                />
              </motion.div>

              {/* Bottom decorative icons */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="absolute bottom-6 left-0 right-0 flex justify-center gap-6 opacity-30"
              >
                <Mountain size={20} className="text-white" />
                <TreePalm size={20} className="text-white" />
                <Sun size={20} className="text-white" />
                <CloudSun size={20} className="text-white" />
              </motion.div>
            </div>

            {/* ─── RIGHT: Form panel ───────────────────────── */}
            <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
              {/* Close button */}
              <div className="sticky top-0 z-20 flex items-center justify-between px-8 pt-6 pb-2 bg-surface/80 backdrop-blur-md">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-accent-400 to-accent-600 shadow-lg shadow-accent-500/20">
                    <Plane size={18} className="text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-foreground">
                      New trip
                    </h3>
                    <p className="text-xs text-muted">
                      Fill in the details below
                    </p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="flex h-9 w-9 items-center justify-center rounded-xl bg-shore-100 text-muted transition-all hover:bg-shore-200 hover:text-foreground hover:scale-105 cursor-pointer"
                  aria-label="Close"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Form */}
              <form
                onSubmit={handleSubmit}
                className="flex-1 px-8 pb-8 pt-4 space-y-6"
              >
                {/* ─── Section: Where ─────────────────────── */}
                <motion.section
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="space-y-4"
                >
                  <div className="flex items-center gap-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-accent-500/10">
                      <MapPin size={12} className="text-accent-500" />
                    </div>
                    <h4 className="text-sm font-bold text-foreground">
                      Where to?
                    </h4>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label
                        htmlFor="trip-title"
                        className="text-xs font-semibold text-muted uppercase tracking-wider"
                      >
                        Trip name
                      </label>
                      <div className="relative group">
                        <Sparkles
                          size={14}
                          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-accent-300 transition-colors group-focus-within:text-accent-500"
                        />
                        <input
                          ref={titleRef}
                          id="trip-title"
                          type="text"
                          placeholder="Summer in Barcelona"
                          value={title}
                          onChange={(e) => setTitle(e.target.value)}
                          required
                          className="w-full rounded-xl border border-border bg-shore-50 py-3 pl-10 pr-4 text-sm text-foreground placeholder:text-muted/50 transition-all duration-200 focus:border-accent-400 focus:outline-none focus:ring-2 focus:ring-accent-200/50 focus:bg-white hover:border-accent-300"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label
                        htmlFor="trip-dest"
                        className="text-xs font-semibold text-muted uppercase tracking-wider"
                      >
                        Destination
                      </label>
                      <div className="relative group">
                        <MapPin
                          size={14}
                          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-accent-300 transition-colors group-focus-within:text-accent-500"
                        />
                        <input
                          id="trip-dest"
                          type="text"
                          placeholder="Barcelona, Spain"
                          value={destination}
                          onChange={(e) => setDestination(formatDestinationInput(e.target.value))}
                          required
                          className="w-full rounded-xl border border-border bg-shore-50 py-3 pl-10 pr-4 text-sm text-foreground placeholder:text-muted/50 transition-all duration-200 focus:border-accent-400 focus:outline-none focus:ring-2 focus:ring-accent-200/50 focus:bg-white hover:border-accent-300"
                        />
                      </div>
                    </div>
                  </div>
                </motion.section>

                {/* ─── Section: When ──────────────────────── */}
                <motion.section
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="space-y-4"
                >
                  <div className="flex items-center gap-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-accent-500/10">
                      <Calendar size={12} className="text-accent-500" />
                    </div>
                    <h4 className="text-sm font-bold text-foreground">
                      When?
                    </h4>
                    <span className="text-[10px] text-red-400 font-medium ml-1">Required</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label
                        htmlFor="trip-start"
                        className="text-xs font-semibold text-muted uppercase tracking-wider"
                      >
                        Start date
                      </label>
                      <div className="relative group">
                        <Calendar
                          size={14}
                          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-accent-300 transition-colors group-focus-within:text-accent-500"
                        />
                        <input
                          id="trip-start"
                          type="date"
                          value={startDate}
                          onChange={(e) => {
                            setStartDate(e.target.value);
                            if (endDate && e.target.value > endDate) {
                              setEndDate("");
                            }
                          }}
                          min={new Date().toISOString().split("T")[0]}
                          required
                          className="w-full rounded-xl border border-border bg-shore-50 py-3 pl-10 pr-4 text-sm text-foreground transition-all duration-200 focus:border-accent-400 focus:outline-none focus:ring-2 focus:ring-accent-200/50 focus:bg-white hover:border-accent-300 [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label
                        htmlFor="trip-end"
                        className="text-xs font-semibold text-muted uppercase tracking-wider"
                      >
                        End date
                      </label>
                      <div className="relative group">
                        <Calendar
                          size={14}
                          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-accent-300 transition-colors group-focus-within:text-accent-500"
                        />
                        <input
                          id="trip-end"
                          type="date"
                          value={endDate}
                          onChange={(e) => setEndDate(e.target.value)}
                          min={startDate || new Date().toISOString().split("T")[0]}
                          required
                          className="w-full rounded-xl border border-border bg-shore-50 py-3 pl-10 pr-4 text-sm text-foreground transition-all duration-200 focus:border-accent-400 focus:outline-none focus:ring-2 focus:ring-accent-200/50 focus:bg-white hover:border-accent-300 [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                        />
                      </div>
                    </div>
                  </div>

                  {startDate && endDate && (
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-xs text-accent-600 font-medium"
                    >
                      {Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000) + 1} day
                      {Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000) + 1 !== 1 ? "s" : ""} trip
                    </motion.p>
                  )}
                </motion.section>

                {/* ─── Section: Details ───────────────────── */}
                <motion.section
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="space-y-4"
                >
                  <div className="flex items-center gap-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-accent-500/10">
                      <FileText size={12} className="text-accent-500" />
                    </div>
                    <h4 className="text-sm font-bold text-foreground">
                      Details
                    </h4>
                  </div>

                  {/* Description */}
                  <div className="space-y-1.5">
                    <label
                      htmlFor="trip-desc"
                      className="text-xs font-semibold text-muted uppercase tracking-wider"
                    >
                      Description
                    </label>
                    <textarea
                      id="trip-desc"
                      rows={2}
                      placeholder="A quick note about the vibe, goals, must-sees..."
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="w-full resize-none rounded-xl border border-border bg-shore-50 px-4 py-3 text-sm text-foreground placeholder:text-muted/50 transition-all duration-200 focus:border-accent-400 focus:outline-none focus:ring-2 focus:ring-accent-200/50 focus:bg-white hover:border-accent-300"
                    />
                  </div>

                  {/* Visibility toggle */}
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-muted uppercase tracking-wider">
                      Visibility
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      {(
                        [
                          {
                            key: "PRIVATE" as Visibility,
                            icon: Lock,
                            label: "Private",
                            desc: "Only invited members",
                          },
                          {
                            key: "PUBLIC" as Visibility,
                            icon: Globe,
                            label: "Public",
                            desc: "Visible in discovery",
                          },
                        ]
                      ).map((opt) => {
                        const OptIcon = opt.icon;
                        const active = visibility === opt.key;
                        return (
                          <button
                            key={opt.key}
                            type="button"
                            onClick={() => setVisibility(opt.key)}
                            className={cn(
                              "relative flex items-center gap-3 rounded-2xl border-2 p-3.5 text-left transition-all duration-200 cursor-pointer overflow-hidden",
                              active
                                ? "border-accent-500 bg-accent-50 shadow-sm shadow-accent-500/10"
                                : "border-border bg-shore-50 hover:border-accent-300 hover:bg-shore-100"
                            )}
                          >
                            {active && (
                              <motion.div
                                layoutId="visibility-active"
                                className="absolute inset-0 rounded-2xl bg-accent-500/5"
                                transition={{
                                  type: "spring",
                                  stiffness: 400,
                                  damping: 30,
                                }}
                              />
                            )}
                            <div
                              className={cn(
                                "relative flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition-colors",
                                active
                                  ? "bg-accent-500 text-white"
                                  : "bg-shore-200 text-muted"
                              )}
                            >
                              <OptIcon size={14} />
                            </div>
                            <div className="relative min-w-0">
                              <p
                                className={cn(
                                  "text-sm font-semibold",
                                  active
                                    ? "text-accent-600"
                                    : "text-foreground"
                                )}
                              >
                                {opt.label}
                              </p>
                              <p className="text-[11px] text-muted truncate">
                                {opt.desc}
                              </p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Package toggle */}
                  <div
                    className={cn(
                      "rounded-2xl border-2 p-4 transition-all duration-300",
                      isPackage
                        ? "border-accent-300 bg-accent-50/50"
                        : "border-border bg-shore-50"
                    )}
                  >
                    <label className="flex cursor-pointer items-start gap-3">
                      <div className="relative mt-0.5 shrink-0">
                        <input
                          type="checkbox"
                          checked={isPackage}
                          onChange={(e) => setIsPackage(e.target.checked)}
                          className="peer sr-only"
                        />
                        <div className="h-5 w-9 rounded-full bg-border transition-colors peer-checked:bg-accent-500" />
                        <div className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <Package size={13} className="text-accent-500" />
                          <span className="text-sm font-semibold text-foreground">
                            Package trip
                          </span>
                        </div>
                        <p className="mt-0.5 text-[11px] leading-snug text-muted">
                          Set a budget tier for cost estimates on activities and
                          stays
                        </p>
                      </div>
                    </label>

                    {/* Budget tiers */}
                    <AnimatePresence initial={false}>
                      {isPackage && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.25, ease: "easeInOut" }}
                          className="overflow-hidden"
                        >
                          <div className="mt-4 grid grid-cols-3 gap-2">
                            {budgetOptions.map((opt) => {
                              const OptIcon = opt.icon;
                              const active = budget === opt.key;
                              return (
                                <button
                                  key={opt.key}
                                  type="button"
                                  onClick={() => setBudget(opt.key)}
                                  className={cn(
                                    "flex flex-col items-center gap-1.5 rounded-xl border-2 p-3 text-center transition-all duration-200 cursor-pointer",
                                    active
                                      ? "border-accent-500 bg-gradient-to-b from-accent-50 to-white shadow-sm"
                                      : "border-border bg-white hover:border-accent-300 hover:shadow-sm"
                                  )}
                                >
                                  <div
                                    className={cn(
                                      "flex h-8 w-8 items-center justify-center rounded-lg transition-colors",
                                      active
                                        ? "bg-accent-500 text-white"
                                        : "bg-shore-100 text-muted"
                                    )}
                                  >
                                    <OptIcon size={14} />
                                  </div>
                                  <span
                                    className={cn(
                                      "text-xs font-bold",
                                      active
                                        ? "text-accent-600"
                                        : "text-foreground"
                                    )}
                                  >
                                    {opt.label}
                                  </span>
                                  <span className="text-[10px] leading-tight text-muted">
                                    {opt.desc}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.section>

                {/* ─── Section: Trip preferences ──────────── */}
                <motion.section
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.35 }}
                  className="space-y-4"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-accent-500/10">
                      <Sparkles size={12} className="text-accent-500" />
                    </div>
                    <h4 className="text-sm font-bold text-foreground">
                      Trip preferences
                    </h4>
                    <span className="inline-flex items-center gap-1 rounded-full bg-trippy-500/10 px-2 py-0.5 text-[10px] font-semibold text-trippy-600">
                      <Sparkles size={9} /> Smarter AI itineraries
                    </span>
                  </div>

                  <div className="space-y-4 rounded-2xl border-2 border-border bg-gradient-to-br from-shore-50 to-white p-4">
                    <p className="text-[11px] leading-snug text-muted">
                      Pick a trip type and weather if you like — or skip them
                      and just tell our AI what you&apos;re expecting in the
                      notes. Everything here is optional.
                    </p>

                    {/* Trip type */}
                    <div className="space-y-2">
                      <label className="text-xs font-semibold uppercase tracking-wider text-muted">
                        Trip type{" "}
                        <span className="font-normal normal-case text-muted/60">
                          · optional, pick as many as fit
                        </span>
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        {tripTypeOptions.map((opt) => {
                          const OptIcon = opt.icon;
                          const active = tripType.includes(opt.key);
                          return (
                            <button
                              key={opt.key}
                              type="button"
                              onClick={() =>
                                setTripType(
                                  active
                                    ? tripType.filter((t) => t !== opt.key)
                                    : [...tripType, opt.key]
                                )
                              }
                              className={cn(
                                "flex flex-col items-center gap-1.5 rounded-xl border-2 p-3 text-center transition-all duration-200 cursor-pointer",
                                active
                                  ? "border-accent-500 bg-gradient-to-b from-accent-50 to-white shadow-sm"
                                  : "border-border bg-white hover:border-accent-300 hover:shadow-sm"
                              )}
                            >
                              <div
                                className={cn(
                                  "flex h-8 w-8 items-center justify-center rounded-lg transition-colors",
                                  active
                                    ? "bg-accent-500 text-white"
                                    : "bg-shore-100 text-muted"
                                )}
                              >
                                <OptIcon size={14} />
                              </div>
                              <span
                                className={cn(
                                  "text-xs font-bold",
                                  active
                                    ? "text-accent-600"
                                    : "text-foreground"
                                )}
                              >
                                {opt.label}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Preferred weather (optional) */}
                    <div className="space-y-2">
                      <label className="text-xs font-semibold uppercase tracking-wider text-muted">
                        Preferred weather{" "}
                        <span className="font-normal normal-case text-muted/60">
                          · optional
                        </span>
                      </label>
                      <div className="grid grid-cols-4 gap-2">
                        {weatherOptions.map((opt) => {
                          const OptIcon = opt.icon;
                          const active = preferredWeather === opt.key;
                          return (
                            <button
                              key={opt.key}
                              type="button"
                              onClick={() =>
                                setPreferredWeather(active ? null : opt.key)
                              }
                              className={cn(
                                "flex flex-col items-center gap-1.5 rounded-xl border-2 p-2.5 text-center transition-all duration-200 cursor-pointer",
                                active
                                  ? "border-accent-500 bg-gradient-to-b from-accent-50 to-white shadow-sm"
                                  : "border-border bg-white hover:border-accent-300 hover:shadow-sm"
                              )}
                            >
                              <div
                                className={cn(
                                  "flex h-7 w-7 items-center justify-center rounded-lg transition-colors",
                                  active
                                    ? "bg-accent-500 text-white"
                                    : "bg-shore-100 text-muted"
                                )}
                              >
                                <OptIcon size={13} />
                              </div>
                              <span
                                className={cn(
                                  "text-[11px] font-semibold",
                                  active
                                    ? "text-accent-600"
                                    : "text-foreground"
                                )}
                              >
                                {opt.label}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Free-form expectations — the traveller can skip the
                        chips above entirely and just describe their ideal trip */}
                    <div className="space-y-2">
                      <label
                        htmlFor="trip-pref-notes"
                        className="text-xs font-semibold uppercase tracking-wider text-muted"
                      >
                        What are you expecting?{" "}
                        <span className="font-normal normal-case text-muted/60">
                          · optional
                        </span>
                      </label>
                      <textarea
                        id="trip-pref-notes"
                        rows={3}
                        maxLength={500}
                        placeholder="e.g. laid-back beach mornings, amazing local food, a mix of culture and nightlife — or leave the options above unset and describe your ideal trip here."
                        value={preferenceNotes}
                        onChange={(e) => setPreferenceNotes(e.target.value)}
                        className="w-full resize-none rounded-xl border border-border bg-white px-4 py-3 text-sm text-foreground placeholder:text-muted/50 transition-all duration-200 focus:border-accent-400 focus:outline-none focus:ring-2 focus:ring-accent-200/50 hover:border-accent-300"
                      />
                    </div>
                  </div>
                </motion.section>

                {/* ─── Submit area ────────────────────────── */}
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="pt-2"
                >
                  {/* Info callout */}
                  <div className="flex items-start gap-2.5 rounded-xl border border-trippy-200/40 bg-trippy-500/5 p-3 mb-5">
                    <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-trippy-500/10 mt-0.5">
                      <Sparkles size={10} className="text-trippy-500" />
                    </div>
                    <p className="text-[11px] leading-snug text-muted">
                      After creating, you can build a detailed itinerary with
                      AI, add places, invite friends, and manage per-activity
                      costs.
                    </p>
                  </div>

                  {/* Submit button */}
                  <button
                    type="submit"
                    disabled={loading || !canSubmit}
                    className={cn(
                      "w-full flex items-center justify-center gap-2.5 rounded-2xl py-4 text-sm font-bold text-white transition-all duration-300 cursor-pointer",
                      "bg-gradient-to-r from-accent-500 via-accent-500 to-accent-600 shadow-lg shadow-accent-500/25",
                      "hover:shadow-xl hover:shadow-accent-500/30 hover:-translate-y-0.5 hover:from-accent-400 hover:to-accent-600",
                      "active:translate-y-0 active:shadow-md",
                      "disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-lg disabled:hover:from-accent-500 disabled:hover:to-accent-600"
                    )}
                  >
                    {loading ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Sparkles size={16} />
                    )}
                    {loading ? "Creating your trip..." : "Create trip"}
                  </button>

                  {/* Keyboard hint */}
                  {!loading && canSubmit && (
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="mt-2.5 text-center text-[10px] text-muted/60"
                    >
                      Press{" "}
                      <kbd className="rounded bg-shore-200 px-1.5 py-0.5 font-mono text-[10px] text-muted">
                        ⌘ Enter
                      </kbd>{" "}
                      to create
                    </motion.p>
                  )}
                </motion.div>
              </form>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
