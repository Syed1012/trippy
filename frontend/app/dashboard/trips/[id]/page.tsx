"use client";

import { useEffect, useState, useRef, useCallback } from "react";
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
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { GlassCard, Button, Badge, Avatar } from "@/components/ui";
import { tripsApi, itineraryApi, commentsApi, usersApi, participantsApi, preferencesApi, type TripDetail, type DayPlan, type Activity, type VoteSummary, type ActivityVoteSummary, type ActivityComment as ActivityCommentType, type UserPublicProfile, type TripType, type PreferredWeather } from "@/lib/api";
import { useToast } from "@/lib/toast";
import { cn, tripIdFromSlug } from "@/lib/utils";

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
        "rounded-2xl border-2 transition-all duration-300",
        expanded
          ? "border-accent-400/50 shadow-lg shadow-accent-500/5 bg-white"
          : "border-border bg-surface hover:border-accent-300 hover:shadow-sm"
      )}
    >
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
              "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl font-bold text-lg transition-colors",
              expanded
                ? "bg-gradient-to-br from-accent-400 to-accent-600 text-white shadow-md shadow-accent-500/20"
                : "bg-shore-100 text-muted"
            )}
          >
            {day.dayNumber}
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

/* ─── AI Generation Modal (dummy) ────────────────────────────────── */
function AIGeneratePanel({
  open,
  onClose,
  tripTitle,
  destination,
  numDays,
  onGenerate,
}: {
  open: boolean;
  onClose: () => void;
  tripTitle: string;
  destination: string;
  numDays: number;
  onGenerate: (days: DayPlan[]) => void;
}) {
  const [generating, setGenerating] = useState(false);
  const [style, setStyle] = useState<"adventure" | "relaxed" | "cultural" | "foodie">("adventure");

  async function handleGenerate() {
    setGenerating(true);
    // Simulate AI generation delay
    await new Promise((r) => setTimeout(r, 2500));

    // Generate dummy itinerary
    const dummyDays: DayPlan[] = Array.from({ length: numDays }, (_, i) => ({
      dayPlanId: `ai-day-${i + 1}-${Date.now()}`,
      dayNumber: i + 1,
      title: getDummyDayTitle(i, destination, style),
      activities: getDummyActivities(i, destination, style),
    }));

    setGenerating(false);
    onGenerate(dummyDays);
    onClose();
  }

  const styles = [
    { key: "adventure" as const, label: "Adventure", emoji: "🏔️" },
    { key: "relaxed" as const, label: "Relaxed", emoji: "🏖️" },
    { key: "cultural" as const, label: "Cultural", emoji: "🏛️" },
    { key: "foodie" as const, label: "Foodie", emoji: "🍽️" },
  ];

  return (
    <AnimatePresence>
      {open && (
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
            transition={{ type: "spring", stiffness: 300, damping: 28 }}
          >
            {/* Header */}
            <div className="relative overflow-hidden bg-gradient-to-br from-trippy-600 via-trippy-700 to-trippy-800 px-6 py-5">
              <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-accent-500/10 blur-2xl" />
              <div className="pointer-events-none absolute -left-4 bottom-0 h-20 w-20 rounded-full bg-white/5" />
              <button
                onClick={onClose}
                className="absolute right-4 top-4 flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-white/70 hover:bg-white/20 hover:text-white cursor-pointer"
              >
                <X size={14} />
              </button>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm">
                  <Wand2 size={18} className="text-white" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">AI Itinerary Builder</h3>
                  <p className="text-xs text-white/60">Generate a full plan with one click</p>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 space-y-5">
              <div className="rounded-xl bg-shore-50 border border-border p-4 space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <MapPin size={13} className="text-accent-500" />
                  <span className="font-medium">{destination}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Calendar size={13} className="text-accent-500" />
                  <span className="text-muted">{numDays} day{numDays !== 1 ? "s" : ""}</span>
                </div>
              </div>

              {/* Style selection */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted uppercase tracking-wider">
                  Travel style
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {styles.map((s) => (
                    <button
                      key={s.key}
                      onClick={() => setStyle(s.key)}
                      className={cn(
                        "flex items-center gap-2 rounded-xl border-2 p-3 text-left transition-all cursor-pointer",
                        style === s.key
                          ? "border-accent-500 bg-accent-50 shadow-sm"
                          : "border-border bg-white hover:border-accent-300"
                      )}
                    >
                      <span className="text-lg">{s.emoji}</span>
                      <span className={cn(
                        "text-sm font-medium",
                        style === s.key ? "text-accent-600" : "text-foreground"
                      )}>
                        {s.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Generate button */}
              <button
                onClick={handleGenerate}
                disabled={generating}
                className={cn(
                  "w-full flex items-center justify-center gap-2.5 rounded-2xl py-3.5 text-sm font-bold text-white transition-all cursor-pointer",
                  "bg-gradient-to-r from-accent-500 to-accent-600 shadow-lg shadow-accent-500/20",
                  "hover:shadow-xl hover:-translate-y-0.5",
                  "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                )}
              >
                {generating ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Crafting your itinerary...
                  </>
                ) : (
                  <>
                    <Sparkles size={16} />
                    Generate {numDays}-Day Itinerary
                  </>
                )}
              </button>

              {generating && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center text-xs text-muted"
                >
                  AI is planning activities, meals, and sightseeing for each day...
                </motion.div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ─── Dummy data generators ───────────────────────────────────────── */
function getDummyDayTitle(dayIdx: number, destination: string, style: string): string {
  const titles: Record<string, string[]> = {
    adventure: ["Arrival & First Exploration", "Mountain Trek & Scenic Views", "River Rafting Day", "Cycling the Countryside", "Summit Challenge", "Forest Trail & Waterfalls", "Final Adventure"],
    relaxed: ["Settle In & Stroll", "Beach & Spa Morning", "Leisurely Brunch & Gardens", "Art Gallery & Café Hopping", "Sunset Cruise", "Local Market & Cooking Class", "Farewell Day"],
    cultural: ["Historic Old Town Walk", "Museum & Heritage Tour", "Local Traditions Workshop", "Architecture & Landmarks", "Traditional Music & Dance", "Sacred Sites Visit", "Cultural Wrap-up"],
    foodie: ["Street Food Discovery", "Market & Cooking Class", "Fine Dining Experience", "Wine & Cheese Tour", "Bakery & Dessert Trail", "Farm-to-Table Visit", "Farewell Feast"],
  };
  const list = titles[style] ?? titles.adventure;
  return list[dayIdx % list.length];
}

function getDummyActivities(dayIdx: number, destination: string, style: string): Activity[] {
  const base: Activity[] = [
    { activityId: `ai-${dayIdx}-1-${Date.now()}`, time: "08:00", title: "Breakfast at hotel", category: "breakfast", location: "Hotel", estimatedCost: "15" },
    { activityId: `ai-${dayIdx}-2-${Date.now()}`, time: "09:30", title: style === "adventure" ? "Hiking trail exploration" : style === "cultural" ? "Guided museum tour" : style === "foodie" ? "Local market visit" : "Morning yoga session", category: "sightseeing", location: destination, estimatedCost: style === "adventure" ? "25" : "20" },
    { activityId: `ai-${dayIdx}-3-${Date.now()}`, time: "12:30", title: "Lunch at local restaurant", category: "lunch", location: `${destination} city center`, estimatedCost: "30" },
    { activityId: `ai-${dayIdx}-4-${Date.now()}`, time: "14:00", title: style === "adventure" ? "Rock climbing" : style === "cultural" ? "Heritage site visit" : style === "foodie" ? "Wine tasting" : "Spa treatment", category: "sightseeing", location: destination, estimatedCost: "40" },
    { activityId: `ai-${dayIdx}-5-${Date.now()}`, time: "19:00", title: "Dinner", category: "dinner", location: destination, estimatedCost: "45" },
  ];
  return base;
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
      Boolean(tripType) || Boolean(preferredWeather) || Boolean(preferenceNotes.trim());
    if (hasAnyPreference || prefsExisted) {
      try {
        await preferencesApi.save(trip.tripId, {
          tripType: tripType ?? undefined,
          preferredWeather: preferredWeather ?? undefined,
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

  function handleAIGenerate(days: DayPlan[]) {
    setItineraryDays(days);
    setExpandedDays(new Set([1]));
    setHasUnsavedChanges(true);
    addToast("AI itinerary generated! Review and customize as needed.", "success");
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
        className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-trippy-600 via-trippy-700 to-trippy-800 p-8 sm:p-10"
      >
        {/* Decorative elements */}
        <div className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-accent-500/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-8 -left-8 h-32 w-32 rounded-full bg-white/5 blur-2xl" />
        <div className="pointer-events-none absolute right-8 bottom-4 opacity-10">
          <Plane size={80} className="text-white rotate-12" />
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
            <h1 className="text-3xl font-bold text-white sm:text-4xl">{trip.title}</h1>
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
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-accent-400 to-accent-600 shadow-md shadow-accent-500/20">
              <Calendar size={16} className="text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Itinerary</h2>
              <p className="text-xs text-muted">
                {itineraryDays.length > 0
                  ? `${itineraryDays.length} day${itineraryDays.length !== 1 ? "s" : ""} planned`
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
                onClick={() => setAiPanelOpen(true)}
                className={cn(
                  "flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all cursor-pointer",
                  "bg-gradient-to-r from-trippy-600 to-trippy-700 text-white shadow-md shadow-trippy-500/20",
                  "hover:shadow-lg hover:-translate-y-0.5"
                )}
              >
                <Sparkles size={14} />
                AI Generate
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
                onClick={() => setAiPanelOpen(true)}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-trippy-600 to-trippy-700 px-4 py-2.5 text-sm font-semibold text-white shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all cursor-pointer"
              >
                <Sparkles size={14} /> Generate with AI
              </button>
            </div>
          </GlassCard>
        )}
      </motion.section>

      {/* AI Generate Panel */}
      <AIGeneratePanel
        open={aiPanelOpen}
        onClose={() => setAiPanelOpen(false)}
        tripTitle={trip.title}
        destination={trip.destination}
        numDays={numDays > 0 ? numDays : 5}
        onGenerate={handleAIGenerate}
      />

      {/* Edit Trip Modal */}
      <AnimatePresence>
        {editModalOpen && (
          <EditTripModal
            trip={trip}
            onClose={() => setEditModalOpen(false)}
            onSave={async (updates) => {
              try {
                await tripsApi.update(tripId, updates);
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
