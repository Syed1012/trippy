"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import {
  ArrowLeft,
  MapPin,
  Calendar,
  Users,
  MessageSquare,
  Loader2,
  Edit,
  Trash2,
  Plus,
  Sparkles,
  Clock,
  ChevronDown,
  ChevronUp,
  X,
  Save,
  Plane,
  Sun,
  Coffee,
  Utensils,
  Camera,
  Moon,
  Wand2,
  Globe,
  DollarSign,
  Navigation,
  Crown,
  Wallet,
  Gem,
  Heart,
  Map,
  ThumbsUp,
  ThumbsDown,
  Lock,
  Vote,
  Settings,
  Search,
  Mail,
  UserPlus,
  Check,
  MessageCircle,
  Send,
  Eye,
  EyeOff,
  TreePalm,
  Mountain,
  Building2,
  Trees,
  Compass,
  Landmark,
  CloudSun,
  Snowflake,
  RefreshCw,
  Star,
  Zap,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { GlassCard, Button, Badge, Avatar } from "@/components/ui";
import { tripsApi, itineraryApi, commentsApi, usersApi, participantsApi, preferencesApi, recommendationsApi, ensureTripCoverImage, type TripDetail, type DayPlan, type Activity, type VoteSummary, type ActivityVoteSummary, type ActivityComment as ActivityCommentType, type UserPublicProfile, type TripType, type PreferredWeather, type BudgetTier, type TripPreferenceInput, type RecommendationResponse } from "@/lib/api";
import { useToast } from "@/lib/toast";
import { cn, tripIdFromSlug } from "@/lib/utils";
import { useRightRail } from "@/lib/right-rail";

const statusVariant: Record<string, "default" | "success" | "warning" | "accent" | "danger"> = {
  DRAFT: "default",
  PLANNED: "accent",
  ONGOING: "success",
  COMPLETED: "warning",
  CANCELLED: "danger",
};

const statusLabel: Record<string, string> = {
  DRAFT: "Draft",
  PLANNED: "Planned",
  ONGOING: "In Progress",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

/* ─── Activity category icons ────────────────────────────────────── */
const categoryIcons: Record<string, typeof Coffee> = {
  morning: Sun,
  breakfast: Coffee,
  lunch: Utensils,
  dinner: Utensils,
  sightseeing: Camera,
  transport: Navigation,
  evening: Moon,
  default: MapPin,
};

function getCategoryIcon(category?: string) {
  if (!category) return categoryIcons.default;
  return categoryIcons[category.toLowerCase()] ?? categoryIcons.default;
}

/* ─── Currency options ────────────────────────────────────────────── */
const currencies = [
  { code: "USD", symbol: "$" },
  { code: "EUR", symbol: "€" },
  { code: "GBP", symbol: "£" },
  { code: "INR", symbol: "₹" },
  { code: "JPY", symbol: "¥" },
  { code: "AUD", symbol: "A$" },
  { code: "CAD", symbol: "C$" },
];

/* ─── Category options ────────────────────────────────────────────── */
const categoryOptions = [
  { key: "sightseeing", label: "Sightseeing", icon: Camera },
  { key: "breakfast", label: "Breakfast", icon: Coffee },
  { key: "lunch", label: "Lunch", icon: Utensils },
  { key: "dinner", label: "Dinner", icon: Utensils },
  { key: "transport", label: "Transport", icon: Navigation },
  { key: "morning", label: "Morning", icon: Sun },
  { key: "evening", label: "Evening", icon: Moon },
  { key: "default", label: "Other", icon: MapPin },
];

/* ─── Time Picker Popup (fixed overlay) ───────────────────────────── */
const hours = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, "0"));
const minutes = ["00", "05", "10", "15", "20", "25", "30", "35", "40", "45", "50", "55"];

function TimePickerPopup({
  value,
  onChange,
  onClose,
  label,
  anchorRef,
}: {
  value: string;
  onChange: (v: string) => void;
  onClose: () => void;
  label: string;
  anchorRef: React.RefObject<HTMLButtonElement | null>;
}) {
  const [selHour, setSelHour] = useState(value ? value.split(":")[0] : "09");
  const [selMin, setSelMin] = useState(value ? value.split(":")[1] : "00");

  // Position relative to the anchor button
  const [pos, setPos] = useState({ top: 0, left: 0 });
  useEffect(() => {
    if (anchorRef.current) {
      const rect = anchorRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 8, left: rect.left });
    }
  }, [anchorRef]);

  function confirm() {
    onChange(`${selHour}:${selMin}`);
    onClose();
  }

  return (
    <>
      {/* Backdrop */}
      <motion.div
        className="fixed inset-0 z-40"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />
      {/* Picker */}
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: -6 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, y: -6 }}
        style={{ top: pos.top, left: pos.left }}
        className="fixed z-50 w-56 rounded-2xl border border-border bg-white p-4 shadow-2xl"
      >
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted mb-2">{label}</p>
        <div className="flex gap-3">
          {/* Hours */}
          <div className="flex-1">
            <p className="text-[9px] text-muted/60 mb-1 text-center">Hour</p>
            <div className="h-36 overflow-y-auto rounded-xl border border-border/60 scrollbar-thin">
              {hours.map((h) => (
                <button
                  key={h}
                  onClick={() => setSelHour(h)}
                  className={cn(
                    "w-full py-1.5 text-xs text-center transition-colors cursor-pointer",
                    selHour === h
                      ? "bg-accent-500 text-white font-bold"
                      : "text-foreground hover:bg-shore-50"
                  )}
                >
                  {h}
                </button>
              ))}
            </div>
          </div>
          {/* Minutes */}
          <div className="flex-1">
            <p className="text-[9px] text-muted/60 mb-1 text-center">Min</p>
            <div className="h-36 overflow-y-auto rounded-xl border border-border/60">
              {minutes.map((m) => (
                <button
                  key={m}
                  onClick={() => setSelMin(m)}
                  className={cn(
                    "w-full py-1.5 text-xs text-center transition-colors cursor-pointer",
                    selMin === m
                      ? "bg-accent-500 text-white font-bold"
                      : "text-foreground hover:bg-shore-50"
                  )}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
        </div>
        <button
          onClick={confirm}
          className="mt-3 w-full rounded-xl bg-accent-500 py-2 text-xs font-bold text-white hover:bg-accent-600 transition-colors cursor-pointer"
        >
          Set {selHour}:{selMin}
        </button>
      </motion.div>
    </>
  );
}

/* ─── Editable Activity Row ──────────────────────────────────────── */
function ActivityRow({
  activity,
  currency,
  onCurrencyChange,
  onUpdate,
  onRemove,
  tripId,
  votingEnabled,
  votingFrozen,
  onActivityVoteUpdate,
  isParticipant,
}: {
  activity: Activity;
  currency: string;
  onCurrencyChange: (c: string) => void;
  onUpdate: (a: Activity) => void;
  onRemove: () => void;
  tripId: string;
  votingEnabled: boolean;
  votingFrozen: boolean;
  onActivityVoteUpdate: (activityId: string, summary: ActivityVoteSummary) => void;
  isParticipant: boolean;
}) {
  const Icon = getCategoryIcon(activity.category);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const startBtnRef = useRef<HTMLButtonElement>(null);
  const endBtnRef = useRef<HTMLButtonElement>(null);

  // Parse time range: "09:00 - 11:00" or just "09:00"
  const timeParts = (activity.time ?? "").split("-").map((s) => s.trim());
  const startTime = timeParts[0] ?? "";
  const endTime = timeParts[1] ?? "";

  function updateTime(start: string, end: string) {
    const combined = end ? `${start} - ${end}` : start;
    onUpdate({ ...activity, time: combined });
  }

  const currencySymbol = currencies.find((c) => c.code === currency)?.symbol ?? "$";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20, transition: { duration: 0.2 } }}
      className="group relative rounded-2xl border border-border/60 bg-white shadow-sm transition-all hover:border-accent-300 hover:shadow-md"
    >
      {/* Top accent bar */}
      <div className="absolute inset-x-0 top-0 h-0.5 rounded-t-2xl bg-gradient-to-r from-accent-400/60 via-accent-500/30 to-transparent" />

      <div className="p-4 space-y-3">
        {/* Row 1: Category icon + Title + Remove */}
        <div className="flex items-center gap-3">
          {/* Category picker button */}
          <div className="relative">
            <button
              onClick={() => setShowCategoryPicker(!showCategoryPicker)}
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-all cursor-pointer",
                "bg-gradient-to-br from-accent-100 to-accent-50 border border-accent-200",
                "hover:from-accent-200 hover:to-accent-100 hover:shadow-sm"
              )}
              title="Change category"
            >
              <Icon size={15} className="text-accent-600" />
            </button>
            {/* Category dropdown */}
            <AnimatePresence>
              {showCategoryPicker && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9, y: -4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: -4 }}
                  className="absolute left-0 top-11 z-20 w-40 rounded-xl border border-border bg-white p-1.5 shadow-xl"
                >
                  {categoryOptions.map((cat) => {
                    const CatIcon = cat.icon;
                    return (
                      <button
                        key={cat.key}
                        onClick={() => {
                          onUpdate({ ...activity, category: cat.key });
                          setShowCategoryPicker(false);
                        }}
                        className={cn(
                          "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs transition-colors cursor-pointer",
                          activity.category === cat.key
                            ? "bg-accent-50 text-accent-700 font-medium"
                            : "text-foreground hover:bg-shore-50"
                        )}
                      >
                        <CatIcon size={13} className={activity.category === cat.key ? "text-accent-500" : "text-muted"} />
                        {cat.label}
                      </button>
                    );
                  })}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Title input */}
          <input
            type="text"
            value={activity.title}
            onChange={(e) => onUpdate({ ...activity, title: e.target.value })}
            placeholder="What are you doing?"
            className="flex-1 bg-transparent text-sm font-semibold text-foreground placeholder:text-muted/40 focus:outline-none"
          />

          {/* Remove button */}
          <button
            onClick={onRemove}
            className="shrink-0 flex h-7 w-7 items-center justify-center rounded-lg text-muted/40 opacity-0 transition-all group-hover:opacity-100 hover:bg-red-50 hover:text-red-500 cursor-pointer"
          >
            <X size={13} />
          </button>
        </div>

        {/* Row 2: Time picker buttons + Cost with currency dropdown */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Start time */}
          <button
            ref={startBtnRef}
            onClick={() => { setShowStartPicker(!showStartPicker); setShowEndPicker(false); }}
            className="flex items-center gap-1.5 rounded-xl bg-shore-50 border border-border/80 px-3 py-2 text-xs font-medium text-foreground hover:border-accent-300 hover:bg-accent-50/30 transition-all cursor-pointer"
          >
            <Clock size={12} className="text-accent-500" />
            <span>{startTime || "Start"}</span>
          </button>
          <AnimatePresence>
            {showStartPicker && (
              <TimePickerPopup
                value={startTime}
                label="Start time"
                anchorRef={startBtnRef}
                onChange={(v) => updateTime(v, endTime)}
                onClose={() => setShowStartPicker(false)}
              />
            )}
          </AnimatePresence>

          <span className="text-[10px] text-muted/50 font-medium">→</span>

          {/* End time */}
          <button
            ref={endBtnRef}
            onClick={() => { setShowEndPicker(!showEndPicker); setShowStartPicker(false); }}
            className="flex items-center gap-1.5 rounded-xl bg-shore-50 border border-border/80 px-3 py-2 text-xs font-medium text-foreground hover:border-accent-300 hover:bg-accent-50/30 transition-all cursor-pointer"
          >
            <Clock size={12} className="text-muted/60" />
            <span>{endTime || "End"}</span>
          </button>
          <AnimatePresence>
            {showEndPicker && (
              <TimePickerPopup
                value={endTime}
                label="End time"
                anchorRef={endBtnRef}
                onChange={(v) => updateTime(startTime, v)}
                onClose={() => setShowEndPicker(false)}
              />
            )}
          </AnimatePresence>

          {/* Cost with inline currency dropdown */}
          <div className="flex items-center gap-1 rounded-xl bg-shore-50 border border-border/80 px-2 py-1.5 ml-auto">
            <div className="relative flex items-center">
              <select
                value={currency}
                onChange={(e) => onCurrencyChange(e.target.value)}
                className="bg-transparent text-[11px] font-bold text-accent-600 focus:outline-none cursor-pointer pr-4 appearance-none"
              >
                {currencies.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.symbol} {c.code}
                  </option>
                ))}
              </select>
              <ChevronDown size={10} className="pointer-events-none absolute right-0 text-accent-500" />
            </div>
            <div className="w-px h-4 bg-border/60 mx-0.5" />
            <input
              type="number"
              min="0"
              step="0.01"
              value={activity.estimatedCost ?? ""}
              onChange={(e) => onUpdate({ ...activity, estimatedCost: e.target.value })}
              placeholder="0.00"
              className="w-16 bg-transparent text-xs font-medium text-foreground placeholder:text-muted/40 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
          </div>
        </div>

        {/* Row 3: Location */}
        <div className="flex items-center gap-2 rounded-xl bg-shore-50/60 border border-border/50 px-3 py-2">
          <MapPin size={12} className="text-muted/60 shrink-0" />
          <input
            type="text"
            value={activity.location ?? ""}
            onChange={(e) => onUpdate({ ...activity, location: e.target.value })}
            placeholder="Add a location..."
            className="flex-1 bg-transparent text-xs text-foreground placeholder:text-muted/40 focus:outline-none"
          />
        </div>

        {/* Row 4: Description / notes */}
        <textarea
          value={activity.description ?? ""}
          onChange={(e) => onUpdate({ ...activity, description: e.target.value })}
          placeholder="Add notes or description..."
          rows={1}
          className="w-full resize-none rounded-xl bg-shore-50/40 border border-border/40 px-3 py-2 text-xs text-foreground placeholder:text-muted/40 focus:border-accent-300 focus:outline-none focus:ring-1 focus:ring-accent-100 transition-colors"
        />

        {/* Activity-level voting */}
        <ActivityVotingBar
          activity={activity}
          tripId={tripId}
          votingEnabled={votingEnabled}
          votingFrozen={votingFrozen}
          onVoteUpdate={onActivityVoteUpdate}
        />

        {/* Activity comments */}
        <ActivityComments activityId={activity.activityId} tripId={tripId} isParticipant={isParticipant} />
      </div>
    </motion.div>
  );
}

