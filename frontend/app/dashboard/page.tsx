"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Search,
  MapPin,
  Loader2,
  Plane,
  Globe2,
  Sparkles,
  Calendar,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button, Input } from "@/components/ui";
import TripCard from "@/components/trips/TripCard";
import CreateTripModal from "@/components/trips/CreateTripModal";
import {
  tripsApi,
  participantsApi,
  preferencesApi,
  hasTripPreferences,
  ApiError,
  ensureTripCoverImage,
  type Trip,
  type CreateTripRequest,
  type TripPreferenceInput,
} from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import {
  clearPendingTrip,
  loadPendingTrip,
  pendingTripToInitialValues,
  type CreateTripInitialValues,
} from "@/lib/pending-trip";
import { useToast } from "@/lib/toast";
import { cn, tripSlug } from "@/lib/utils";

const STATUS_TABS = [
  { key: "", label: "All trips" },
  { key: "MY", label: "My trips" },
  { key: "DRAFT", label: "Drafts" },
  { key: "ONGOING", label: "Active" },
  { key: "COMPLETED", label: "Completed" },
] as const;

export default function DashboardPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { addToast } = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [createInitialValues, setCreateInitialValues] = useState<CreateTripInitialValues | undefined>(undefined);
  const [autoCreating, setAutoCreating] = useState(false);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [publicTrips, setPublicTrips] = useState<Trip[]>([]);
  const [publicLoading, setPublicLoading] = useState(true);
  const [joiningTripId, setJoiningTripId] = useState<string | null>(null);
  const [requestedTripIds, setRequestedTripIds] = useState<Set<string>>(new Set());
  const [joinModalTripId, setJoinModalTripId] = useState<string | null>(null);
  const [joinMessage, setJoinMessage] = useState("");

  const fetchTrips = useCallback(async () => {
    setLoading(true);
    try {
      const data = searchQuery
        ? await tripsApi.search(searchQuery, page)
        : await tripsApi.list(page);
      setTrips(data.content);
      setTotalPages(data.totalPages);
    } catch {
      setTrips([]);
      setTotalPages(0);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, page]);

  useEffect(() => {
    fetchTrips();
  }, [fetchTrips]);

  // Create a trip, then best-effort save its preferences (a preference failure
  // must never undo the already-created trip).
  const createTripWithPreferences = useCallback(
    async (data: CreateTripRequest, preferences: TripPreferenceInput) => {
      const trip = await tripsApi.create(data);
      // Kick off cover-image generation in the background — never blocks or fails creation.
      void ensureTripCoverImage(trip.tripId, trip.destination, preferences).catch(() => {});
      let prefsSaved = true;
      if (hasTripPreferences(preferences)) {
        try {
          await preferencesApi.save(trip.tripId, preferences);
        } catch (err) {
          prefsSaved = false;
          console.error("Failed to save trip preferences", err);
        }
      }
      return { trip, prefsSaved };
    },
    [],
  );

  // A trip drafted on the landing page before auth. Rather than re-prompting the
  // New Trip modal, create it straight from the stashed data and glide into it.
  useEffect(() => {
    const pending = loadPendingTrip();
    if (!pending) return;
    clearPendingTrip();

    const values = pendingTripToInitialValues(pending);
    const data: CreateTripRequest = {
      title: values.title ?? "",
      destination: values.destination ?? "",
      startDate: values.startDate,
      endDate: values.endDate,
      visibility: values.visibility,
    };
    const preferences: TripPreferenceInput = {
      tripType: values.tripType,
      budgetTier: values.budgetTier,
      notes: values.preferenceNotes,
    };

    // Missing essentials — fall back to the pre-filled modal instead of failing.
    if (!data.title || !data.destination || !data.startDate || !data.endDate) {
      setCreateInitialValues(values);
      setCreateOpen(true);
      return;
    }

    setAutoCreating(true);
    createTripWithPreferences(data, preferences)
      .then(({ trip, prefsSaved }) => {
        addToast(
          prefsSaved ? "Your trip is ready!" : "Trip created — preferences need a retry.",
          prefsSaved ? "success" : "error",
        );
        router.replace(`/dashboard/trips/${tripSlug(trip.title, trip.tripId)}`);
      })
      .catch(() => {
        // Keep the user's work: open the modal pre-filled so they can retry.
        setAutoCreating(false);
        setCreateInitialValues(values);
        setCreateOpen(true);
        addToast("We couldn't auto-create your trip — please review and try again.", "error");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setPublicLoading(true);
    tripsApi.listPublic(0, 6).then((data) => {
      setPublicTrips(data.content);
      const requested = data.content
        .filter((trip) => trip.currentUserStatus === "PENDING_APPROVAL")
        .map((trip) => trip.tripId);
      if (requested.length > 0) {
        setRequestedTripIds((prev) => {
          const next = new Set(prev);
          requested.forEach((id) => next.add(id));
          return next;
        });
      }
    }).catch(() => {
      setPublicTrips([]);
    }).finally(() => setPublicLoading(false));
  }, []);

  async function handleCreateTrip(
    data: CreateTripRequest,
    preferences: TripPreferenceInput,
  ) {
    try {
      const { trip, prefsSaved } = await createTripWithPreferences(data, preferences);

      setCreateOpen(false);
      addToast(
        prefsSaved ? "Trip created!" : "Trip created — preferences need a retry.",
        prefsSaved ? "success" : "error",
      );

      router.push(`/dashboard/trips/${tripSlug(trip.title, trip.tripId)}`);

    } catch (err: any) {
      console.log("TRIP ERROR:", err);

      const code = err instanceof ApiError ? err.body?.error ?? err.body?.message : err?.message;

      if (code === "FREE_PLAN_LIMIT_EXCEEDED") {
        addToast(
          "You've reached the free plan limit. Upgrade to continue creating trips.",
          "warning"
        );
        router.push("/dashboard/payments?upgradeRequired=true");
        return;
      }

      addToast("Failed to create trip", "error");
    }
  }


  async function handleJoinTrip(tripId: string) {
    setJoiningTripId(tripId);
    try {
      const res = await participantsApi.requestJoin(
        tripId,
        user?.displayName || undefined,
        joinMessage.trim() || undefined,
      );
      addToast(res.message || "Join request sent! Awaiting owner approval.", "success");
      setRequestedTripIds((prev) => new Set(prev).add(tripId));
      setJoinModalTripId(null);
      setJoinMessage("");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to send join request";
      addToast(msg, "error");
    } finally {
      setJoiningTripId(null);
    }
  }

  const filteredTrips = filterStatus === "MY"
    ? trips.filter((t) => t.organizerId === user?.userId)
    : filterStatus
      ? trips.filter((t) => t.status === filterStatus)
      : trips;

  const tripCount = filteredTrips.length;

  const sortedFilteredTrips = [...filteredTrips]
    .sort((a, b) => {
      if (!a.startDate) return 1;
      if (!b.startDate) return -1;
      return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
    })
    .slice(0, 6);

  const sortedPublicTrips = [...publicTrips]
    .sort((a, b) => {
      if (!a.startDate) return 1;
      if (!b.startDate) return -1;
      return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
    })
    .slice(0, 6);

  // Hero personalization + at-a-glance stats.
  const greetingName = user?.displayName?.trim().split(/\s+/)[0] ?? "";
  const now = new Date();
  const upcomingCount = trips.filter(
    (t) => t.startDate && new Date(t.startDate) >= now && t.status !== "CANCELLED",
  ).length;
  const heroStats = [
    { icon: Plane, label: "Trips", value: trips.length },
    { icon: Calendar, label: "Upcoming", value: upcomingCount },
  ];

  return (
    <>
      <CreateTripModal
        open={createOpen}
        onClose={() => {
          setCreateOpen(false);
          setCreateInitialValues(undefined);
        }}
        onCreate={handleCreateTrip}
        initialValues={createInitialValues}
      />

      {/* Auto-create overlay — shown while a trip drafted on the landing page is
          saved straight to the DB after sign-in, for a seamless handoff. */}
      <AnimatePresence>
        {autoCreating && (
          <motion.div
            className="fixed inset-0 z-[70] flex items-center justify-center bg-background/80 backdrop-blur-xl"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <motion.div
              initial={{ opacity: 0, y: 18, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ type: "spring", stiffness: 260, damping: 24 }}
              className="flex flex-col items-center gap-5 text-center"
            >
              <div className="relative grid h-20 w-20 place-items-center rounded-3xl bg-gradient-to-br from-accent-400 to-accent-600 shadow-[0_20px_44px_-18px_rgba(213,101,62,0.9)]">
                <motion.div
                  animate={{ y: [0, -6, 0], rotate: [0, 8, 0] }}
                  transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
                >
                  <Plane size={30} className="text-white" />
                </motion.div>
                <motion.div
                  className="absolute -right-1.5 -top-1.5 text-accent-200"
                  animate={{ scale: [1, 1.3, 1], opacity: [0.6, 1, 0.6] }}
                  transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
                >
                  <Sparkles size={18} />
                </motion.div>
              </div>
              <div className="space-y-1.5">
                <p className="text-lg font-bold text-foreground">Creating your trip…</p>
                <p className="text-sm text-muted">Saving your plan and preferences — hang tight.</p>
              </div>
              <div className="flex items-center gap-2 text-muted">
                <Loader2 size={15} className="animate-spin" />
                <span className="text-xs font-semibold uppercase tracking-wider">Almost ready</span>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Join Reason Modal ───────────────────────────────────── */}
      <AnimatePresence>
        {joinModalTripId && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => { setJoinModalTripId(null); setJoinMessage(""); }}
            />
            <motion.div
              className="relative z-10 w-full max-w-sm overflow-hidden rounded-2xl bg-surface border border-border shadow-2xl"
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
            >
              <div className="px-6 py-5">
                <h3 className="text-base font-bold text-foreground mb-1">Request to Join</h3>
                <p className="text-xs text-muted mb-4">
                  Let the host know why you&apos;d like to join this trip.
                </p>
                <textarea
                  value={joinMessage}
                  onChange={(e) => setJoinMessage(e.target.value)}
                  placeholder="Why do you want to join? (optional)"
                  rows={3}
                  maxLength={300}
                  className="w-full rounded-xl border border-border bg-shore-50 px-4 py-2.5 text-sm text-foreground placeholder:text-muted/60 focus:outline-none focus:border-accent-400 focus:ring-1 focus:ring-accent-100 transition-colors resize-none"
                />
                <div className="mt-4 flex items-center gap-2 justify-end">
                  <button
                    onClick={() => { setJoinModalTripId(null); setJoinMessage(""); }}
                    className="rounded-lg border border-border px-4 py-2 text-xs font-medium text-muted hover:bg-shore-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleJoinTrip(joinModalTripId)}
                    disabled={joiningTripId === joinModalTripId}
                    className="rounded-lg bg-accent-500 px-4 py-2 text-xs font-semibold text-white hover:bg-accent-600 disabled:opacity-50 transition-colors"
                  >
                    {joiningTripId === joinModalTripId ? "Sending..." : "Send Request"}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Hero header ─────────────────────────────────────────── */}
      <section className="relative mb-9">
        <div className="premium-panel relative overflow-hidden rounded-[1.75rem] p-6 sm:p-8">
          {/* Floating ambient accents */}
          <div className="pointer-events-none absolute -right-12 -top-14 h-48 w-48 rounded-full bg-accent-400/18 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-16 left-8 h-44 w-44 rounded-full bg-trippy-500/12 blur-3xl" />
          <div className="pointer-events-none absolute right-6 top-4 opacity-[0.06] lux-float">
            <Plane size={118} className="rotate-12 text-trippy-800" />
          </div>

          <div className="relative z-10 flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45 }}
            >
              <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-500/12 px-3 py-1 text-[11px] font-black uppercase tracking-[0.14em] text-accent-600">
                <Sparkles size={12} /> Your travel hub
              </span>
              <h1 className="mt-3 font-display text-4xl font-black leading-[1.05] tracking-tight sm:text-5xl">
                {greetingName ? (
                  <>
                    Welcome back,{" "}
                    <span className="text-foreground">{greetingName}</span>
                  </>
                ) : (
                  <span className="text-gradient-warm">Your journeys</span>
                )}
              </h1>
              <p className="mt-2.5 max-w-md text-sm leading-relaxed text-muted">
                {loading
                  ? "Loading your adventures…"
                  : "Plan, explore, and relive every trip — all in one beautiful place."}
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.35, delay: 0.15 }}
              className="flex flex-col items-start gap-4 lg:items-end"
            >
              <button
                onClick={() => setCreateOpen(true)}
                className={cn(
                  "group relative inline-flex items-center gap-2.5 overflow-hidden",
                  "rounded-2xl px-6 py-3.5 font-bold text-white glow-accent",
                  "bg-gradient-to-r from-accent-400 via-accent-500 to-accent-600",
                  "transition-all duration-300 hover:-translate-y-0.5",
                  "focus-visible:focus-ring cursor-pointer",
                )}
              >
                <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
                <Plus size={18} strokeWidth={2.6} />
                <span>New Trip</span>
              </button>

              {/* At-a-glance stats */}
              <div className="flex flex-wrap gap-2.5">
                {heroStats.map((stat) => {
                  const Icon = stat.icon;
                  return (
                    <div
                      key={stat.label}
                      className="glass-sm flex items-center gap-2.5 rounded-2xl px-3.5 py-2"
                    >
                      <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent-500/12 text-accent-600">
                        <Icon size={15} />
                      </div>
                      <div className="leading-tight">
                        <div className="text-lg font-black text-foreground">{stat.value}</div>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-muted">
                          {stat.label}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          </div>
        </div>

        {/* ── Search + filter bar ──────────────────────────────── */}
        <motion.div
          className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
        >
          {/* Search */}
          <div className="relative flex-1">
            <Search
              size={16}
              className="pointer-events-none absolute top-1/2 left-3.5 z-10 -translate-y-1/2 text-muted"
            />
            <Input
              placeholder="Search by title or destination..."
              className="pl-10 rounded-2xl"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(0);
              }}
            />
          </div>

          {/* Status tabs */}
          <div className="glass-sm flex gap-1 rounded-2xl p-1">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setFilterStatus(tab.key)}
                className={cn(
                  "relative px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all duration-200 cursor-pointer",
                  filterStatus === tab.key
                    ? "text-white"
                    : "text-muted hover:text-foreground",
                )}
              >
                {filterStatus === tab.key && (
                  <motion.span
                    layoutId="activeTab"
                    className="absolute inset-0 rounded-xl bg-gradient-to-r from-trippy-500 to-trippy-600"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
                <span className="relative z-10">{tab.label}</span>
              </button>
            ))}
          </div>
        </motion.div>
      </section>


      {/* ── Content ─────────────────────────────────────────────── */}
      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div
            key="loading"
            className="mt-20 flex flex-col items-center gap-3"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="relative">
              <div className="h-12 w-12 rounded-full border-3 border-shore-200 border-t-accent-500 animate-spin" />
              <Plane
                size={16}
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-accent-500"
              />
            </div>
            <p className="text-sm text-muted">Loading trips...</p>
          </motion.div>
        ) : filteredTrips.length === 0 ? (
          /* ── Empty state ──────────────────────────────────────── */
          <motion.div
            key="empty"
            className="mt-8"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.5 }}
          >
            <div className="premium-panel relative mx-auto flex max-w-2xl flex-col items-center overflow-hidden rounded-[2rem] px-6 py-16 text-center">
              {/* Ambient accents */}
              <div className="pointer-events-none absolute -top-16 left-1/2 h-56 w-56 -translate-x-1/2 rounded-full bg-accent-400/16 blur-3xl" />
              <div className="pointer-events-none absolute bottom-0 right-8 h-40 w-40 rounded-full bg-trippy-500/10 blur-3xl" />

              <div className="relative">
                {/* Decorative orbiting rings */}
                <div className="absolute inset-0 -m-4 rounded-full border-2 border-dashed border-accent-200/60 animate-[spin_30s_linear_infinite]" />
                <div className="absolute inset-0 -m-10 rounded-full border border-dashed border-trippy-200/40 animate-[spin_45s_linear_infinite_reverse]" />
                <div className="relative flex h-28 w-28 items-center justify-center rounded-full bg-gradient-to-br from-accent-400 to-accent-600 text-white shadow-[0_24px_50px_-20px_rgba(231,111,81,0.85)]">
                  {searchQuery ? <Search size={40} /> : <Plane size={44} className="lux-float" />}
                </div>
              </div>

              <h3 className="relative mt-9 font-display text-2xl font-black tracking-tight">
                {searchQuery ? "No trips found" : "Your next adventure awaits"}
              </h3>
              <p className="relative mt-2.5 max-w-md text-sm leading-relaxed text-muted">
                {searchQuery
                  ? "Try a different search term or clear your filters to see all trips."
                  : "Start planning an unforgettable journey. Create your first trip and invite friends to join the adventure."}
              </p>

              {!searchQuery && (
                <button
                  onClick={() => setCreateOpen(true)}
                  className={cn(
                    "relative mt-8 group inline-flex items-center gap-2.5 overflow-hidden",
                    "rounded-2xl px-7 py-3.5 font-bold text-white glow-accent",
                    "bg-gradient-to-r from-accent-400 via-accent-500 to-accent-600",
                    "transition-all duration-300 hover:-translate-y-0.5 cursor-pointer",
                  )}
                >
                  <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
                  <Sparkles size={17} />
                  <span>Create your first trip</span>
                </button>
              )}
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="trips"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {/* Section header */}
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-accent-400 to-accent-600 text-white shadow-[0_14px_28px_-16px_rgba(231,111,81,0.9)]">
                <MapPin size={18} />
              </div>
              <div>
                <h2 className="text-xl font-extrabold tracking-tight">
                  {filterStatus === "MY" ? "My trips" : "Your trips"}
                </h2>
                <p className="text-xs text-muted">
                  {tripCount} trip{tripCount !== 1 ? "s" : ""} in your collection
                </p>
              </div>
            </div>

            {/* ── Trip grid ───────────────────────────────────────── */}
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {sortedFilteredTrips.map((trip, i) => (
                <motion.div
                  key={trip.tripId}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: i * 0.06 }}
                  onClick={() =>
                    router.push(`/dashboard/trips/${tripSlug(trip.title, trip.tripId)}`)
                  }
                  className="cursor-pointer"
                >
                  <TripCard
                    title={trip.title}
                    destination={trip.destination}
                    startDate={trip.startDate ?? "TBD"}
                    endDate={trip.endDate ?? "TBD"}
                    status={
                      trip.status === "ONGOING"
                        ? "ACTIVE"
                        : (trip.status as
                            | "DRAFT"
                            | "PLANNED"
                            | "ACTIVE"
                            | "COMPLETED"
                            | "CANCELLED")
                    }
                    participantCount={trip.participantCount}
                    coverImageUrl={trip.coverImageUrl}
                    invited={trip.currentUserStatus === "INVITED"}
                  />
                </motion.div>
              ))}
            </div>

            {/* ── Pagination ──────────────────────────────────────── */}
            {totalPages > 1 && (
              <div className="mt-10 flex items-center justify-center gap-3">
                <button
                  disabled={page === 0}
                  onClick={() => setPage((p) => p - 1)}
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-surface text-muted transition-all hover:bg-surface-hover hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  <ChevronLeft size={16} />
                </button>

                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }).map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setPage(i)}
                      className={cn(
                        "h-9 min-w-[2.25rem] rounded-xl text-xs font-medium transition-all cursor-pointer",
                        page === i
                          ? "bg-trippy-500 text-white shadow-sm"
                          : "text-muted hover:bg-surface-hover hover:text-foreground"
                      )}
                    >
                      {i + 1}
                    </button>
                  ))}
                </div>

                <button
                  disabled={page >= totalPages - 1}
                  onClick={() => setPage((p) => p + 1)}
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-surface text-muted transition-all hover:bg-surface-hover hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Public / Explore Trips (shown below user content) ────── */}
      {!searchQuery && sortedPublicTrips.length > 0 && (
        <motion.section
          className="mt-12"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-trippy-500 to-trippy-700 text-white shadow-[0_14px_28px_-16px_rgba(18,60,105,0.9)]">
              <Globe2 size={18} />
            </div>
            <div>
              <h2 className="text-xl font-extrabold tracking-tight">Explore public trips</h2>
              <p className="text-xs text-muted">Discover adventures shared by the community</p>
            </div>
          </div>

          {publicLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={20} className="animate-spin text-accent-500" />
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {sortedPublicTrips.map((trip, i) => (
                <motion.div
                  key={trip.tripId}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: i * 0.06 }}
                  onClick={() =>
                    router.push(`/dashboard/trips/${tripSlug(trip.title, trip.tripId)}`)
                  }
                  className="cursor-pointer"
                >
                  <TripCard
                    title={trip.title}
                    destination={trip.destination}
                    startDate={trip.startDate ?? "TBD"}
                    endDate={trip.endDate ?? "TBD"}
                    status={
                      trip.status === "ONGOING"
                        ? "ACTIVE"
                        : (trip.status as
                            | "DRAFT"
                            | "PLANNED"
                            | "ACTIVE"
                            | "COMPLETED"
                            | "CANCELLED")
                    }
                    participantCount={trip.participantCount}
                    coverImageUrl={trip.coverImageUrl}
                    onJoin={() => setJoinModalTripId(trip.tripId)}
                    joinLoading={joiningTripId === trip.tripId}
                    joinRequested={requestedTripIds.has(trip.tripId)}
                  />
                </motion.div>
              ))}
            </div>
          )}
        </motion.section>
      )}
    </>
  );
}