/* ─── Activity Comments ───────────────────────────────────────────── */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function ActivityComments({ activityId, tripId, isParticipant }: { activityId: string; tripId: string; isParticipant: boolean }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [comments, setComments] = useState<ActivityCommentType[]>([]);
  const [newComment, setNewComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [count, setCount] = useState<number | null>(null);

  // Only show comments for activities saved to backend (valid UUID)
  if (!UUID_RE.test(activityId)) return null;

  async function loadComments() {
    if (!open) {
      setOpen(true);
      setLoading(true);
      try {
        const data = await commentsApi.list(tripId, activityId);
        setComments(data);
        setCount(data.length);
      } catch { /* ignore */ }
      finally { setLoading(false); }
    } else {
      setOpen(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!newComment.trim() || submitting) return;
    setSubmitting(true);
    try {
      const c = await commentsApi.add(tripId, activityId, newComment.trim());
      setComments((prev) => [...prev, c]);
      setCount((prev) => (prev ?? 0) + 1);
      setNewComment("");
    } catch { /* ignore */ }
    finally { setSubmitting(false); }
  }

  async function handleDelete(commentId: string) {
    try {
      await commentsApi.delete(tripId, activityId, commentId);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
      setCount((prev) => Math.max(0, (prev ?? 1) - 1));
    } catch { /* ignore */ }
  }

  return (
    <div className="border-t border-border/30 pt-2">
      <button
        onClick={loadComments}
        className="flex items-center gap-1.5 text-[11px] text-muted hover:text-foreground transition-colors cursor-pointer"
      >
        <MessageCircle size={11} />
        <span>{open ? "Hide" : "Comments"}{count !== null && count > 0 ? ` (${count})` : ""}</span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-2 space-y-2">
              {loading ? (
                <p className="text-[10px] text-muted">Loading...</p>
              ) : comments.length === 0 ? (
                <p className="text-[10px] text-muted italic">No comments yet. Be the first to suggest something!</p>
              ) : (
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {comments.map((c) => (
                    <div key={c.id} className="flex items-start gap-2 rounded-lg bg-shore-50/60 px-2.5 py-1.5">
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] text-foreground leading-snug">{c.content}</p>
                        <p className="text-[9px] text-muted mt-0.5">
                          {new Date(c.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                      {c.userId === user?.userId && (
                        <button
                          onClick={() => handleDelete(c.id)}
                          className="shrink-0 text-muted/50 hover:text-red-500 transition-colors cursor-pointer"
                        >
                          <X size={10} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* New comment form — only for participants */}
              {isParticipant && (
                <form onSubmit={handleSubmit} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Add a suggestion..."
                    maxLength={1000}
                    className="flex-1 rounded-lg bg-white border border-border/60 px-2.5 py-1.5 text-[11px] text-foreground placeholder:text-muted/50 focus:outline-none focus:border-accent-300"
                  />
                  <button
                    type="submit"
                    disabled={!newComment.trim() || submitting}
                    className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent-500 text-white hover:bg-accent-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                  >
                    <Send size={11} />
                  </button>
                </form>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── Day Card ────────────────────────────────────────────────────── */
function VotingBar({
  day,
  tripId,
  onVoteUpdate,
}: {
  day: DayPlan;
  tripId: string;
  onVoteUpdate: (dayNumber: number, summary: VoteSummary) => void;
}) {
  const [voting, setVoting] = useState(false);

  if (!day.votingEnabled) return null;

  const totalVotes = (day.upvotes ?? 0) + (day.downvotes ?? 0);
  const upPercent = totalVotes > 0 ? Math.round(((day.upvotes ?? 0) / totalVotes) * 100) : 0;

  async function handleVote(voteType: "UPVOTE" | "DOWNVOTE") {
    if (day.votingFrozen || voting) return;
    setVoting(true);
    try {
      // If user already voted the same, remove vote
      if (day.currentUserVote === voteType) {
        const summary = await itineraryApi.removeVote(tripId, day.dayNumber);
        onVoteUpdate(day.dayNumber, summary);
      } else {
        const summary = await itineraryApi.castVote(tripId, day.dayNumber, voteType);
        onVoteUpdate(day.dayNumber, summary);
      }
    } catch {
      // silently fail
    } finally {
      setVoting(false);
    }
  }

  const deadlineStr = day.votingDeadline
    ? new Date(day.votingDeadline).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <div className="flex items-center gap-3 mt-2" onClick={(e) => e.stopPropagation()}>
      {/* Vote buttons */}
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => handleVote("UPVOTE")}
          disabled={day.votingFrozen || voting}
          className={cn(
            "flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all cursor-pointer",
            day.currentUserVote === "UPVOTE"
              ? "bg-green-100 text-green-700 border border-green-300 shadow-sm"
              : "bg-shore-50 text-muted border border-border/60 hover:border-green-300 hover:text-green-600",
            (day.votingFrozen || voting) && "opacity-50 cursor-not-allowed"
          )}
        >
          <ThumbsUp size={12} />
          <span>{day.upvotes ?? 0}</span>
        </button>
        <button
          onClick={() => handleVote("DOWNVOTE")}
          disabled={day.votingFrozen || voting}
          className={cn(
            "flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all cursor-pointer",
            day.currentUserVote === "DOWNVOTE"
              ? "bg-red-100 text-red-700 border border-red-300 shadow-sm"
              : "bg-shore-50 text-muted border border-border/60 hover:border-red-300 hover:text-red-600",
            (day.votingFrozen || voting) && "opacity-50 cursor-not-allowed"
          )}
        >
          <ThumbsDown size={12} />
          <span>{day.downvotes ?? 0}</span>
        </button>
      </div>

      {/* Progress bar */}
      {totalVotes > 0 && (
        <div className="flex-1 max-w-24">
          <div className="h-1.5 rounded-full bg-shore-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-green-400 to-green-500 transition-all"
              style={{ width: `${upPercent}%` }}
            />
          </div>
        </div>
      )}

      {/* Frozen indicator */}
      {day.votingFrozen && (
        <span className="flex items-center gap-1 text-[10px] font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
          <Lock size={9} /> Frozen
        </span>
      )}

      {/* Deadline */}
      {!day.votingFrozen && deadlineStr && (
        <span className="text-[10px] text-muted">
          Ends {deadlineStr}
        </span>
      )}
    </div>
  );
}

/* ─── Activity Voting Bar ─────────────────────────────────────────── */
function ActivityVotingBar({
  activity,
  tripId,
  votingEnabled,
  votingFrozen,
  onVoteUpdate,
}: {
  activity: Activity;
  tripId: string;
  votingEnabled: boolean;
  votingFrozen: boolean;
  onVoteUpdate: (activityId: string, summary: ActivityVoteSummary) => void;
}) {
  const [voting, setVoting] = useState(false);

  if (!votingEnabled) return null;

  const up = activity.upvotes ?? 0;
  const down = activity.downvotes ?? 0;
  const total = up + down;
  const upPct = total > 0 ? Math.round((up / total) * 100) : 0;

  async function handleVote(voteType: "UPVOTE" | "DOWNVOTE") {
    if (votingFrozen || voting) return;
    setVoting(true);
    try {
      if (activity.currentUserVote === voteType) {
        const summary = await itineraryApi.removeActivityVote(tripId, activity.activityId);
        onVoteUpdate(activity.activityId, summary);
      } else {
        const summary = await itineraryApi.castActivityVote(tripId, activity.activityId, voteType);
        onVoteUpdate(activity.activityId, summary);
      }
    } catch {
      // silently fail
    } finally {
      setVoting(false);
    }
  }

  return (
    <div className="flex items-center gap-2 pt-2 border-t border-border/30" onClick={(e) => e.stopPropagation()}>
      <span className="text-[10px] text-muted mr-1">Vote:</span>
      <button
        onClick={() => handleVote("UPVOTE")}
        disabled={votingFrozen || voting}
        className={cn(
          "flex items-center gap-0.5 rounded-lg px-2 py-1 text-[11px] font-medium transition-all cursor-pointer",
          activity.currentUserVote === "UPVOTE"
            ? "bg-green-100 text-green-700 border border-green-300"
            : "bg-shore-50 text-muted border border-border/60 hover:border-green-300 hover:text-green-600",
          (votingFrozen || voting) && "opacity-50 cursor-not-allowed"
        )}
      >
        <ThumbsUp size={10} />
        <span>{up}</span>
      </button>
      <button
        onClick={() => handleVote("DOWNVOTE")}
        disabled={votingFrozen || voting}
        className={cn(
          "flex items-center gap-0.5 rounded-lg px-2 py-1 text-[11px] font-medium transition-all cursor-pointer",
          activity.currentUserVote === "DOWNVOTE"
            ? "bg-red-100 text-red-700 border border-red-300"
            : "bg-shore-50 text-muted border border-border/60 hover:border-red-300 hover:text-red-600",
          (votingFrozen || voting) && "opacity-50 cursor-not-allowed"
        )}
      >
        <ThumbsDown size={10} />
        <span>{down}</span>
      </button>
      {total > 0 && (
        <div className="flex-1 max-w-16">
          <div className="h-1 rounded-full bg-shore-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-green-400 to-green-500 transition-all"
              style={{ width: `${upPct}%` }}
            />
          </div>
        </div>
      )}
      {votingFrozen && (
        <span className="flex items-center gap-0.5 text-[9px] font-medium text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full border border-amber-200">
          <Lock size={8} /> Frozen
        </span>
      )}
    </div>
  );
}

function DayCard({
  day,
  tripId,
  tripStartDate,
  expanded,
  onToggle,
  onUpdateDay,
  currency,
  onCurrencyChange,
  onVoteUpdate,
  isParticipant,
}: {
  day: DayPlan;
  tripId: string;
  tripStartDate?: string;
  expanded: boolean;
  onToggle: () => void;
  onUpdateDay: (d: DayPlan) => void;
  currency: string;
  onCurrencyChange: (c: string) => void;
  onVoteUpdate: (dayNumber: number, summary: VoteSummary) => void;
  isParticipant: boolean;
}) {
  const dayDate = tripStartDate
    ? new Date(new Date(tripStartDate).getTime() + (day.dayNumber - 1) * 86400000).toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      })
    : null;

  function addActivity() {
    const newActivity: Activity = {
      activityId: `temp-${Date.now()}-${Math.random()}`,
      title: "",
      time: "",
      description: "",
      location: "",
      category: "default",
      estimatedCost: "",
    };
    onUpdateDay({ ...day, activities: [...day.activities, newActivity] });
  }

  function updateActivity(idx: number, updated: Activity) {
    const acts = [...day.activities];
    acts[idx] = updated;
    onUpdateDay({ ...day, activities: acts });
  }

  function removeActivity(idx: number) {
    onUpdateDay({ ...day, activities: day.activities.filter((_, i) => i !== idx) });
  }

  function handleActivityVoteUpdate(activityId: string, summary: ActivityVoteSummary) {
    const acts = day.activities.map((a) =>
      a.activityId === activityId
        ? { ...a, upvotes: summary.upvotes, downvotes: summary.downvotes, currentUserVote: summary.currentUserVote }
        : a
    );
    onUpdateDay({ ...day, activities: acts });
  }

  const totalCost = day.activities.reduce((sum, a) => {
    const cost = parseFloat(a.estimatedCost ?? "0");
    return sum + (isNaN(cost) ? 0 : cost);
  }, 0);

  return (
    <motion.div
      layout
      className={cn(
        "group/day relative overflow-hidden rounded-[1.35rem] border transition-all duration-300",
        expanded
          ? "border-accent-300/60 bg-white shadow-[0_28px_56px_-30px_rgba(231,111,81,0.5)]"
          : "border-white/70 bg-white/80 backdrop-blur-md hover:border-accent-300/50 hover:shadow-[0_20px_44px_-28px_rgba(20,47,43,0.5)]",
      )}
    >
      {/* Left timeline accent */}
      <div
        className={cn(
          "absolute inset-y-0 left-0 w-1 transition-colors",
          expanded
            ? "bg-gradient-to-b from-accent-400 to-accent-600"
            : "bg-transparent group-hover/day:bg-accent-200",
        )}
      />

      {/* Day header */}
      <div className="p-5">
        <div
          role="button"
          tabIndex={0}
          onClick={onToggle}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onToggle(); }}
          className="flex w-full items-center gap-4 text-left cursor-pointer"
        >
          <div
            className={cn(
              "flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-2xl font-black leading-none transition-all",
              expanded
                ? "bg-gradient-to-br from-accent-400 to-accent-600 text-white shadow-[0_12px_24px_-10px_rgba(231,111,81,0.7)]"
                : "bg-gradient-to-br from-shore-100 to-shore-200 text-trippy-500",
            )}
          >
            <span className="text-[8px] font-bold uppercase tracking-wider opacity-70">Day</span>
            <span className="text-lg">{day.dayNumber}</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={day.title ?? ""}
                onChange={(e) => {
                  e.stopPropagation();
                  onUpdateDay({ ...day, title: e.target.value });
                }}
                onClick={(e) => e.stopPropagation()}
                placeholder={`Day ${day.dayNumber} — Give it a title`}
                className={cn(
                  "flex-1 bg-transparent text-sm font-bold placeholder:text-muted/50 focus:outline-none",
                  expanded ? "text-foreground" : "text-foreground"
                )}
              />
            </div>
            <div className="flex items-center gap-3 mt-0.5">
              {dayDate && (
                <span className="text-[11px] text-muted flex items-center gap-1">
                  <Calendar size={10} /> {dayDate}
                </span>
              )}
              <span className="text-[11px] text-muted">
                {day.activities.length} activit{day.activities.length !== 1 ? "ies" : "y"}
              </span>
              {totalCost > 0 && (
                <span className="text-[11px] text-accent-600 font-medium flex items-center gap-0.5">
                  <DollarSign size={9} /> ~{currencies.find((c) => c.code === currency)?.symbol ?? "$"}{totalCost.toFixed(0)}
                </span>
              )}
            </div>
          </div>
          <div
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-xl transition-colors",
              expanded ? "bg-accent-100 text-accent-600" : "bg-shore-100 text-muted"
            )}
          >
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </div>
        </div>
        {/* Voting bar - outside the toggle to avoid button-in-button */}
        <VotingBar day={day} tripId={tripId} onVoteUpdate={onVoteUpdate} />
      </div>

      {/* Day content */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 space-y-3">
              {/* Activities list */}
              <AnimatePresence>
                {day.activities.map((activity, idx) => (
                  <ActivityRow
                    key={activity.activityId}
                    activity={activity}
                    currency={currency}
                    onCurrencyChange={onCurrencyChange}
                    onUpdate={(a) => updateActivity(idx, a)}
                    onRemove={() => removeActivity(idx)}
                    tripId={tripId}
                    votingEnabled={day.votingEnabled ?? false}
                    votingFrozen={day.votingFrozen ?? false}
                    onActivityVoteUpdate={handleActivityVoteUpdate}
                    isParticipant={isParticipant}
                  />
                ))}
              </AnimatePresence>

              {/* Empty state */}
              {day.activities.length === 0 && (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-shore-100 mb-3">
                    <Plane size={20} className="text-muted/50" />
                  </div>
                  <p className="text-sm text-muted/70">No activities yet</p>
                  <p className="text-xs text-muted/50 mt-0.5">Add activities or let AI plan this day</p>
                </div>
              )}

              {/* Add activity button */}
              {isParticipant && (
                <button
                  onClick={addActivity}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border py-3 text-xs font-medium text-muted transition-all hover:border-accent-400 hover:text-accent-600 hover:bg-accent-50/50 cursor-pointer"
                >
                  <Plus size={14} /> Add activity
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ─── AI Itinerary Studio (immersive right sidebar — design preview) ─── */
// Resizable rail sizing (px)
const AI_MIN_W = 360;
const AI_MAX_W = 760;
const AI_DEFAULT_W = 460;
const AI_RAIL_GAP = 32; // breathing room between content and the floating panel
const AI_MIN_RESERVE = 64; // space kept for the collapsed tab
const AI_RIGHT_GAP = 16; // panel distance from the right viewport edge (right-4)

interface AISuggestion {
  id: string;
  vibe: "Top Pick" | "Adventurer" | "Hidden Gem";
  title: string;
  startTime: string;
  endTime: string;
  cost: number;
  mapsUrl: string;
  notes: string;
}

const AI_VIBES: Record<
  AISuggestion["vibe"],
  { icon: typeof Star; gradient: string; chip: string; bar: string; glow: string }
> = {
  "Top Pick": {
    icon: Star,
    gradient: "from-accent-400 to-accent-600",
    chip: "bg-accent-500/12 text-accent-700 border-accent-400/40",
    bar: "from-accent-400 to-accent-600",
    glow: "rgba(231,111,81,0.32)",
  },
  "Adventurer": {
    icon: Zap,
    gradient: "from-sky-400 to-blue-600",
    chip: "bg-sky-500/12 text-sky-700 border-sky-400/40",
    bar: "from-sky-400 to-blue-600",
    glow: "rgba(56,152,236,0.3)",
  },
  "Hidden Gem": {
    icon: Heart,
    gradient: "from-emerald-400 to-teal-600",
    chip: "bg-emerald-500/12 text-emerald-700 border-emerald-400/40",
    bar: "from-emerald-400 to-teal-600",
    glow: "rgba(45,212,160,0.3)",
  },
};

function buildDaySuggestions(day: number, destination: string): AISuggestion[] {
  const city = destination.split(",")[0]?.trim() || destination || "your destination";
  const maps = (q: string) =>
    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${q} ${city}`)}`;
  const rot = <T,>(arr: T[]) => arr[(day - 1) % arr.length];
  const stamp = `${day}-${Math.random().toString(36).slice(2, 7)}`;

  const top = rot([
    `Iconic ${city} Highlights`,
    `Landmarks & Local Flavors of ${city}`,
    `${city} Old Town & Skyline`,
    `Best of ${city} in a Day`,
  ]);
  const adv = rot([
    `${city} Trails & Viewpoints`,
    `Sunrise Hike & River Day`,
    `Adventure Circuit near ${city}`,
    `Cliffs, Kayaks & Peaks`,
  ]);
  const gem = rot([
    `Secret ${city} Neighborhoods`,
    `Artisan Lanes & Hidden Cafés`,
    `Backstreet ${city} Food Crawl`,
    `Quiet Gardens & Local Markets`,
  ]);

  return [
    {
      id: `s-top-${stamp}`,
      vibe: "Top Pick",
      title: top,
      startTime: "09:00",
      endTime: "18:30",
      cost: 85,
      mapsUrl: maps(top),
      notes: `A crowd-pleasing blend of ${city}'s signature sights, a leisurely local lunch, and a golden-hour viewpoint to finish.`,
    },
    {
      id: `s-adv-${stamp}`,
      vibe: "Adventurer",
      title: adv,
      startTime: "07:30",
      endTime: "17:00",
      cost: 120,
      mapsUrl: maps(adv),
      notes: `Early start, scenic trails and one big adrenaline hit — wrapped up with a well-earned meal and a view.`,
    },
    {
      id: `s-gem-${stamp}`,
      vibe: "Hidden Gem",
      title: gem,
      startTime: "10:30",
      endTime: "20:00",
      cost: 55,
      mapsUrl: maps(gem),
      notes: `Skip the crowds and roam where locals go — indie cafés, tiny galleries and flavors the guidebooks miss.`,
    },
  ];
}

const VIBE_ORDER: AISuggestion["vibe"][] = ["Top Pick", "Adventurer", "Hidden Gem"];

/* Map a backend recommendation response into per-day suggestion cards. */
function groupRecommendations(
  res: RecommendationResponse,
  destination: string,
): Record<number, AISuggestion[]> {
  const map: Record<number, AISuggestion[]> = {};
  for (const day of res.days ?? []) {
    const options = (day.options ?? []).slice(0, 3).map((o, i) => {
      const vibe = VIBE_ORDER.includes(o.vibe as AISuggestion["vibe"])
        ? (o.vibe as AISuggestion["vibe"])
        : VIBE_ORDER[i] ?? "Top Pick";
      return {
        id: o.id || `s-${day.dayNumber}-${i}-${Math.random().toString(36).slice(2, 7)}`,
        vibe,
        title: o.title,
        startTime: o.startTime ?? "",
        endTime: o.endTime ?? "",
        cost: typeof o.cost === "number" ? o.cost : 0,
        mapsUrl:
          o.mapsUrl ||
          `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${o.title} ${destination}`)}`,
        notes: o.notes ?? "",
      } satisfies AISuggestion;
    });
    map[day.dayNumber] = options.length ? options : buildDaySuggestions(day.dayNumber, destination);
  }
  return map;
}

/* Rotating status line for the AI loading state */
function AILoadingMessages({ messages }: { messages: string[] }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((v) => (v + 1) % messages.length), 900);
    return () => clearInterval(t);
  }, [messages.length]);
  return (
    <div className="text-center">
      <p className="text-sm font-bold text-foreground">Crafting your itinerary</p>
      <AnimatePresence mode="wait">
        <motion.p
          key={i}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.3 }}
          className="mt-1 text-xs text-muted"
        >
          {messages[i]}
        </motion.p>
      </AnimatePresence>
    </div>
  );
}

function AIItinerarySidebar({
  open,
  minimized,
  width,
  onClose,
  onMinimize,
  onExpand,
  onResize,
  onDragChange,
  tripId,
  destination,
  numDays,
  currencySymbol,
  existingItinerary,
  onApply,
}: {
  open: boolean;
  minimized: boolean;
  width: number;
  onClose: () => void;
  onMinimize: () => void;
  onExpand: () => void;
  onResize: (px: number) => void;
  onDragChange: (value: boolean) => void;
  tripId: string;
  destination: string;
  numDays: number;
  currencySymbol: string;
  existingItinerary: DayPlan[];
  onApply: (dayNumber: number, suggestion: AISuggestion) => void;
}) {
  const { addToast } = useToast();
  const days = Math.max(1, numDays);
  const [phase, setPhase] = useState<"loading" | "ready">("loading");
  const [activeDay, setActiveDay] = useState(1);
  const [suggestions, setSuggestions] = useState<Record<number, AISuggestion[]>>({});
  const [chosen, setChosen] = useState<Record<number, string>>({});
  const [regenning, setRegenning] = useState(false);
  const prefsRef = useRef<TripPreferenceInput | undefined>(undefined);

  // A fresh mount (keyed per open by the parent) fetches real recommendations once.
  useEffect(() => {
    let cancelled = false;

    const localFallback = () => {
      const map: Record<number, AISuggestion[]> = {};
      for (let d = 1; d <= days; d++) map[d] = buildDaySuggestions(d, destination);
      return map;
    };

    (async () => {
      let preferences: TripPreferenceInput | undefined;
      try {
        const p = await preferencesApi.getForTrip(tripId);
        preferences = {
          tripType: p.tripType,
          budgetTier: p.budgetTier,
          preferredWeather: p.preferredWeather,
          notes: p.notes,
        };
      } catch {
        preferences = undefined;
      }
      prefsRef.current = preferences;

      try {
        const res = await recommendationsApi.generate({
          tripId,
          destination,
          days,
          preferences,
          existingItinerary: existingItinerary
            .filter((d) => d.activities.length > 0 || Boolean(d.title?.trim()))
            .map((d) => ({
              dayNumber: d.dayNumber,
              title: d.title,
              activities: d.activities.map((a) => ({
                time: a.time,
                title: a.title,
                estimatedCost: a.estimatedCost,
              })),
            })),
        });
        if (cancelled) return;
        const grouped = groupRecommendations(res, destination);
        // Ensure every day has cards even if the model skipped some.
        for (let d = 1; d <= days; d++) {
          if (!grouped[d]?.length) grouped[d] = buildDaySuggestions(d, destination);
        }
        setSuggestions(grouped);
        setPhase("ready");
      } catch {
        if (cancelled) return;
        setSuggestions(localFallback());
        setPhase("ready");
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function regenerateDay() {
    setRegenning(true);
    try {
      const res = await recommendationsApi.generate({
        tripId,
        destination,
        days,
        dayNumber: activeDay,
        preferences: prefsRef.current,
      });
      const grouped = groupRecommendations(res, destination);
      setSuggestions((prev) => ({
        ...prev,
        [activeDay]: grouped[activeDay]?.length
          ? grouped[activeDay]
          : buildDaySuggestions(activeDay, destination),
      }));
    } catch {
      setSuggestions((prev) => ({ ...prev, [activeDay]: buildDaySuggestions(activeDay, destination) }));
    } finally {
      setChosen((prev) => {
        const next = { ...prev };
        delete next[activeDay];
        return next;
      });
      setRegenning(false);
    }
  }

  function choose(s: AISuggestion) {
    setChosen((prev) => ({ ...prev, [activeDay]: s.id }));
    onApply(activeDay, s);
    addToast(`Added “${s.title}” to Day ${activeDay}`, "success");
  }

  // Drag the left edge to resize the rail (content reflows live, Copilot-style).
  function startDrag(e: React.PointerEvent) {
    e.preventDefault();
    onDragChange(true);
    document.body.style.userSelect = "none";
    document.body.style.cursor = "ew-resize";
    const move = (ev: PointerEvent) => {
      onResize(window.innerWidth - ev.clientX - AI_RIGHT_GAP);
    };
    const up = () => {
      onDragChange(false);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  const daySuggestions = suggestions[activeDay] ?? [];
  const chosenCount = Object.keys(chosen).length;
  const city = destination.split(",")[0]?.trim() || "your destination";
  const loadingMessages = [
    `Scanning the best of ${city}…`,
    "Balancing sights, food & downtime…",
    "Pricing activities & routes…",
    "Polishing your day-by-day plan…",
  ];

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {/* Minimized vertical tab */}
      {open && minimized && (
        <motion.div
          key="ai-tab"
          className="fixed right-0 top-1/2 z-40 -translate-y-1/2"
          initial={{ x: "110%" }}
          animate={{ x: 0 }}
          exit={{ x: "110%" }}
          transition={{ type: "spring", stiffness: 320, damping: 34 }}
        >
          <button
            onClick={onExpand}
            title="Expand AI suggestions"
            className="group flex flex-col items-center gap-3 rounded-l-2xl border border-r-0 border-border bg-surface/95 py-5 pl-3 pr-2.5 shadow-[-18px_0_50px_-30px_rgba(20,47,43,0.55)] backdrop-blur-xl transition-all hover:pr-4 cursor-pointer"
          >
            <span className="lux-ring flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-accent-400 to-accent-600 text-white shadow-[0_10px_20px_-10px_rgba(231,111,81,0.9)]">
              <Wand2 size={16} />
            </span>
            <span className="text-[11px] font-black uppercase tracking-[0.16em] text-foreground [writing-mode:vertical-rl]">
              AI suggestions
            </span>
            {chosenCount > 0 && (
              <span className="rounded-full bg-accent-500 px-1.5 py-0.5 text-[9px] font-black text-white">
                {chosenCount}
              </span>
            )}
            <ChevronLeft
              size={16}
              className="text-muted transition group-hover:-translate-x-0.5 group-hover:text-accent-600"
            />
          </button>
        </motion.div>
      )}

      {/* Full panel */}
      {open && !minimized && (
        <motion.aside
          key="ai-panel"
          style={{ width }}
          className="fixed right-4 top-[4.75rem] bottom-4 z-40 flex flex-col overflow-hidden rounded-[1.75rem] border border-border bg-surface/95 text-foreground shadow-[0_40px_90px_-42px_rgba(20,47,43,0.62)] backdrop-blur-2xl"
          initial={{ x: "112%", opacity: 0.5 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: "112%", opacity: 0.4 }}
          transition={{ type: "spring", stiffness: 320, damping: 36 }}
        >
          {/* Drag-to-resize handle (left edge) */}
          <div
            onPointerDown={startDrag}
            title="Drag to resize"
            className="group/handle absolute inset-y-0 left-0 z-30 flex w-4 cursor-ew-resize items-center justify-center"
          >
            <span className="h-14 w-1.5 rounded-full bg-border transition-all group-hover/handle:h-20 group-hover/handle:bg-accent-400" />
          </div>

          {/* Warm ambient accents */}
          <div className="pointer-events-none absolute -top-24 -right-16 h-72 w-72 rounded-full bg-accent-400/15 blur-3xl" />
          <div className="pointer-events-none absolute top-1/3 -left-24 h-64 w-64 rounded-full bg-trippy-400/10 blur-3xl" />

          {/* Header */}
          <div className="relative z-10 shrink-0 border-b border-border/70 px-5 pt-5 pb-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="lux-ring relative flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-accent-400 to-accent-600 text-white shadow-[0_16px_32px_-14px_rgba(231,111,81,0.9)]">
                  <Wand2 size={19} />
                </div>
                <div>
                  <h3 className="font-display text-lg font-black leading-tight">AI Itinerary Studio</h3>
                  <p className="text-[11px] text-muted">
                    {destination} · {days} day{days !== 1 ? "s" : ""} · 3 ideas each
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={onMinimize}
                  title="Minimize to side"
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-shore-100 text-muted transition hover:bg-shore-200 hover:text-foreground cursor-pointer"
                >
                  <ChevronRight size={16} />
                </button>
                <button
                  onClick={onClose}
                  title="Close"
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-shore-100 text-muted transition hover:bg-shore-200 hover:text-foreground cursor-pointer"
                >
                  <X size={15} />
                </button>
              </div>
            </div>
          </div>

          {phase === "loading" ? (
            /* Loading phase */
            <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-6 px-8">
              <div className="relative flex h-28 w-28 items-center justify-center">
                <span className="absolute inset-0 animate-ping rounded-full bg-accent-500/15" />
                <span className="absolute inset-2 rounded-full border-2 border-dashed border-accent-200 animate-[spin_9s_linear_infinite]" />
                <div className="lux-ring flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-accent-400 to-accent-600 text-white shadow-[0_0_40px_-6px_rgba(231,111,81,0.7)]">
                  <Sparkles size={26} />
                </div>
              </div>
              <AILoadingMessages messages={loadingMessages} />
              <div className="w-full max-w-xs space-y-3">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="h-16 animate-pulse rounded-2xl bg-shore-200/60"
                    style={{ animationDelay: `${i * 150}ms` }}
                  />
                ))}
              </div>
            </div>
          ) : (
            <>
              {/* Day tabs */}
              <div className="relative z-10 shrink-0 border-b border-border/70 bg-shore-50/50 px-4 py-3">
                <div className="no-scrollbar flex gap-2 overflow-x-auto">
                  {Array.from({ length: days }, (_, i) => i + 1).map((d) => {
                    const active = d === activeDay;
                    const done = Boolean(chosen[d]);
                    return (
                      <button
                        key={d}
                        onClick={() => setActiveDay(d)}
                        className={cn(
                          "relative flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold transition-all cursor-pointer",
                          active ? "text-white" : "text-muted hover:text-foreground",
                        )}
                      >
                        {active && (
                          <motion.span
                            layoutId="ai-day-pill"
                            className="absolute inset-0 rounded-full bg-gradient-to-r from-accent-500 to-accent-600 shadow-[0_10px_20px_-10px_rgba(231,111,81,0.9)]"
                            transition={{ type: "spring", stiffness: 420, damping: 34 }}
                          />
                        )}
                        <span className="relative z-10">Day {d}</span>
                        {done && (
                          <Check
                            size={12}
                            className={cn("relative z-10", active ? "text-white" : "text-accent-500")}
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Suggestions */}
              <div className="relative z-10 flex-1 overflow-y-auto px-5 py-5">
                <div className="mb-4 flex items-center justify-between">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-muted">
                    Day {activeDay} · pick your vibe
                  </p>
                  <button
                    onClick={regenerateDay}
                    disabled={regenning}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface/70 px-3 py-1 text-[11px] font-bold text-muted transition hover:border-accent-300 hover:text-foreground disabled:opacity-50 cursor-pointer"
                  >
                    <RefreshCw size={12} className={cn(regenning && "animate-spin")} />
                    {regenning ? "Reimagining…" : "Regenerate"}
                  </button>
                </div>

                <AnimatePresence mode="wait">
                  <motion.div
                    key={`${activeDay}-${regenning}`}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.25 }}
                    className="space-y-4"
                  >
                    {daySuggestions.map((s, idx) => {
                      const vibe = AI_VIBES[s.vibe];
                      const VibeIcon = vibe.icon;
                      const isChosen = chosen[activeDay] === s.id;
                      return (
                        <motion.div
                          key={s.id}
                          initial={{ opacity: 0, y: 16 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: idx * 0.08, type: "spring", stiffness: 260, damping: 24 }}
                          className={cn(
                            "group relative overflow-hidden rounded-2xl border p-4 pl-5 backdrop-blur-sm transition-all",
                            isChosen
                              ? "border-accent-400 bg-accent-50 shadow-[0_18px_40px_-26px_rgba(231,111,81,0.55)]"
                              : "border-border bg-surface/80 shadow-[0_16px_36px_-26px_rgba(20,47,43,0.42)] hover:-translate-y-0.5 hover:shadow-[0_24px_48px_-24px_rgba(231,111,81,0.4)]",
                          )}
                        >
                          {/* left vibe accent bar */}
                          <div className={cn("absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b", vibe.bar)} />
                          {/* corner glow */}
                          <div
                            className="pointer-events-none absolute -right-8 -top-10 h-24 w-24 rounded-full opacity-50 blur-2xl transition-opacity group-hover:opacity-90"
                            style={{ background: vibe.glow }}
                          />

                          {/* header row */}
                          <div className="relative flex items-center justify-between">
                            <span
                              className={cn(
                                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wider",
                                vibe.chip,
                              )}
                            >
                              <VibeIcon size={11} /> {s.vibe}
                            </span>
                            <span className="text-[10px] font-bold text-muted">Option {idx + 1}/3</span>
                          </div>

                          {/* title */}
                          <h4 className="relative mt-3 text-[15px] font-extrabold leading-snug text-foreground">
                            {s.title}
                          </h4>

                          {/* meta chips */}
                          <div className="relative mt-3 flex flex-wrap gap-2">
                            <span className="inline-flex items-center gap-1.5 rounded-lg bg-shore-100/80 px-2.5 py-1 text-[11px] font-semibold text-foreground/75">
                              <Clock size={11} className="text-accent-500" /> {s.startTime}–{s.endTime}
                            </span>
                            <span className="inline-flex items-center gap-1.5 rounded-lg bg-shore-100/80 px-2.5 py-1 text-[11px] font-semibold text-foreground/75">
                              <DollarSign size={11} className="text-emerald-600" /> ~{currencySymbol}
                              {s.cost}
                            </span>
                            <a
                              href={s.mapsUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-shore-100/80 px-2.5 py-1 text-[11px] font-semibold text-foreground/75 transition hover:bg-accent-50 hover:text-accent-700"
                            >
                              <MapPin size={11} className="text-sky-600" /> Maps
                              <ArrowUpRight size={10} />
                            </a>
                          </div>

                          {/* notes */}
                          <p className="relative mt-3 text-xs leading-relaxed text-muted">{s.notes}</p>

                          {/* CTA */}
                          <button
                            onClick={() => choose(s)}
                            className={cn(
                              "relative mt-4 flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-bold transition-all cursor-pointer",
                              isChosen
                                ? "border border-emerald-400/50 bg-emerald-50 text-emerald-700"
                                : cn(
                                    "bg-gradient-to-r text-white shadow-[0_14px_28px_-16px_rgba(20,47,43,0.6)] hover:-translate-y-0.5",
                                    vibe.gradient,
                                  ),
                            )}
                          >
                            {isChosen ? (
                              <>
                                <Check size={14} /> Added to Day {activeDay}
                              </>
                            ) : (
                              <>
                                <Plus size={14} /> Add as Day {activeDay} plan
                              </>
                            )}
                          </button>
                        </motion.div>
                      );
                    })}
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Footer progress */}
              <div className="relative z-10 shrink-0 border-t border-border/70 bg-shore-50/50 px-5 py-4">
                <div className="mb-2 flex items-center justify-between text-[11px] font-bold text-muted">
                  <span>
                    {chosenCount} of {days} days chosen
                  </span>
                  <span>{Math.round((chosenCount / days) * 100)}%</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-shore-200">
                  <motion.div
                    className="h-full rounded-full bg-gradient-to-r from-accent-400 to-accent-600"
                    animate={{ width: `${(chosenCount / days) * 100}%` }}
                    transition={{ type: "spring", stiffness: 200, damping: 28 }}
                  />
                </div>
                <button
                  onClick={onClose}
                  className="mt-3 w-full rounded-xl border border-border bg-surface py-2.5 text-xs font-bold text-foreground transition hover:bg-shore-50 cursor-pointer"
                >
                  Done for now
                </button>
              </div>
            </>
          )}
        </motion.aside>
      )}
    </AnimatePresence>,
    document.body,
  );
}

/* ─── Voting Settings Panel (admin only) ──────────────────────────── */
function VotingSettingsPanel({
  tripId,
  itineraryDays,
  onUpdate,
  onClose,
}: {
  tripId: string;
  itineraryDays: DayPlan[];
  onUpdate: (days: DayPlan[]) => void;
  onClose: () => void;
}) {
  const { addToast } = useToast();
  const [saving, setSaving] = useState(false);
  const votingCurrentlyEnabled = itineraryDays.some((d) => d.votingEnabled);
  const currentDeadline = itineraryDays.find((d) => d.votingDeadline)?.votingDeadline ?? "";
  const [deadline, setDeadline] = useState(
    currentDeadline ? new Date(currentDeadline).toISOString().slice(0, 16) : ""
  );

  // Check if itinerary has been saved to backend (temp IDs start with "day-" or "ai-")
  const itinerarySaved = itineraryDays.length > 0 &&
    !itineraryDays[0].dayPlanId.startsWith("day-") &&
    !itineraryDays[0].dayPlanId.startsWith("ai-");

  async function toggleVoting(enable: boolean) {
    if (!itinerarySaved) {
      addToast("Save the itinerary first before enabling voting", "warning");
      return;
    }
    setSaving(true);
    try {
      const deadlineVal = deadline ? new Date(deadline).toISOString() : undefined;
      await itineraryApi.updateVotingSettings(tripId, enable, deadlineVal);
      // Refresh itinerary to get updated voting state
      const result = await itineraryApi.get(tripId);
      onUpdate(result.days);
      addToast(enable ? "Voting enabled for all days" : "Voting disabled", "success");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to update voting settings";
      addToast(msg, "error");
    } finally {
      setSaving(false);
    }
  }

  async function updateDeadline() {
    if (!deadline) return;
    if (!itinerarySaved) {
      addToast("Save the itinerary first before setting a deadline", "warning");
      return;
    }
    setSaving(true);
    try {
      const deadlineVal = new Date(deadline).toISOString();
      await itineraryApi.updateVotingSettings(tripId, true, deadlineVal);
      const result = await itineraryApi.get(tripId);
      onUpdate(result.days);
      addToast("Voting deadline updated", "success");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to update deadline";
      addToast(msg, "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      className="overflow-hidden"
    >
      <GlassCard className="!p-5 border-accent-200">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Vote size={16} className="text-accent-500" />
            <h3 className="text-sm font-bold text-foreground">Voting Settings</h3>
          </div>
          <button onClick={onClose} className="text-muted hover:text-foreground cursor-pointer">
            <X size={14} />
          </button>
        </div>

        <div className="space-y-4">
          {/* Unsaved warning */}
          {!itinerarySaved && (
            <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-3">
              <Save size={12} className="text-amber-500 mt-0.5 shrink-0" />
              <p>Save the itinerary first before enabling voting. Voting requires persisted day plans.</p>
            </div>
          )}

          {/* Toggle voting */}
          <div className="flex items-center justify-between rounded-xl bg-shore-50 border border-border/60 p-4">
            <div>
              <p className="text-sm font-medium text-foreground">Enable voting</p>
              <p className="text-xs text-muted mt-0.5">
                Allow participants to vote on each day&apos;s plan
              </p>
            </div>
            <button
              onClick={() => toggleVoting(!votingCurrentlyEnabled)}
              disabled={saving}
              className={cn(
                "relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer",
                votingCurrentlyEnabled ? "bg-accent-500" : "bg-shore-200",
                saving && "opacity-50"
              )}
            >
              <span
                className={cn(
                  "inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform",
                  votingCurrentlyEnabled ? "translate-x-6" : "translate-x-1"
                )}
              />
            </button>
          </div>

          {/* Deadline */}
          {votingCurrentlyEnabled && (
            <div className="rounded-xl bg-shore-50 border border-border/60 p-4 space-y-3">
              <div>
                <p className="text-sm font-medium text-foreground">Voting deadline</p>
                <p className="text-xs text-muted mt-0.5">
                  Voting freezes automatically after this time. Leave empty for no deadline.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="datetime-local"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  min={new Date().toISOString().slice(0, 16)}
                  className="flex-1 rounded-xl border border-border px-3 py-2 text-sm bg-white focus:border-accent-400 focus:outline-none focus:ring-1 focus:ring-accent-100"
                />
                <Button size="sm" onClick={updateDeadline} disabled={saving || !deadline}>
                  {saving ? <Loader2 size={12} className="animate-spin" /> : <Clock size={12} />}
                  Set
                </Button>
              </div>
              {currentDeadline && (
                <p className="text-[11px] text-muted">
                  Current deadline: {new Date(currentDeadline).toLocaleString("en-US", {
                    month: "short", day: "numeric", year: "numeric",
                    hour: "2-digit", minute: "2-digit"
                  })}
                </p>
              )}
            </div>
          )}

          {/* Info */}
          <div className="flex items-start gap-2 text-xs text-muted bg-blue-50 border border-blue-100 rounded-xl p-3">
            <Settings size={12} className="text-blue-500 mt-0.5 shrink-0" />
            <p>
              Voting auto-freezes when all participants have voted or the deadline is reached.
              Once frozen, no one can change their vote.
            </p>
          </div>
        </div>
      </GlassCard>
    </motion.div>
  );
}

/* ─── Invite Modal ────────────────────────────────────────────────── */
function InviteModal({
  tripId,
  existingParticipantIds,
  onClose,
  onInvited,
  currentUserName,
}: {
  tripId: string;
  existingParticipantIds: string[];
  onClose: () => void;
  onInvited: () => void;
  currentUserName: string;
}) {
  const { addToast } = useToast();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserPublicProfile[]>([]);
  const [searching, setSearching] = useState(false);
  const [inviting, setInviting] = useState<string | null>(null);
  const [invited, setInvited] = useState<Set<string>>(new Set());
  const [inviteMessage, setInviteMessage] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  function handleSearch(value: string) {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value.trim().length < 2) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const users = await usersApi.search(value.trim());
        // Filter out existing participants
        setResults(users.filter((u) => !existingParticipantIds.includes(u.id)));
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
  }

  async function handleInvite(userId: string, email?: string) {
    setInviting(userId);
    try {
      await participantsApi.invite(
        tripId,
        userId,
        email,
        inviteMessage.trim() || undefined,
        currentUserName || undefined,
      );
      setInvited((prev) => new Set([...prev, userId]));
      addToast("Invitation sent!", "success");
      onInvited();
    } catch {
      addToast("Failed to send invitation", "error");
    } finally {
      setInviting(null);
    }
  }

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        className="relative z-10 w-full max-w-md overflow-hidden rounded-3xl bg-surface border border-border shadow-2xl"
        initial={{ opacity: 0, scale: 0.9, y: 30 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 30 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <UserPlus size={18} className="text-accent-500" />
            <h2 className="text-base font-bold text-foreground">Invite People</h2>
          </div>
          <button onClick={onClose} className="text-muted hover:text-foreground cursor-pointer">
            <X size={18} />
          </button>
        </div>

        {/* Search input */}
        <div className="px-6 py-4 space-y-3">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type="text"
              value={query}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search by name or email..."
              autoFocus
              className="w-full rounded-xl border border-border bg-shore-50 pl-9 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted/60 focus:outline-none focus:border-accent-400 focus:ring-1 focus:ring-accent-100 transition-colors"
            />
            {searching && (
              <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-accent-500" />
            )}
          </div>
          <textarea
            value={inviteMessage}
            onChange={(e) => setInviteMessage(e.target.value)}
            placeholder="Add a message (optional)..."
            rows={2}
            maxLength={300}
            className="w-full rounded-xl border border-border bg-shore-50 px-4 py-2.5 text-sm text-foreground placeholder:text-muted/60 focus:outline-none focus:border-accent-400 focus:ring-1 focus:ring-accent-100 transition-colors resize-none"
          />
        </div>

        {/* Results */}
        <div className="px-6 pb-6 max-h-72 overflow-y-auto space-y-2">
          {results.length === 0 && query.trim().length >= 2 && !searching && (
            <p className="text-sm text-muted text-center py-4">No users found</p>
          )}
          {results.map((user) => {
            const isInvited = invited.has(user.id);
            const initials = (user.displayName ?? "U")
              .split(" ")
              .map((n) => n[0])
              .join("")
              .toUpperCase()
              .slice(0, 2);

            return (
              <div
                key={user.id}
                className="flex items-center gap-3 rounded-xl border border-border bg-white p-3 transition-all hover:border-accent-300"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-shore-100 text-xs font-bold text-trippy-600 border border-border">
                  {initials}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{user.displayName}</p>
                  {user.email && (
                    <p className="text-[11px] text-muted flex items-center gap-1 truncate">
                      <Mail size={10} /> {user.email}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => handleInvite(user.id, user.email)}
                  disabled={isInvited || inviting === user.id}
                  className={cn(
                    "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all cursor-pointer",
                    isInvited
                      ? "bg-green-100 text-green-700 border border-green-300"
                      : "bg-accent-500 text-white hover:bg-accent-600 shadow-sm",
                    (inviting === user.id) && "opacity-60"
                  )}
                >
                  {isInvited ? (
                    <><Check size={12} /> Invited</>
                  ) : inviting === user.id ? (
                    <><Loader2 size={12} className="animate-spin" /> Sending</>
                  ) : (
                    <><UserPlus size={12} /> Invite</>
                  )}
                </button>
              </div>
            );
          })}
          {query.trim().length < 2 && (
            <p className="text-xs text-muted text-center py-4">
              Type at least 2 characters to search for users
            </p>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ─── Edit Trip Modal ─────────────────────────────────────────────── */
const TRIP_TYPE_OPTIONS: { key: TripType; label: string; icon: typeof Sun }[] = [
  { key: "BEACH", label: "Beach", icon: TreePalm },
  { key: "MOUNTAIN", label: "Mountains", icon: Mountain },
  { key: "CITY", label: "City", icon: Building2 },
  { key: "NATURE", label: "Nature", icon: Trees },
  { key: "ADVENTURE", label: "Adventure", icon: Compass },
  { key: "CULTURE", label: "Culture", icon: Landmark },
];

const WEATHER_OPTIONS: { key: PreferredWeather; label: string; icon: typeof Sun }[] = [
  { key: "WARM", label: "Warm", icon: Sun },
  { key: "MILD", label: "Mild", icon: CloudSun },
  { key: "COLD", label: "Cold", icon: Snowflake },
  { key: "ANY", label: "Any", icon: Globe },
];

const BUDGET_OPTIONS: { key: BudgetTier; label: string; icon: typeof Sun }[] = [
  { key: "ECONOMY", label: "Economy", icon: Wallet },
  { key: "MODERATE", label: "Moderate", icon: Gem },
  { key: "LUXURY", label: "Luxury", icon: Crown },
];

function EditTripModal({
  trip,
  onClose,
  onSave,
}: {
  trip: TripDetail;
  onClose: () => void;
  onSave: (updates: { title?: string; description?: string; destination?: string; startDate?: string; endDate?: string; status?: string; visibility?: string }) => Promise<void>;
}) {
  const [title, setTitle] = useState(trip.title);
  const [description, setDescription] = useState(trip.description ?? "");
  const [destination, setDestination] = useState(trip.destination);
  const [startDate, setStartDate] = useState(trip.startDate ?? "");
  const [endDate, setEndDate] = useState(trip.endDate ?? "");
  const [status, setStatus] = useState(trip.status);
  const [visibility, setVisibility] = useState(trip.visibility);
  const [saving, setSaving] = useState(false);
  const [tripType, setTripType] = useState<TripType | null>(null);
  const [preferredWeather, setPreferredWeather] = useState<PreferredWeather | null>(null);
  const [budgetTier, setBudgetTier] = useState<BudgetTier | null>(null);
  const [preferenceNotes, setPreferenceNotes] = useState("");
  const [prefsExisted, setPrefsExisted] = useState(false);

  // Load any preferences the user set for this trip so they can edit them.
  useEffect(() => {
    let cancelled = false;
    preferencesApi
      .getForTrip(trip.tripId)
      .then((pref) => {
        if (cancelled) return;
        setTripType(pref.tripType ?? null);
        setPreferredWeather(pref.preferredWeather ?? null);
        setBudgetTier(pref.budgetTier ?? null);
        setPreferenceNotes(pref.notes ?? "");
        setPrefsExisted(true);
      })
      .catch(() => {
        /* 404 — no preferences saved for this trip yet */
      });
    return () => {
      cancelled = true;
    };
  }, [trip.tripId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    // Upsert preferences when the user has any set, or to clear preferences
    // that previously existed. Non-fatal: never block the trip update.
    const hasAnyPreference =
      Boolean(tripType) || Boolean(preferredWeather) || Boolean(budgetTier) || Boolean(preferenceNotes.trim());
    if (hasAnyPreference || prefsExisted) {
      try {
        await preferencesApi.save(trip.tripId, {
          tripType: tripType ?? undefined,
          preferredWeather: preferredWeather ?? undefined,
          budgetTier: budgetTier ?? undefined,
          notes: preferenceNotes.trim() || undefined,
        });
      } catch (err) {
        console.error("Failed to save trip preferences", err);
      }
    }

    await onSave({
      title: title.trim(),
      description: description.trim() || undefined,
      destination: destination.trim(),
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      status,
      visibility,
    });
    setSaving(false);
  }

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative z-10 w-full max-w-lg rounded-2xl bg-white border border-border shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/60">
          <h2 className="text-lg font-bold text-foreground">Edit Trip</h2>
          <button onClick={onClose} className="text-muted hover:text-foreground transition-colors cursor-pointer">
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Title */}
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1">Trip Name</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="w-full rounded-xl border border-border px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-accent-400 focus:ring-1 focus:ring-accent-100"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full rounded-xl border border-border px-3 py-2.5 text-sm text-foreground resize-none focus:outline-none focus:border-accent-400 focus:ring-1 focus:ring-accent-100"
              placeholder="Describe your trip..."
            />
          </div>

          {/* Destination */}
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1">Destination</label>
            <input
              type="text"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              required
              className="w-full rounded-xl border border-border px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-accent-400 focus:ring-1 focus:ring-accent-100"
            />
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full rounded-xl border border-border px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-accent-400 focus:ring-1 focus:ring-accent-100"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full rounded-xl border border-border px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-accent-400 focus:ring-1 focus:ring-accent-100"
              />
            </div>
          </div>

          {/* Status */}
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as typeof status)}
              className="w-full rounded-xl border border-border px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-accent-400 focus:ring-1 focus:ring-accent-100 cursor-pointer"
            >
              <option value="DRAFT">Draft</option>
              <option value="PLANNED">Planned</option>
              <option value="ONGOING">Active</option>
              <option value="COMPLETED">Completed</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>

          {/* Visibility */}
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1">Visibility</label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setVisibility("PUBLIC")}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition-all cursor-pointer",
                  visibility === "PUBLIC"
                    ? "border-accent-400 bg-accent-50 text-accent-700"
                    : "border-border text-muted hover:border-accent-300"
                )}
              >
                <Eye size={14} /> Public
              </button>
              <button
                type="button"
                onClick={() => setVisibility("PRIVATE")}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition-all cursor-pointer",
                  visibility === "PRIVATE"
                    ? "border-accent-400 bg-accent-50 text-accent-700"
                    : "border-border text-muted hover:border-accent-300"
                )}
              >
                <EyeOff size={14} /> Private
              </button>
            </div>
          </div>

          {/* Trip preferences */}
          <div className="space-y-3 rounded-xl border border-border bg-shore-50/50 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Sparkles size={14} className="text-accent-500" />
              <span className="text-xs font-bold text-foreground">
                Trip preferences
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-trippy-500/10 px-2 py-0.5 text-[10px] font-semibold text-trippy-600">
                Smarter AI itineraries
              </span>
            </div>
            <p className="text-[11px] leading-snug text-muted">
              Update the vibe so our AI can retune its suggestions. Everything
              here is optional.
            </p>

            {/* Trip type */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted">
                Trip type{" "}
                <span className="font-normal normal-case text-muted/60">
                  · optional
                </span>
              </label>
              <div className="grid grid-cols-3 gap-2">
                {TRIP_TYPE_OPTIONS.map((opt) => {
                  const OptIcon = opt.icon;
                  const active = tripType === opt.key;
                  return (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => setTripType(active ? null : opt.key)}
                      className={cn(
                        "flex flex-col items-center gap-1 rounded-lg border p-2.5 text-center transition-all cursor-pointer",
                        active
                          ? "border-accent-400 bg-accent-50 text-accent-700"
                          : "border-border text-muted hover:border-accent-300"
                      )}
                    >
                      <OptIcon size={15} />
                      <span className="text-[11px] font-semibold">
                        {opt.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Preferred weather */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted">
                Preferred weather{" "}
                <span className="font-normal normal-case text-muted/60">
                  · optional
                </span>
              </label>
              <div className="grid grid-cols-4 gap-2">
                {WEATHER_OPTIONS.map((opt) => {
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
                        "flex flex-col items-center gap-1 rounded-lg border p-2 text-center transition-all cursor-pointer",
                        active
                          ? "border-accent-400 bg-accent-50 text-accent-700"
                          : "border-border text-muted hover:border-accent-300"
                      )}
                    >
                      <OptIcon size={14} />
                      <span className="text-[10px] font-semibold">
                        {opt.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Budget tier */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted">
                Budget tier{" "}
                <span className="font-normal normal-case text-muted/60">
                  · optional
                </span>
              </label>
              <div className="grid grid-cols-3 gap-2">
                {BUDGET_OPTIONS.map((opt) => {
                  const OptIcon = opt.icon;
                  const active = budgetTier === opt.key;
                  return (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => setBudgetTier(active ? null : opt.key)}
                      className={cn(
                        "flex flex-col items-center gap-1 rounded-lg border p-2.5 text-center transition-all cursor-pointer",
                        active
                          ? "border-accent-400 bg-accent-50 text-accent-700"
                          : "border-border text-muted hover:border-accent-300"
                      )}
                    >
                      <OptIcon size={15} />
                      <span className="text-[11px] font-semibold">
                        {opt.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted">
                What are you expecting?{" "}
                <span className="font-normal normal-case text-muted/60">
                  · optional
                </span>
              </label>
              <textarea
                value={preferenceNotes}
                onChange={(e) => setPreferenceNotes(e.target.value)}
                rows={3}
                maxLength={500}
                placeholder="e.g. relaxed beach mornings, great local food, a mix of culture and nightlife..."
                className="w-full resize-none rounded-xl border border-border bg-white px-3 py-2.5 text-sm text-foreground placeholder:text-muted/50 focus:outline-none focus:border-accent-400 focus:ring-1 focus:ring-accent-100"
              />
            </div>
          </div>

          {/* Submit */}
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" disabled={saving || !title.trim() || !destination.trim()}>
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Save Changes
            </Button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}

/* ─── Main Page Component ─────────────────────────────────────────── */
export default function TripDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { addToast } = useToast();
  const { user } = useAuth();
  const tripId = tripIdFromSlug(params.id as string);

  const [trip, setTrip] = useState<TripDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedDays, setExpandedDays] = useState<Set<number>>(new Set([1]));
  const [itineraryDays, setItineraryDays] = useState<DayPlan[]>([]);
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const [aiMinimized, setAiMinimized] = useState(false);
  const [aiSession, setAiSession] = useState(0);
  const [panelWidth, setPanelWidth] = useState(AI_DEFAULT_W);
  const { setReserve, setDragging } = useRightRail();

  // Release the reserved rail space when leaving the trip page.
  useEffect(() => () => setReserve(0), [setReserve]);

  function openAI() {
    setAiPanelOpen(true);
    setAiMinimized(false);
    setAiSession((n) => n + 1);
    setReserve(panelWidth + AI_RAIL_GAP);
  }
  function closeAI() {
    setAiPanelOpen(false);
    setAiMinimized(false);
    setReserve(0);
  }
  function minimizeAI() {
    setAiMinimized(true);
    setReserve(AI_MIN_RESERVE);
  }
  function expandAI() {
    setAiMinimized(false);
    setReserve(panelWidth + AI_RAIL_GAP);
  }
  function resizeAI(w: number) {
    const clamped = Math.min(AI_MAX_W, Math.max(AI_MIN_W, w));
    setPanelWidth(clamped);
    setReserve(clamped + AI_RAIL_GAP);
  }
  // Add an AI suggestion into the working itinerary (persisted on Save).
  function applySuggestion(dayNumber: number, s: AISuggestion) {
    setItineraryDays((prev) => {
      const activity: Activity = {
        activityId: `ai-rec-${dayNumber}-${Date.now()}`,
        time: s.startTime || undefined,
        title: s.title,
        description: s.notes || undefined,
        estimatedCost: s.cost ? String(Math.round(s.cost)) : undefined,
        category: "sightseeing",
      };
      const exists = prev.some((d) => d.dayNumber === dayNumber);
      if (exists) {
        return prev.map((d) =>
          d.dayNumber === dayNumber
            ? { ...d, title: d.title?.trim() ? d.title : s.title, activities: [...d.activities, activity] }
            : d,
        );
      }
      return [
        ...prev,
        { dayPlanId: `day-${dayNumber}-${Date.now()}`, dayNumber, title: s.title, activities: [activity] },
      ].sort((a, b) => a.dayNumber - b.dayNumber);
    });
    setExpandedDays((prev) => new Set(prev).add(dayNumber));
    setHasUnsavedChanges(true);
  }
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [currency, setCurrency] = useState("USD");
  const [saving, setSaving] = useState(false);
  const [votingSettingsOpen, setVotingSettingsOpen] = useState(false);
  const [isOwnerOrEditor, setIsOwnerOrEditor] = useState(false);
  const [isParticipant, setIsParticipant] = useState(false);
  const [isPendingApproval, setIsPendingApproval] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [processingRequestUserId, setProcessingRequestUserId] = useState<string | null>(null);

  const applyParticipantFlags = useCallback(
    (data: TripDetail) => {
      if (user?.userId && data.participants) {
        const me = data.participants.find((p) => p.userId === user.userId);
        setIsOwnerOrEditor(me?.role === "OWNER" || me?.role === "EDITOR");
        setIsParticipant(!!me && (me.status === "ACCEPTED" || me.role === "OWNER"));
        setIsPendingApproval(!!me && me.status === "PENDING_APPROVAL");
      } else {
        setIsParticipant(false);
        setIsPendingApproval(false);
      }
    },
    [user?.userId]
  );

  const enrichParticipants = useCallback(async (data: TripDetail) => {
    if (data.participants && data.participants.length > 0) {
      try {
        const userIds = data.participants.map((p) => p.userId);
        const profiles = await usersApi.batchProfiles(userIds);
        const profileMap: Record<string, typeof profiles[number]> = {};
        for (const p of profiles) profileMap[p.id] = p;
        data.participants = data.participants.map((p) => {
          const profile = profileMap[p.userId];
          return {
            ...p,
            displayName: profile?.displayName ?? p.displayName,
            avatarUrl: profile?.avatarUrl ?? p.avatarUrl,
          };
        });
      } catch {
        // Silently fall back to missing names
      }
    }
    return data;
  }, []);

  const refreshTrip = useCallback(async () => {
    if (!tripId) return;
    const data = await tripsApi.get(tripId);
    await enrichParticipants(data);
    setTrip(data);
    applyParticipantFlags(data);
  }, [tripId, enrichParticipants, applyParticipantFlags]);

  // Generate a cover image in the background for trips that don't have one yet.
  useEffect(() => {
    if (!trip || trip.coverImageUrl || !isOwnerOrEditor) return;
    let cancelled = false;
    (async () => {
      try {
        const url = await ensureTripCoverImage(trip.tripId, trip.destination);
        if (cancelled || !url) return;
        setTrip((prev) => (prev ? { ...prev, coverImageUrl: url } : prev));
      } catch {
        // Keep the gradient hero on failure.
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trip?.tripId, trip?.coverImageUrl, trip?.destination, isOwnerOrEditor]);

  async function handleApproveRequest(requesterUserId: string) {
    if (!tripId) return;
    setProcessingRequestUserId(requesterUserId);
    try {
      await participantsApi.approve(tripId, requesterUserId);
      addToast("Join request approved.", "success");
      await refreshTrip();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to approve request";
      addToast(msg, "error");
    } finally {
      setProcessingRequestUserId(null);
    }
  }

  async function handleRejectRequest(requesterUserId: string) {
    if (!tripId) return;
    setProcessingRequestUserId(requesterUserId);
    try {
      await participantsApi.reject(tripId, requesterUserId);
      addToast("Join request declined.", "success");
      await refreshTrip();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to decline request";
      addToast(msg, "error");
    } finally {
      setProcessingRequestUserId(null);
    }
  }

  async function handleRevokeInvite(invitedUserId: string) {
    if (!tripId) return;
    setProcessingRequestUserId(invitedUserId);
    try {
      await participantsApi.reject(tripId, invitedUserId);
      addToast("Invitation revoked.", "success");
      await refreshTrip();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to revoke invitation";
      addToast(msg, "error");
    } finally {
      setProcessingRequestUserId(null);
    }
  }

  async function handleKickMember(targetUserId: string) {
    if (!tripId) return;
    try {
      await participantsApi.kick(tripId, targetUserId);
      addToast("Member removed from trip.", "success");
      await refreshTrip();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to remove member";
      addToast(msg, "error");
    }
  }

  useEffect(() => {
    if (!tripId) return;
    setLoading(true);
    tripsApi
      .get(tripId)
      .then(async (data) => {
        // Fetch participant display names from user-service
        await enrichParticipants(data);
        setTrip(data);

        // Check if current user is owner/editor
        applyParticipantFlags(data);

        // Fetch itinerary from backend
        try {
          const itinerary = await itineraryApi.get(tripId);
          if (itinerary.days.length > 0) {
            setItineraryDays(itinerary.days);
          } else {
            // Initialize empty days based on trip dates
            const numDays = getNumDays(data.startDate, data.endDate);
            if (numDays > 0) {
              setItineraryDays(
                Array.from({ length: numDays }, (_, i) => ({
                  dayPlanId: `day-${i + 1}`,
                  dayNumber: i + 1,
                  title: "",
                  activities: [],
                }))
              );
            }
          }
        } catch {
          // Itinerary not yet created - initialize empty days
          const numDays = getNumDays(data.startDate, data.endDate);
          if (numDays > 0) {
            setItineraryDays(
              Array.from({ length: numDays }, (_, i) => ({
                dayPlanId: `day-${i + 1}`,
                dayNumber: i + 1,
                title: "",
                activities: [],
              }))
            );
          }
        }
      })
      .catch(() => setError("Failed to load trip details"))
      .finally(() => setLoading(false));
  }, [tripId, user?.userId, enrichParticipants, applyParticipantFlags]);

  function getNumDays(startDate?: string, endDate?: string): number {
    if (!startDate || !endDate) return 0;
    const diff = new Date(endDate).getTime() - new Date(startDate).getTime();
    return Math.max(1, Math.ceil(diff / 86400000) + 1);
  }

  const numDays = getNumDays(trip?.startDate, trip?.endDate);

  const members = (trip?.participants ?? []).filter(
    (p) => p.status === "ACCEPTED" || p.role === "OWNER"
  );
  const pendingRequests = (trip?.participants ?? []).filter(
    (p) => p.status === "PENDING_APPROVAL"
  );
  const pendingInvites = (trip?.participants ?? []).filter(
    (p) => p.status === "INVITED"
  );

  function toggleDay(dayNumber: number) {
    setExpandedDays((prev) => {
      const next = new Set(prev);
      if (next.has(dayNumber)) next.delete(dayNumber);
      else next.add(dayNumber);
      return next;
    });
  }

  function updateDay(updated: DayPlan) {
    setItineraryDays((prev) => prev.map((d) => (d.dayNumber === updated.dayNumber ? updated : d)));
    setHasUnsavedChanges(true);
  }

  function addDay() {
    const nextNum = itineraryDays.length + 1;
    setItineraryDays((prev) => [
      ...prev,
      { dayPlanId: `day-${nextNum}-${Date.now()}`, dayNumber: nextNum, title: "", activities: [] },
    ]);
    setExpandedDays((prev) => new Set([...prev, nextNum]));
    setHasUnsavedChanges(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const payload = {
        dayPlans: itineraryDays.map((day) => ({
          dayNumber: day.dayNumber,
          date: day.date ?? undefined,
          title: day.title || undefined,
          activities: day.activities.map((a) => {
            // Parse time "09:00 - 11:00" into startTime/endTime
            const timeParts = (a.time ?? "").split("-").map((s) => s.trim());
            const startTime = timeParts[0] || a.startTime || undefined;
            const endTime = timeParts[1] || a.endTime || undefined;
            // Map frontend "default" category to backend "OTHER"
            const rawCat = (a.category ?? "OTHER").toUpperCase();
            const category = rawCat === "DEFAULT" ? "OTHER" : rawCat;
            return {
              title: a.title || "Untitled activity",
              description: a.description || undefined,
              location: a.location || undefined,
              startTime,
              endTime,
              category,
              notes: undefined,
            };
          }),
        })),
      };
      const result = await itineraryApi.update(tripId, payload);
      setItineraryDays(result.days);
      setHasUnsavedChanges(false);
      addToast("Itinerary saved successfully", "success");
    } catch {
      addToast("Failed to save itinerary", "error");
    } finally {
      setSaving(false);
    }
  }

  function handleVoteUpdate(dayNumber: number, summary: VoteSummary) {
    setItineraryDays((prev) =>
      prev.map((d) =>
        d.dayNumber === dayNumber
          ? {
              ...d,
              upvotes: summary.upvotes,
              downvotes: summary.downvotes,
              currentUserVote: summary.currentUserVote,
              votingFrozen: summary.votingFrozen,
            }
          : d
      )
    );
  }

  async function handleDelete() {
    if (!confirm("Are you sure you want to delete this trip?")) return;
    try {
      await tripsApi.delete(tripId);
      addToast("Trip deleted", "success");
      router.push("/dashboard");
    } catch {
      addToast("Failed to delete trip", "error");
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={32} className="animate-spin text-accent-500" />
          <p className="text-sm text-muted">Loading trip details...</p>
        </div>
      </div>
    );
  }

  if (error || !trip) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
        <p className="text-muted">{error || "Trip not found"}</p>
        <Button variant="secondary" onClick={() => router.push("/dashboard")}>
          <ArrowLeft size={16} /> Back to trips
        </Button>
      </div>
    );
  }

  const totalEstimatedCost = itineraryDays.reduce(
    (sum, day) =>
      sum +
      day.activities.reduce((s, a) => {
        const c = parseFloat(a.estimatedCost ?? "0");
        return s + (isNaN(c) ? 0 : c);
      }, 0),
    0
  );

  return (
    <div className="space-y-8 pb-12">
      {/* Back link */}
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-2 text-sm text-muted hover:text-foreground transition-colors"
      >
        <ArrowLeft size={16} /> Back to trips
      </Link>

      {/* Pending approval banner */}
      {isPendingApproval && (
        <div className="rounded-xl border border-amber-300/50 bg-amber-50 dark:bg-amber-900/20 px-5 py-3 flex items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-800/40">
            <Clock size={16} className="text-amber-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">Request Pending</p>
            <p className="text-xs text-amber-700 dark:text-amber-300">Your request to join this trip is awaiting approval from the trip owner.</p>
          </div>
        </div>
      )}

      {/* ─── Hero Header ──────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-trippy-600 via-trippy-700 to-trippy-800 p-8 shadow-[0_40px_90px_-42px_rgba(8,31,54,0.9)] sm:p-10"
      >
        {/* AI-generated cover as a softly blurred backdrop (fades in when loaded) */}
        {trip.coverImageUrl && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={trip.coverImageUrl}
              alt=""
              aria-hidden
              className="pointer-events-none absolute inset-0 h-full w-full scale-105 object-cover opacity-0 blur-[3px] transition-opacity duration-1000"
              onLoad={(e) => { e.currentTarget.style.opacity = "0.7"; }}
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-trippy-900/78 via-trippy-800/68 to-trippy-900/85" />
          </>
        )}

        {/* Immersive texture + warm mesh */}
        <div className="pointer-events-none absolute inset-0 bg-[url('/trippy-landing-background.png')] bg-cover bg-center opacity-[0.14] mix-blend-luminosity" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_120%_at_0%_0%,rgba(231,111,81,0.30),transparent_55%)]" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/45 to-transparent" />
        <div className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-accent-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-8 -left-8 h-32 w-32 rounded-full bg-white/8 blur-2xl" />
        <div className="pointer-events-none absolute right-8 bottom-4 opacity-10 lux-float">
          <Plane size={90} className="rotate-12 text-white" />
        </div>

        <div className="relative z-10 flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2">
              <Badge variant={statusVariant[trip.status] ?? "default"}>
                {statusLabel[trip.status] ?? trip.status}
              </Badge>
              {trip.visibility === "PUBLIC" && (
                <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-0.5 text-[10px] font-medium text-white/70">
                  <Globe size={10} /> Public
                </span>
              )}
            </div>
            <h1 className="font-display text-4xl font-black tracking-tight text-white sm:text-5xl">{trip.title}</h1>
            {trip.description && (
              <p className="mt-2 text-sm text-white/60 max-w-xl">{trip.description}</p>
            )}

            {/* Quick stats */}
            <div className="flex flex-wrap items-center gap-4 mt-5">
              <div className="flex items-center gap-2 text-white/80">
                <MapPin size={14} className="text-accent-400" />
                <span className="text-sm font-medium">{trip.destination}</span>
              </div>
              {trip.startDate && trip.endDate && (
                <div className="flex items-center gap-2 text-white/80">
                  <Calendar size={14} className="text-accent-400" />
                  <span className="text-sm">
                    {new Date(trip.startDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    {" — "}
                    {new Date(trip.endDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </span>
                  <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-medium text-white/60">
                    {numDays} day{numDays !== 1 ? "s" : ""}
                  </span>
                </div>
              )}
              <div className="flex items-center gap-2 text-white/80">
                <Users size={14} className="text-accent-400" />
                <span className="text-sm">{trip.participantCount} member{trip.participantCount !== 1 ? "s" : ""}</span>
              </div>
              {totalEstimatedCost > 0 && (
                <div className="flex items-center gap-2 text-white/80">
                  <DollarSign size={14} className="text-accent-400" />
                  <span className="text-sm font-medium">~{currencies.find((c) => c.code === currency)?.symbol ?? "$"}{totalEstimatedCost.toFixed(0)} est.</span>
                </div>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2">
            <Link href={`/dashboard/chat/${trip.tripId}`}>
              <Button variant="secondary" size="sm" className="bg-white/10 border-white/20 text-white hover:bg-white/20">
                <MessageSquare size={14} /> Chat
              </Button>
            </Link>
            {isOwnerOrEditor && (
              <>
                <Button variant="secondary" size="sm" className="bg-white/10 border-white/20 text-white hover:bg-white/20" onClick={() => setEditModalOpen(true)}>
                  <Edit size={14} /> Edit
                </Button>
                <Button variant="danger" size="sm" onClick={handleDelete} className="bg-red-500/80 border-red-400/30 hover:bg-red-500">
                  <Trash2 size={14} /> Delete
                </Button>
              </>
            )}
          </div>
        </div>
      </motion.div>

      {/* ─── Team Section ──────────────────────────────────────────── */}
      {members.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <GlassCard className="!p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Users size={15} className="text-accent-500" />
                <h3 className="text-sm font-bold text-foreground">Team</h3>
                <span className="text-[10px] text-muted bg-shore-100 px-2 py-0.5 rounded-full">
                  {members.length} member{members.length !== 1 ? "s" : ""}
                </span>
              </div>
              {isParticipant && (
                <Button variant="secondary" size="sm" className="text-xs" onClick={() => setInviteOpen(true)}>
                  <Plus size={12} /> Invite
                </Button>
              )}
            </div>
            <div className="flex flex-wrap gap-3">
              {members.map((p) => {
                const name = p.displayName ?? "User";
                const initials = name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .toUpperCase()
                  .slice(0, 2);
                const isOwner = p.role === "OWNER";
                // Dummy stats for hover card display
                const tripsCount = Math.floor(Math.random() * 12) + 1;
                const friendliness = Math.floor(Math.random() * 3) + 3;

                return (
                  <div key={p.participantId} className="group/member relative">
                    {/* Avatar + name chip */}
                    <div className="flex items-center gap-2 rounded-xl border border-border bg-white px-3 py-2 transition-all hover:border-accent-300 hover:shadow-sm cursor-default">
                      <div className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold border-2",
                        isOwner
                          ? "bg-gradient-to-br from-accent-100 to-accent-200 text-accent-700 border-accent-300"
                          : "bg-shore-100 text-trippy-600 border-border"
                      )}>
                        {p.avatarUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={p.avatarUrl} alt={name} className="w-full h-full rounded-full object-cover" />
                        ) : (
                          initials
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1">
                          <span className="text-xs font-semibold text-foreground truncate max-w-[100px]">{name}</span>
                          {isOwner && <Crown size={10} className="text-accent-500 shrink-0" />}
                        </div>
                        <span className="text-[10px] text-muted capitalize">{p.role.toLowerCase()}</span>
                      </div>
                    </div>

                    {/* Hover profile card */}
                    <div className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-full mb-2 z-30 w-56 rounded-2xl border border-border bg-white p-4 shadow-2xl opacity-0 scale-95 transition-all duration-200 group-hover/member:opacity-100 group-hover/member:scale-100 group-hover/member:pointer-events-auto">
                      <div className="flex items-center gap-3 mb-3">
                        <div className={cn(
                          "flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold",
                          isOwner
                            ? "bg-gradient-to-br from-accent-200 to-accent-300 text-accent-800"
                            : "bg-shore-100 text-trippy-600"
                        )}>
                          {initials}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-foreground">{name}</p>
                          <p className="text-[10px] text-muted capitalize flex items-center gap-1">
                            {isOwner && <Crown size={9} className="text-accent-500" />}
                            {p.role.toLowerCase()}
                            {p.status === "ACCEPTED" && " · Active"}
                            {p.status === "PENDING" && " · Pending"}
                          </p>
                        </div>
                      </div>
                      <div className="space-y-2 border-t border-border/60 pt-3">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-muted flex items-center gap-1.5">
                            <Map size={10} /> Trips together
                          </span>
                          <span className="text-[10px] font-bold text-foreground">{tripsCount}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-muted flex items-center gap-1.5">
                            <Heart size={10} /> Friendliness
                          </span>
                          <div className="flex gap-0.5">
                            {Array.from({ length: 5 }, (_, i) => (
                              <div
                                key={i}
                                className={cn(
                                  "h-1.5 w-1.5 rounded-full",
                                  i < friendliness ? "bg-accent-500" : "bg-shore-200"
                                )}
                              />
                            ))}
                          </div>
                        </div>
                        {p.joinedAt && (
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-muted flex items-center gap-1.5">
                              <Calendar size={10} /> Joined
                            </span>
                            <span className="text-[10px] font-medium text-foreground">
                              {new Date(p.joinedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                            </span>
                          </div>
                        )}
                        {isOwnerOrEditor && !isOwner && (
                          <button
                            onClick={() => handleKickMember(p.userId)}
                            className="mt-2 w-full rounded-lg border border-red-200 bg-red-50 px-2 py-1.5 text-[11px] font-semibold text-red-600 hover:bg-red-100 hover:border-red-300 transition-colors"
                          >
                            Remove from trip
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </GlassCard>
        </motion.div>
      )}

      {/* ─── Join Requests Section (owner/editor only) ─────────────── */}
      {isOwnerOrEditor && pendingRequests.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 }}
        >
          <GlassCard className="!p-5">
            <div className="flex items-center gap-2 mb-4">
              <Users size={15} className="text-amber-500" />
              <h3 className="text-sm font-bold text-foreground">Join Requests</h3>
              <span className="text-[10px] text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                {pendingRequests.length} pending
              </span>
            </div>
            <div className="flex flex-col gap-3">
              {pendingRequests.map((p) => {
                const name = p.displayName ?? "User";
                const initials = name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .toUpperCase()
                  .slice(0, 2);
                const processing = processingRequestUserId === p.userId;
                return (
                  <div
                    key={p.participantId}
                    className="flex items-center justify-between gap-3 rounded-xl border border-border bg-white px-3 py-2"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold border-2 bg-shore-100 text-trippy-600 border-border">
                        {p.avatarUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={p.avatarUrl} alt={name} className="w-full h-full rounded-full object-cover" />
                        ) : (
                          initials
                        )}
                      </div>
                      <div className="min-w-0">
                        <span className="block text-xs font-semibold text-foreground truncate max-w-[160px]">{name}</span>
                        <span className="text-[10px] text-muted">Wants to join this trip</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        variant="primary"
                        size="sm"
                        className="text-xs"
                        disabled={processing}
                        onClick={() => handleApproveRequest(p.userId)}
                      >
                        Approve
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        className="text-xs"
                        disabled={processing}
                        onClick={() => handleRejectRequest(p.userId)}
                      >
                        Decline
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </GlassCard>
        </motion.div>
      )}

      {/* ─── Pending Invites Section (owner/editor only) ───────────── */}
      {isOwnerOrEditor && pendingInvites.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.13 }}
        >
          <GlassCard className="!p-5">
            <div className="flex items-center gap-2 mb-4">
              <Users size={15} className="text-blue-500" />
              <h3 className="text-sm font-bold text-foreground">Pending Invites</h3>
              <span className="text-[10px] text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">
                {pendingInvites.length} invited
              </span>
            </div>
            <div className="flex flex-col gap-3">
              {pendingInvites.map((p) => {
                const name = p.displayName ?? "User";
                const initials = name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .toUpperCase()
                  .slice(0, 2);
                const processing = processingRequestUserId === p.userId;
                return (
                  <div
                    key={p.participantId}
                    className="flex items-center justify-between gap-3 rounded-xl border border-border bg-white px-3 py-2"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold border-2 bg-blue-50 text-blue-600 border-blue-200">
                        {p.avatarUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={p.avatarUrl} alt={name} className="w-full h-full rounded-full object-cover" />
                        ) : (
                          initials
                        )}
                      </div>
                      <div className="min-w-0">
                        <span className="block text-xs font-semibold text-foreground truncate max-w-[160px]">{name}</span>
                        <span className="text-[10px] text-muted">Invitation sent — awaiting response</span>
                      </div>
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="text-xs shrink-0"
                      disabled={processing}
                      onClick={() => handleRevokeInvite(p.userId)}
                    >
                      Revoke
                    </Button>
                  </div>
                );
              })}
            </div>
          </GlassCard>
        </motion.div>
      )}

      {/* ─── Itinerary Builder Section ────────────────────────────── */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="space-y-5"
      >
        {/* Section header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-accent-400 to-accent-600 text-white shadow-[0_16px_32px_-16px_rgba(231,111,81,0.9)]">
              <Map size={20} />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-display text-2xl font-black tracking-tight">Itinerary</h2>
                {totalEstimatedCost > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-accent-500/12 px-2.5 py-0.5 text-[11px] font-bold text-accent-700">
                    <DollarSign size={11} /> ~{currencies.find((c) => c.code === currency)?.symbol ?? "$"}
                    {totalEstimatedCost.toFixed(0)}
                  </span>
                )}
              </div>
              <p className="text-xs text-muted">
                {itineraryDays.length > 0
                  ? `${itineraryDays.length} day${itineraryDays.length !== 1 ? "s" : ""} of adventure planned`
                  : "Plan your day-by-day adventure"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isParticipant && hasUnsavedChanges && (
              <Button size="sm" onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                {saving ? "Saving..." : "Save"}
              </Button>
            )}
            {isOwnerOrEditor && (
              <button
                onClick={() => setVotingSettingsOpen(!votingSettingsOpen)}
                className={cn(
                  "flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium transition-all cursor-pointer border",
                  votingSettingsOpen
                    ? "bg-accent-50 border-accent-300 text-accent-700"
                    : "bg-white border-border text-muted hover:border-accent-300 hover:text-accent-600"
                )}
                title="Voting settings"
              >
                <Vote size={14} />
                Voting
              </button>
            )}
            {isParticipant && (
              <button
                onClick={openAI}
                className={cn(
                  "flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all cursor-pointer",
                  "bg-gradient-to-r from-trippy-600 to-trippy-700 text-white shadow-md shadow-trippy-500/20",
                  "hover:shadow-lg hover:-translate-y-0.5"
                )}
              >
                <Sparkles size={14} />
                AI Suggestions
              </button>
            )}
          </div>
        </div>

        {/* Voting Settings Panel */}
        <AnimatePresence>
          {votingSettingsOpen && isOwnerOrEditor && (
            <VotingSettingsPanel
              tripId={tripId}
              itineraryDays={itineraryDays}
              onUpdate={(days) => setItineraryDays(days)}
              onClose={() => setVotingSettingsOpen(false)}
            />
          )}
        </AnimatePresence>

        {/* Days list */}
        {itineraryDays.length > 0 ? (
          <div className="space-y-4">
            {itineraryDays.map((day) => (
              <DayCard
                key={day.dayPlanId}
                day={day}
                tripId={tripId}
                tripStartDate={trip.startDate}
                expanded={expandedDays.has(day.dayNumber)}
                onToggle={() => toggleDay(day.dayNumber)}
                onUpdateDay={updateDay}
                currency={currency}
                onCurrencyChange={(c) => { setCurrency(c); setHasUnsavedChanges(true); }}
                onVoteUpdate={handleVoteUpdate}
                isParticipant={isParticipant}
              />
            ))}

            {/* Add day button */}
            {isParticipant && (
              <button
                onClick={addDay}
                className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border py-5 text-sm font-medium text-muted transition-all hover:border-accent-400 hover:text-accent-600 hover:bg-accent-50/30 cursor-pointer"
              >
                <Plus size={16} /> Add another day
              </button>
            )}
          </div>
        ) : (
          /* Empty itinerary state */
          <GlassCard className="!py-12 flex flex-col items-center text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-accent-100 to-shore-100 mb-4">
              <Calendar size={28} className="text-accent-500" />
            </div>
            <h3 className="text-lg font-bold">No itinerary yet</h3>
            <p className="text-sm text-muted mt-1 max-w-sm">
              {numDays > 0
                ? `You have ${numDays} days to plan. Add days manually or let AI create a complete itinerary for you.`
                : "Set your trip dates first, then plan your day-by-day adventure here."}
            </p>
            <div className="flex items-center gap-3 mt-5">
              {numDays > 0 && (
                <Button variant="secondary" size="sm" onClick={addDay}>
                  <Plus size={14} /> Add first day
                </Button>
              )}
              <button
                onClick={openAI}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-trippy-600 to-trippy-700 px-4 py-2.5 text-sm font-semibold text-white shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all cursor-pointer"
              >
                <Sparkles size={14} /> Suggest with AI
              </button>
            </div>
          </GlassCard>
        )}
      </motion.section>

      {/* AI Itinerary Studio */}
      <AIItinerarySidebar
        key={aiSession}
        open={aiPanelOpen}
        minimized={aiMinimized}
        width={panelWidth}
        onClose={closeAI}
        onMinimize={minimizeAI}
        onExpand={expandAI}
        onResize={resizeAI}
        onDragChange={setDragging}
        tripId={tripId}
        destination={trip.destination}
        numDays={numDays > 0 ? numDays : 5}
        currencySymbol={currencies.find((c) => c.code === currency)?.symbol ?? "$"}
        existingItinerary={itineraryDays}
        onApply={applySuggestion}
      />

      {/* Edit Trip Modal */}
      <AnimatePresence>
        {editModalOpen && (
          <EditTripModal
            trip={trip}
            onClose={() => setEditModalOpen(false)}
            onSave={async ({ status, ...updates }) => {
              try {
                await tripsApi.update(tripId, updates);
                // Route status changes through the dedicated lifecycle endpoint.
                if (status && status !== trip.status) {
                  await tripsApi.updateStatus(tripId, status as TripDetail["status"]);
                }
                const refreshed = await tripsApi.get(tripId);
                setTrip(refreshed);
                setEditModalOpen(false);
                addToast("Trip updated!", "success");
              } catch {
                addToast("Failed to update trip", "error");
              }
            }}
          />
        )}
      </AnimatePresence>

      {/* Invite Modal */}
      <AnimatePresence>
        {inviteOpen && (
          <InviteModal
            tripId={tripId}
            existingParticipantIds={trip.participants?.map((p) => p.userId) ?? []}
            onClose={() => setInviteOpen(false)}
            onInvited={() => {
              // Refresh trip data to show new participant
              tripsApi.get(tripId).then((data) => setTrip(data)).catch(() => {});
            }}
            currentUserName={user?.displayName ?? ""}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
