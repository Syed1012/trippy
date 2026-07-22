"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { formatDestinationInput } from "@/lib/destination-format";
import {
  ArrowLeft,
  ArrowRight,
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
  Bus,
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
  Mail,
  UserPlus,
  Check,
  MessageCircle,
  Send,
  Search,
  User,
  Eye,
  EyeOff,
  TreePalm,
  Mountain,
  Building2,
  Trees,
  Compass,
  Landmark,
  ShoppingBag,
  CloudSun,
  Snowflake,
  RefreshCw,
  Star,
  Zap,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  LucideIcon,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { GlassCard, Button, Badge, Avatar, generateAvatarUrl } from "@/components/ui";
import { tripsApi, itineraryApi, commentsApi, usersApi, participantsApi, preferencesApi, ensureTripCoverImage, ApiError, type Trip, type TripDetail, type Participant, type DayPlan, type Activity, type VoteSummary, type ActivityVoteSummary, type ActivityComment as ActivityCommentType, type UserPublicProfile, type TripType, type PreferredWeather, type BudgetTier, type UpdateItineraryRequest, type TripPreference } from "@/lib/api";
import { useToast } from "@/lib/toast";
import { cn, tripIdFromSlug } from "@/lib/utils";
import { useRightRail } from "@/lib/right-rail";
import { useAIGeneration } from "@/lib/ai-generation";
import { type AISuggestion, buildDaySuggestions } from "@/lib/ai-suggestions";
import { type DayWeather, fetchDayWeather } from "@/lib/weather";
import DayMap from "@/components/trips/DayMap";

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
const categoryIcons: Record<string, LucideIcon> = {
  morning: Sun,
  breakfast: Coffee,
  lunch: Utensils,
  dinner: Utensils,
  food: Utensils,
  sightseeing: Compass,
  transport: Bus,
  shopping: ShoppingBag,
  activity: Trees,
  evening: Moon,
  culture: Landmark,
  nightlife: Moon,
  nature: Trees,
  wellness: Heart,
  default: MapPin,
};

function getCategoryIcon(category?: string) {
  if (!category) return categoryIcons.default;
  return categoryIcons[category.toLowerCase()] ?? categoryIcons.default;
}

/* ─── AI-polished read-only category badges ──────────────────────── */
const CAT_COLORS: Record<string, string> = {
  food: "bg-orange-100 text-orange-700 border-orange-200",
  sightseeing: "bg-blue-100 text-blue-700 border-blue-200",
  transport: "bg-slate-100 text-slate-600 border-slate-200",
  shopping: "bg-pink-100 text-pink-700 border-pink-200",
  activity: "bg-green-100 text-green-700 border-green-200",
  other: "bg-gray-100 text-gray-600 border-gray-200",
  morning: "bg-amber-100 text-amber-700 border-amber-200",
  breakfast: "bg-orange-100 text-orange-700 border-orange-200",
  lunch: "bg-orange-100 text-orange-700 border-orange-200",
  dinner: "bg-orange-100 text-orange-700 border-orange-200",
  evening: "bg-indigo-100 text-indigo-700 border-indigo-200",
  culture: "bg-purple-100 text-purple-700 border-purple-200",
  nightlife: "bg-indigo-100 text-indigo-700 border-indigo-200",
  nature: "bg-green-100 text-green-700 border-green-200",
  wellness: "bg-teal-100 text-teal-700 border-teal-200",
  default: "bg-gray-100 text-gray-600 border-gray-200",
};

function formatStartTime(st?: string): string {
  if (!st) return "";
  // Strip trailing ":00" seconds if present (e.g., "09:00:00" → "09:00")
  const stripped = st.replace(/^(\d{1,2}:\d{2}):\d{2}$/, "$1");
  return stripped;
}

/* ── Polished Read-Only Activity Card (matches AI preview style) ── */
function ReadOnlyActivityCard({
  activity,
  destination,
  isLast,
}: {
  activity: Activity;
  destination: string;
  isLast: boolean;
}) {
  const cat = activity.category?.toLowerCase() || "default";
  const catLabel = cat === "default" ? "" : cat.toUpperCase();
  const IconComponent = categoryIcons[cat] || categoryIcons.default;
  const colorCls = CAT_COLORS[cat] || CAT_COLORS.default;
  const displayTime = formatStartTime(activity.startTime) || formatStartTime(activity.time);

  return (
    <div className="group relative flex gap-4">
      {/* Timeline spine with time marker */}
      <div className="flex flex-col items-center shrink-0 w-16">
        {displayTime ? (
          <span className="text-[10px] font-black text-accent-600 bg-accent-500/10 border border-accent-200 px-2 py-1 rounded-lg text-center leading-tight whitespace-nowrap z-10">
            {displayTime}
          </span>
        ) : (
          <div className="w-3 h-3 rounded-full bg-accent-400 border-2 border-white shadow-sm z-10 mt-1" />
        )}
        {!isLast && (
          <div className="w-0.5 flex-1 bg-gradient-to-b from-accent-200 to-accent-100 my-1 min-h-[24px]" />
        )}
      </div>

      {/* Activity card */}
      <div className={`flex-1 min-w-0 ${isLast ? "pb-2" : "pb-4"}`}>
        <div className="rounded-xl border border-border/50 bg-white hover:border-accent-300/60 hover:shadow-sm transition-all px-4 py-3">
          <div className="flex items-start gap-3">
            {/* Category Icon Badge */}
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center border shrink-0 mt-0.5 ${colorCls}`}>
              <IconComponent size={15} />
            </div>
            <div className="flex-1 min-w-0">
              {/* Title + Category badge */}
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-bold text-foreground leading-tight">{activity.title}</p>
                {catLabel && (
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wide ${colorCls}`}>
                    {catLabel}
                  </span>
                )}
              </div>

              {/* Description */}
              {activity.description && (
                <p className="text-[12px] text-muted mt-1 leading-relaxed">{activity.description}</p>
              )}

              {/* Tips/Notes */}
              {activity.notes && (
                <p className="text-[11px] text-accent-600/70 mt-2 leading-relaxed italic border-l-2 border-accent-200 pl-2">
                  💡 {activity.notes}
                </p>
              )}

              {/* Meta row: location, Open in Maps, cost */}
              <div className="flex flex-wrap items-center gap-3 mt-2">
                {activity.location && (
                  <span className="text-[11px] text-muted flex items-center gap-1 font-medium">
                    <MapPin size={10} className="text-accent-400" />
                    {activity.location}
                  </span>
                )}
                {activity.location && (
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${activity.location}, ${destination}`)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-white px-2.5 py-1 text-[11px] font-medium text-foreground hover:bg-surface hover:text-trippy-500 hover:border-trippy-500/30 transition-all shadow-sm cursor-pointer"
                  >
                    <MapPin size={11} className="text-trippy-500" />
                    <span>Open in Maps</span>
                    <ArrowUpRight size={10} className="opacity-50" />
                  </a>
                )}
                {activity.estimatedCost && parseFloat(activity.estimatedCost) > 0 && (
                  <span className="text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-lg flex items-center gap-1">
                    <DollarSign size={9} /> {activity.estimatedCost}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function getWeatherIcon(condition: string | undefined): string {
  if (!condition) return "🌤️";
  const c = condition.toLowerCase();
  if (c.includes("clear")) return "☀️";
  if (c.includes("mainly clear")) return "🌤️";
  if (c.includes("partly cloudy")) return "⛅";
  if (c.includes("overcast") || c.includes("cloud")) return "☁️";
  if (c.includes("fog")) return "🌫️";
  if (c.includes("drizzle")) return "🌦️";
  if (c.includes("thunderstorm")) return "⛈️";
  if (c.includes("snow")) return "🌨️";
  if (c.includes("rain")) return "🌧️";
  if (c.includes("warm") || c.includes("summer")) return "☀️";
  if (c.includes("cold") || c.includes("winter") || c.includes("frost")) return "🌨️";
  if (c.includes("mild") || c.includes("spring")) return "🌸";
  if (c.includes("cool") || c.includes("autumn")) return "🍂";
  return "🌤️";
}

function formatTemperature(value?: number | null): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "";
  return `${Math.round(value)}°C`;
}

function DayContextBlocks({ day }: { day: DayPlan }) {
  const transport = day.transportRecommendations?.filter((item) =>
    Boolean((item.from || item.to) && (item.estimatedDuration || item.notes))
  ) ?? [];

  if (transport.length === 0) return null;

  return (
    <div className="bg-[#f9f9f7] px-5 py-4">
      <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 px-4 py-3">
        <div className="flex items-center gap-2">
          <Bus size={14} className="text-emerald-600" />
          <span className="text-[11px] font-black uppercase tracking-wider text-emerald-700">Transit</span>
        </div>
        <div className="mt-1.5 space-y-2">
          {transport.slice(0, 3).map((item, idx) => (
            <div key={`${item.from}-${item.to}-${idx}`} className="text-[11px] leading-relaxed">
              <p className="font-bold text-foreground/80">
                {item.from || "Start"} → {item.to || "Next stop"}
              </p>
              <p className="text-muted">
                {[item.mode || "Route", item.estimatedDuration].filter(Boolean).join(" · ")}
              </p>
              {item.notes && <p className="text-muted">{item.notes}</p>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function processItineraryDays(days: DayPlan[]): DayPlan[] {
  return days.map((day) => {
    let weather = day.weather;
    let transportRecommendations = day.transportRecommendations;
    const activities = (day.activities || []).filter((act) => {
      if (act.title === "__METADATA__") {
        try {
          const meta = JSON.parse(act.description || "{}");
          if (meta.weather) weather = meta.weather;
          if (meta.transportRecommendations) transportRecommendations = meta.transportRecommendations;
        } catch (e) {
          console.error("Failed to parse AI metadata activity", e);
        }
        return false; // exclude __METADATA__ from normal activities list
      }
      return true;
    });
    return {
      ...day,
      activities,
      weather,
      transportRecommendations,
    };
  });
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

/* ─── Smart itinerary helpers (quick-add, templates, auto-time) ───── */

/** One-tap activity starters shown under the quick-add bar. */
const ACTIVITY_TEMPLATES: {
  key: string;
  label: string;
  icon: typeof Coffee;
  title: string;
  category: string;
  durationMin: number;
}[] = [
  { key: "breakfast", label: "Breakfast", icon: Coffee, title: "Breakfast", category: "breakfast", durationMin: 60 },
  { key: "sightseeing", label: "Sightseeing", icon: Camera, title: "Sightseeing", category: "sightseeing", durationMin: 120 },
  { key: "lunch", label: "Lunch", icon: Utensils, title: "Lunch", category: "lunch", durationMin: 60 },
  { key: "transfer", label: "Transfer", icon: Navigation, title: "Transfer", category: "transport", durationMin: 45 },
  { key: "dinner", label: "Dinner", icon: Utensils, title: "Dinner", category: "dinner", durationMin: 90 },
  { key: "free", label: "Free time", icon: Compass, title: "Free time", category: "default", durationMin: 60 },
  { key: "nightlife", label: "Nightlife", icon: Moon, title: "Nightlife", category: "evening", durationMin: 120 },
];

/** Whole-day starter kits offered when a day is empty. */
const DAY_SCAFFOLDS: {
  key: string;
  label: string;
  icon: typeof Plane;
  title: string;
  items: { title: string; category: string; start: string; dur: number }[];
}[] = [
  {
    key: "arrival", label: "Arrival day", icon: Plane, title: "Arrival & settle in",
    items: [
      { title: "Arrive & airport transfer", category: "transport", start: "12:00", dur: 90 },
      { title: "Hotel check-in", category: "default", start: "14:30", dur: 30 },
      { title: "Explore the neighborhood", category: "sightseeing", start: "16:30", dur: 120 },
      { title: "Welcome dinner", category: "dinner", start: "19:30", dur: 90 },
    ],
  },
  {
    key: "explore", label: "Explore day", icon: Compass, title: "City exploring",
    items: [
      { title: "Breakfast", category: "breakfast", start: "08:30", dur: 60 },
      { title: "Morning sightseeing", category: "sightseeing", start: "10:00", dur: 150 },
      { title: "Lunch", category: "lunch", start: "13:00", dur: 60 },
      { title: "Afternoon landmarks", category: "sightseeing", start: "14:30", dur: 150 },
      { title: "Dinner", category: "dinner", start: "19:30", dur: 90 },
    ],
  },
  {
    key: "beach", label: "Beach day", icon: TreePalm, title: "Beach & relax",
    items: [
      { title: "Slow breakfast", category: "breakfast", start: "09:00", dur: 60 },
      { title: "Beach time", category: "sightseeing", start: "10:30", dur: 180 },
      { title: "Seaside lunch", category: "lunch", start: "13:30", dur: 75 },
      { title: "Sunset drinks", category: "evening", start: "18:30", dur: 90 },
    ],
  },
  {
    key: "departure", label: "Departure day", icon: Plane, title: "Departure",
    items: [
      { title: "Breakfast & pack", category: "breakfast", start: "09:00", dur: 75 },
      { title: "Last-minute souvenirs", category: "sightseeing", start: "10:30", dur: 90 },
      { title: "Hotel checkout", category: "default", start: "12:00", dur: 30 },
      { title: "Airport transfer", category: "transport", start: "13:30", dur: 90 },
    ],
  },
];

function hhmmToMin(t: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(t.trim());
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

function minToHHMM(min: number): string {
  const m = ((Math.round(min) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/** Split an activity's stored "HH:MM - HH:MM" (or single time) into start/end. */
function activityTimes(a: Activity): { start?: string; end?: string } {
  const parts = (a.time ?? "").split("-").map((s) => s.trim());
  return { start: parts[0] || a.startTime || undefined, end: parts[1] || a.endTime || undefined };
}

function startMinutes(a: Activity): number | null {
  const { start } = activityTimes(a);
  return start ? hhmmToMin(start) : null;
}

/** Suggest the next sensible start time: after the last activity, else 09:00. */
function nextDefaultStart(activities: Activity[]): string {
  for (let i = activities.length - 1; i >= 0; i--) {
    const { start, end } = activityTimes(activities[i]);
    const ref = end || start;
    const mins = ref ? hhmmToMin(ref) : null;
    if (mins != null) return minToHHMM(mins + (end ? 30 : 90));
  }
  return "09:00";
}

function makeActivity(partial: Partial<Activity>): Activity {
  return {
    activityId: `temp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    title: "",
    time: "",
    description: "",
    location: "",
    category: "default",
    estimatedCost: "",
    ...partial,
  };
}

/** Keep a day's activities in chronological order (untimed items sink to the end). */
function sortByTime(acts: Activity[]): Activity[] {
  return [...acts].sort((a, b) => (startMinutes(a) ?? 1e9) - (startMinutes(b) ?? 1e9));
}

/** Guess an activity category from free text. */
function detectCategory(text: string): string {
  const t = text.toLowerCase();
  const has = (...words: string[]) => words.some((w) => t.includes(w));
  if (has("breakfast", "brunch", "coffee", "café", "cafe", "espresso")) return "breakfast";
  if (has("lunch")) return "lunch";
  if (has("dinner", "supper")) return "dinner";
  if (has("bar", "club", "nightlife", "drinks", "pub", "cocktail")) return "evening";
  if (has("flight", "fly", "airport", "train", "bus", "taxi", "transfer", "drive", "ferry", "check-in", "check in", "checkout", "hotel"))
    return "transport";
  if (has("museum", "tour", "see ", "visit", "sightsee", "gallery", "landmark", "temple", "church", "castle", "palace", "park", "beach", "hike", "explore", "walk", "market"))
    return "sightseeing";
  return "default";
}

/**
 * Turn one line of natural language into an activity.
 * e.g. "9am Breakfast at Café Central $12" →
 *   { time:"09:00", title:"Breakfast", location:"Café Central", estimatedCost:"12", category:"breakfast" }
 * If no time is given, the next sensible slot is chosen automatically.
 */
function parseQuickAdd(raw: string, activities: Activity[]): Activity | null {
  let s = raw.trim();
  if (!s) return null;
  const original = s;

  // 1) Cost: "$12", "12$", "12 usd", "€10"
  let estimatedCost = "";
  const costMatch = s.match(/(?:[$€£₹¥]\s?(\d+(?:\.\d+)?))|(\d+(?:\.\d+)?)\s?(?:usd|eur|gbp|inr|jpy|dollars?|euros?)\b/i);
  if (costMatch) {
    estimatedCost = costMatch[1] ?? costMatch[2] ?? "";
    s = s.replace(costMatch[0], " ").trim();
  }

  // 2) Time: "9am", "9:30", "14:00", "at 2 pm"
  let start: string | undefined;
  const tm = s.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b|\b(\d{1,2}):(\d{2})\b/i);
  if (tm) {
    let h: number;
    let min: number;
    if (tm[3]) {
      h = parseInt(tm[1], 10);
      min = tm[2] ? parseInt(tm[2], 10) : 0;
      const pm = tm[3].toLowerCase() === "pm";
      if (pm && h !== 12) h += 12;
      if (!pm && h === 12) h = 0;
    } else {
      h = parseInt(tm[4], 10);
      min = parseInt(tm[5], 10);
    }
    if (h <= 23 && min <= 59) {
      start = minToHHMM(h * 60 + min);
      s = s.replace(tm[0], " ").trim();
    }
  }

  // 3) Location: trailing "at <place>" or "@ <place>"
  let location = "";
  const locMatch = s.match(/(?:\bat\s+|@\s*)(.+)$/i);
  if (locMatch) {
    location = locMatch[1].replace(/\s+/g, " ").trim();
    s = s.replace(locMatch[0], " ").trim();
  }

  // 4) Whatever is left is the title
  let title = s.replace(/\s{2,}/g, " ").replace(/^[\s,·-]+|[\s,·-]+$/g, "").trim();
  const category = detectCategory(original);
  if (!title) {
    title = ACTIVITY_TEMPLATES.find((t) => t.category === category)?.title || "Activity";
  }

  return makeActivity({
    title,
    location: location || undefined,
    estimatedCost: estimatedCost || undefined,
    category,
    time: start || nextDefaultStart(activities),
  });
}

/** Add N days to a "YYYY-MM-DD" (or ISO) date without timezone drift. */
function isoDatePlus(startDate: string, days: number): string {
  const base = new Date(startDate);
  const utc = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate()));
  utc.setUTCDate(utc.getUTCDate() + days);
  return utc.toISOString().slice(0, 10);
}

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
  // Progressive disclosure: keep the card compact, reveal detail fields on demand.
  // Open by default when there's already content or a live vote to show.
  const [detailsOpen, setDetailsOpen] = useState<boolean>(
    Boolean(activity.description?.trim() || activity.location?.trim() || (votingEnabled && !votingFrozen)),
  );
  const hasDetail = Boolean(activity.location?.trim() || activity.description?.trim());

  // Parse time range: "09:00 - 11:00" or just "09:00"
  const timeParts = (activity.time ?? "").split("-").map((s) => s.trim());
  const startTime = timeParts[0] ?? "";
  const endTime = timeParts[1] ?? "";

  function updateTime(start: string, end: string) {
    const combined = end ? `${start} - ${end}` : start;
    onUpdate({ ...activity, time: combined });
  }

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

      <div className="p-3.5 sm:p-4 space-y-2.5">
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

        {/* Row 2: Time picker buttons + Cost + Details toggle */}
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

          {/* Right group: cost + details toggle */}
          <div className="ml-auto flex items-center gap-2">
            {/* Cost with inline currency dropdown */}
            <div className="flex items-center gap-1 rounded-xl bg-shore-50 border border-border/80 px-2 py-1.5">
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
                className="w-14 bg-transparent text-xs font-medium text-foreground placeholder:text-muted/40 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            </div>

            {/* Details toggle (progressive disclosure) */}
            <button
              onClick={() => setDetailsOpen((o) => !o)}
              title="Location, notes & voting"
              className={cn(
                "relative flex items-center gap-1 rounded-xl border px-2.5 py-2 text-[11px] font-semibold transition-all cursor-pointer",
                detailsOpen
                  ? "border-accent-300 bg-accent-50 text-accent-700"
                  : "border-border/80 bg-shore-50 text-muted hover:border-accent-300 hover:text-accent-600"
              )}
            >
              <span>Details</span>
              {!detailsOpen && hasDetail && (
                <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-accent-500" />
              )}
              {detailsOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
          </div>
        </div>

        {/* Collapsible detail fields */}
        <AnimatePresence initial={false}>
          {detailsOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.22, ease: "easeInOut" }}
              className="overflow-hidden"
            >
              <div className="space-y-2.5 pt-0.5">
                {/* Location */}
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

                {/* Description / notes */}
                <textarea
                  value={activity.description ?? ""}
                  onChange={(e) => onUpdate({ ...activity, description: e.target.value })}
                  placeholder="Add notes or description..."
                  rows={2}
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
          )}
        </AnimatePresence>
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

/* ─── Per-day weather badge with hover timeline ───────────────────── */
function WeatherBadge({ destination, dateIso }: { destination?: string; dateIso?: string | null }) {
  const [data, setData] = useState<DayWeather | null>(null);
  const [loading, setLoading] = useState(true);
  const [hover, setHover] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!destination || !dateIso) return;

    const target = new Date(dateIso);
    const todayDate = new Date();
    target.setHours(0, 0, 0, 0);
    todayDate.setHours(0, 0, 0, 0);
    const diffTime = target.getTime() - todayDate.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays > 10) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    // Loading starts true; only flip it from inside the async callbacks so we
    // never call setState synchronously in the effect body.
    fetchDayWeather(destination, dateIso)
      .then((d) => { if (!cancelled) setData(d); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [destination, dateIso]);

  function openCard() {
    if (!ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const width = 264;
    const left = Math.max(12, Math.min(r.right - width, window.innerWidth - width - 12));
    setPos({ top: r.bottom + 8, left });
    setHover(true);
  }

  if (!destination || !dateIso) return null;

  // Do not show weather for days that are more than 10 days away
  const target = new Date(dateIso);
  const todayDate = new Date();
  target.setHours(0, 0, 0, 0);
  todayDate.setHours(0, 0, 0, 0);
  const diffTime = target.getTime() - todayDate.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  if (diffDays > 10) return null;
  if (loading && !data) {
    return <div className="h-7 w-16 shrink-0 animate-pulse rounded-full bg-shore-100" />;
  }
  if (!data || data.tempC == null) return null;

  // Timeline rows — for today, from the current hour to day end; downsampled to ~8.
  const today = new Date().toISOString().slice(0, 10);
  const isToday = dateIso === today;
  const nowHour = new Date().getHours();
  let rows = data.hourly;
  if (isToday) {
    const upcoming = rows.filter((h) => h.hour >= nowHour);
    if (upcoming.length > 0) rows = upcoming;
  }
  if (rows.length > 8) {
    const step = Math.ceil(rows.length / 8);
    rows = rows.filter((_, i) => i % step === 0);
  }

  return (
    <div
      ref={ref}
      className="group/weather relative shrink-0"
      onMouseEnter={openCard}
      onMouseLeave={() => setHover(false)}
    >
      <div className="flex items-center gap-1.5 rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1.5 text-sky-700 cursor-default transition-colors group-hover/weather:border-sky-300">
        <span className="text-sm leading-none">{data.icon}</span>
        <span className="text-[11px] font-bold whitespace-nowrap">{Math.round(data.tempC)}°C</span>
      </div>

      {hover && pos && typeof document !== "undefined" && createPortal(
        <div
          style={{ top: pos.top, left: pos.left, width: 264 }}
          className="pointer-events-none fixed z-[60] rounded-2xl border border-border bg-white p-4 shadow-2xl"
        >
          {/* Header */}
          <div className="flex items-center gap-3">
            <span className="text-2xl leading-none">{data.icon}</span>
            <div className="min-w-0">
              <p className="text-sm font-bold text-foreground leading-tight">{data.condition}</p>
              <p className="text-[10px] text-muted">
                {new Date(dateIso + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}
              </p>
            </div>
            <div className="ml-auto text-right shrink-0">
              <p className="text-lg font-black text-foreground leading-none">{Math.round(data.tempC)}°</p>
              {data.high != null && data.low != null && (
                <p className="text-[10px] text-muted mt-0.5">H {data.high}° · L {data.low}°</p>
              )}
            </div>
          </div>

          {/* Hourly timeline */}
          {rows.length > 0 ? (
            <div className="mt-3 border-t border-border/60 pt-2.5">
              <p className="text-[9px] font-bold uppercase tracking-wider text-muted mb-1.5">
                {isToday ? "Rest of today" : "Through the day"}
              </p>
              <div className="space-y-1">
                {rows.map((h) => (
                  <div key={h.iso} className="flex items-center gap-2 text-[11px]">
                    <span className="w-12 shrink-0 text-muted">{h.label}</span>
                    <span className="text-sm leading-none">{h.icon}</span>
                    <span className="w-8 shrink-0 font-bold text-foreground">{h.temp}°</span>
                    <span className="truncate text-muted">{h.condition}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="mt-3 border-t border-border/60 pt-2.5 text-[11px] text-muted">
              Hourly forecast opens closer to the date.
            </p>
          )}

          {/* Advice */}
          {data.advice && (
            <p className="mt-2.5 rounded-lg bg-shore-50 px-2.5 py-1.5 text-[10px] leading-snug text-muted">
              {data.advice}
            </p>
          )}
        </div>,
        document.body,
      )}
    </div>
  );
}

/* ─── Natural-language quick-add bar ──────────────────────────────── */
function QuickAddBar({ onAdd }: { onAdd: (text: string) => void }) {
  const [text, setText] = useState("");
  function submit() {
    const t = text.trim();
    if (!t) return;
    onAdd(t);
    setText("");
  }
  return (
    <div>
      <form
        onSubmit={(e) => { e.preventDefault(); submit(); }}
        className="flex items-center gap-2 rounded-xl border border-accent-200 bg-gradient-to-r from-accent-50/70 to-shore-50/60 px-3 py-2 transition-all focus-within:border-accent-400 focus-within:ring-2 focus-within:ring-accent-100"
      >
        <Zap size={14} className="shrink-0 text-accent-500" />
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Quick add — e.g. 9am Breakfast at Café Central $12"
          className="flex-1 bg-transparent text-xs font-medium text-foreground placeholder:text-muted/50 focus:outline-none"
        />
        <button
          type="submit"
          disabled={!text.trim()}
          className="shrink-0 rounded-lg bg-accent-500 px-2.5 py-1 text-[11px] font-bold text-white transition-colors hover:bg-accent-600 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
        >
          Add
        </button>
      </form>
      <p className="mt-1 pl-1 text-[10px] text-muted/70">
        Add a time, place or price and Trippy sorts it into the timeline — or tap a starter below.
      </p>
    </div>
  );
}

function DayCard({
  day,
  tripId,
  tripStartDate,
  destination,
  expanded,
  onToggle,
  onUpdateDay,
  currency,
  onCurrencyChange,
  onVoteUpdate,
  isParticipant,
  readOnly = false,
  isAiTrip = false,
}: {
  day: DayPlan;
  tripId: string;
  tripStartDate?: string;
  destination?: string;
  expanded: boolean;
  onToggle: () => void;
  onUpdateDay: (d: DayPlan) => void;
  currency: string;
  onCurrencyChange: (c: string) => void;
  onVoteUpdate: (dayNumber: number, summary: VoteSummary) => void;
  isParticipant: boolean;
  readOnly?: boolean;
  isAiTrip?: boolean;
}) {
  const dayDate = tripStartDate
    ? new Date(new Date(tripStartDate).getTime() + (day.dayNumber - 1) * 86400000).toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      })
    : null;
  // ISO date for this day, used for the weather lookup.
  const dayIso = day.date
    ? day.date.slice(0, 10)
    : tripStartDate
      ? isoDatePlus(tripStartDate, day.dayNumber - 1)
      : null;

  // Day-map: lazy-loaded, only the activities that carry a location, in planned order.
  const [mapOpen, setMapOpen] = useState(false);
  const mapStops = day.activities
    .filter((a) => a.location?.trim())
    .map((a) => ({ title: a.title?.trim() || "Untitled activity", location: a.location!.trim(), time: activityTimes(a).start }));

  const weatherCondition = day.weather?.condition;
  const hasWeather = weatherCondition && !weatherCondition.includes("unavailable");
  const weatherTemp = formatTemperature(day.weather?.temperatureCelsius);
  const weatherIcon = getWeatherIcon(weatherCondition);

  // Add a blank activity, pre-seeding a sensible start time so the user only types a title.
  function addActivity() {
    onUpdateDay({
      ...day,
      activities: [...day.activities, makeActivity({ time: nextDefaultStart(day.activities) })],
    });
  }

  // Natural-language quick add: "9am Breakfast at Café Central $12".
  function addQuick(text: string) {
    const activity = parseQuickAdd(text, day.activities);
    if (!activity) return;
    onUpdateDay({ ...day, activities: sortByTime([...day.activities, activity]) });
  }

  // A place picked from the day-map search: becomes an activity with the
  // place's address as location, auto-timed after the last activity.
  function addPlaceFromMap(place: { name: string; address: string; category: string }) {
    const activity = makeActivity({
      title: place.name,
      location: place.address || place.name,
      category: detectCategory(`${place.name} ${place.category}`),
      time: nextDefaultStart(day.activities),
    });
    onUpdateDay({ ...day, activities: sortByTime([...day.activities, activity]) });
  }

  // One-tap starter: adds a pre-categorised activity, auto-timed after the last one.
  function addFromTemplate(tpl: (typeof ACTIVITY_TEMPLATES)[number]) {
    const start = nextDefaultStart(day.activities);
    const end = minToHHMM((hhmmToMin(start) ?? 540) + tpl.durationMin);
    const activity = makeActivity({ title: tpl.title, category: tpl.category, time: `${start} - ${end}` });
    onUpdateDay({ ...day, activities: sortByTime([...day.activities, activity]) });
  }

  // Whole-day starter kit for an empty day.
  function applyScaffold(scaffold: (typeof DAY_SCAFFOLDS)[number]) {
    const activities = scaffold.items.map((it) =>
      makeActivity({
        title: it.title,
        category: it.category,
        time: `${it.start} - ${minToHHMM((hhmmToMin(it.start) ?? 540) + it.dur)}`,
      }),
    );
    onUpdateDay({
      ...day,
      title: day.title?.trim() ? day.title : scaffold.title,
      activities,
    });
  }

  function timeToMinutes(t: string): number {
    if (!t) return Infinity;
    const startPart = t.split("-")[0]?.trim() || "";
    const m24 = startPart.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
    if (m24) return parseInt(m24[1]) * 60 + parseInt(m24[2]);
    const m12 = startPart.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)$/i);
    if (m12) {
      let h = parseInt(m12[1]);
      const min = parseInt(m12[2]);
      const ampm = m12[4] || m12[3];
      if (ampm && ampm.toUpperCase() === "PM" && h !== 12) h += 12;
      if (ampm && ampm.toUpperCase() === "AM" && h === 12) h = 0;
      return h * 60 + min;
    }
    return Infinity;
  }

  function updateActivity(idx: number, updated: Activity) {
    const acts = [...day.activities];
    acts[idx] = updated;
    acts.sort((a, b) => timeToMinutes(a.time || "") - timeToMinutes(b.time || ""));
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
      <div className="p-4 sm:p-5">
        <div className="flex w-full items-center gap-3">
          <div
            role="button"
            tabIndex={0}
            onClick={onToggle}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onToggle(); }}
            className="flex flex-1 min-w-0 items-center gap-4 text-left cursor-pointer"
          >
            {isAiTrip ? (
              <div
                className="w-11 h-11 rounded-xl bg-gradient-to-br from-trippy-500 to-trippy-600 text-white flex flex-col items-center justify-center font-black shadow-md shadow-trippy-500/25 shrink-0"
              >
                <span className="text-[9px] font-bold opacity-80 leading-none">DAY</span>
                <span className="text-base leading-none">{day.dayNumber}</span>
              </div>
            ) : (
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
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
              {readOnly ? (
                <p className="flex-1 text-sm font-bold text-foreground">
                  {day.title || `Day ${day.dayNumber}`}
                </p>
              ) : (
                <input
                  type="text"
                  value={day.title ?? ""}
                  onChange={(e) => {
                    e.stopPropagation();
                    onUpdateDay({ ...day, title: e.target.value });
                  }}
                  onClick={(e) => e.stopPropagation()}
                  placeholder={`Day ${day.dayNumber} — Give it a title`}
                  className="flex-1 bg-transparent text-sm font-bold text-foreground placeholder:text-muted/50 focus:outline-none"
                />
              )}
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
        </div>

        {/* Weather badge beside the title */}
        <WeatherBadge destination={destination} dateIso={dayIso} />

        {/* Expand / collapse */}
        <button
          type="button"
          onClick={onToggle}
          aria-label={expanded ? "Collapse day" : "Expand day"}
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition-colors cursor-pointer",
              expanded ? "bg-accent-100 text-accent-600" : "bg-shore-100 text-muted hover:text-accent-600",
            )}
          >
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
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
            {/* Transit block at the top of the day content */}
            <DayContextBlocks day={day} />

            <div className={readOnly ? "px-4 pb-4 sm:px-5 sm:pb-5 space-y-0" : "px-4 pb-4 sm:px-5 sm:pb-5 space-y-3"}>
              {/* Smart quick-add + one-tap starters */}
              {!readOnly && isParticipant && (
                <div className="space-y-2.5">
                  <QuickAddBar onAdd={addQuick} />
                  <div className="flex flex-wrap gap-1.5">
                    {ACTIVITY_TEMPLATES.map((tpl) => {
                      const TplIcon = tpl.icon;
                      return (
                        <button
                          key={tpl.key}
                          onClick={() => addFromTemplate(tpl)}
                          className="flex items-center gap-1.5 rounded-full border border-border/70 bg-white px-2.5 py-1 text-[11px] font-semibold text-muted transition-all hover:-translate-y-0.5 hover:border-accent-300 hover:bg-accent-50/50 hover:text-accent-700 cursor-pointer"
                        >
                          <TplIcon size={12} className="text-accent-500" />
                          {tpl.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              {/* Activities list */}
              {readOnly ? (
                /* Polished read-only cards matching the AI preview */
                day.activities.map((activity, idx) => (
                  <ReadOnlyActivityCard
                    key={activity.activityId}
                    activity={activity}
                    destination={destination || ""}
                    isLast={idx === day.activities.length - 1}
                  />
                ))
              ) : (
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
              )}

              {/* Empty state — offer whole-day starter kits */}
              {day.activities.length === 0 && (
                <div className="rounded-2xl border border-dashed border-border bg-shore-50/40 px-4 py-5 text-center">
                  <p className="text-sm font-semibold text-foreground">Start this day in one tap</p>
                  <p className="mt-0.5 text-xs text-muted/70">
                    Pick a starter kit, quick-add above, or let AI plan it.
                  </p>
                  {isParticipant && (
                    <div className="mt-3 flex flex-wrap justify-center gap-2">
                      {DAY_SCAFFOLDS.map((scaffold) => {
                        const ScIcon = scaffold.icon;
                        return (
                          <button
                            key={scaffold.key}
                            onClick={() => applyScaffold(scaffold)}
                            className="flex items-center gap-1.5 rounded-xl border border-border bg-white px-3 py-2 text-xs font-semibold text-foreground shadow-sm transition-all hover:-translate-y-0.5 hover:border-accent-300 hover:text-accent-700 hover:shadow-md cursor-pointer"
                          >
                            <ScIcon size={13} className="text-accent-500" />
                            {scaffold.label}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Add activity button (only in edit mode) */}
              {!readOnly && isParticipant && (
                <button
                  onClick={addActivity}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border py-3 text-xs font-medium text-muted transition-all hover:border-accent-400 hover:text-accent-600 hover:bg-accent-50/50 cursor-pointer"
                >
                  <Plus size={14} /> Add a blank activity
                </button>
              )}

              {/* Day map — pins + road route + place search, lazily mounted on open */}
              <div className="pt-1">
                <button
                  onClick={() => setMapOpen((o) => !o)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-all cursor-pointer",
                    mapOpen
                      ? "border-accent-300 bg-accent-50 text-accent-700"
                      : "border-border bg-white text-foreground hover:border-accent-300 hover:text-accent-600",
                  )}
                >
                  <Map size={15} className="text-accent-500" />
                  {mapOpen ? "Hide day map" : "Show day map"}
                  <span className="text-[11px] font-medium text-muted">
                    {mapStops.length > 0
                      ? `· ${mapStops.length} location${mapStops.length !== 1 ? "s" : ""} routed`
                      : "· search & add places"}
                  </span>
                  <span className="ml-auto">
                    {mapOpen ? <ChevronUp size={16} className="text-muted" /> : <ChevronDown size={16} className="text-muted" />}
                  </span>
                </button>
                <AnimatePresence initial={false}>
                  {mapOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.2 }}
                      className="pt-3"
                    >
                      <DayMap
                        destination={destination ?? ""}
                        stops={mapStops}
                        onAddStop={isParticipant ? addPlaceFromMap : undefined}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
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
  onApply,
  onRemove,
  addedKeys,
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
  onApply: (dayNumber: number, suggestion: AISuggestion) => void;
  onRemove: (dayNumber: number, suggestion: AISuggestion) => void;
  addedKeys: Set<string>;
}) {
  const { addToast } = useToast();
  const { states, regenerateDay: regenerate } = useAIGeneration();
  const days = Math.max(1, numDays);
  const [activeDay, setActiveDay] = useState(1);
  const [regenning, setRegenning] = useState(false);
  // Per-day free-text steering for Regenerate ("slow morning, street food…").
  const [dayWishes, setDayWishes] = useState<Record<number, string>>({});

  // Generation lives in the dashboard-level provider, so it keeps running while
  // the user navigates away and is ready when they return to this trip.
  const genState = states[tripId];
  const phase: "loading" | "ready" = genState?.status === "ready" ? "ready" : "loading";
  const suggestions = genState?.suggestions ?? {};

  // A suggestion is "added" when the day already has an activity with that title
  // (matched by title so it survives the itinerary save round-trip).
  const isAdded = (dayNumber: number, title: string) =>
    addedKeys.has(`${dayNumber}::${title.trim().toLowerCase()}`);

  async function regenerateDay() {
    setRegenning(true);
    try {
      await regenerate(tripId, activeDay, dayWishes[activeDay]);
    } finally {
      setRegenning(false);
    }
  }

  function choose(s: AISuggestion) {
    if (isAdded(activeDay, s.title)) {
      onRemove(activeDay, s);
      addToast(`Removed “${s.title}” from Day ${activeDay}`, "info");
    } else {
      onApply(activeDay, s);
      addToast(`Added “${s.title}” to Day ${activeDay}`, "success");
    }
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

  const daySuggestions = suggestions[activeDay] ?? (phase === "ready" ? buildDaySuggestions(activeDay, destination) : []);
  // Days that have at least one added suggestion (drives the tab checks + progress).
  const chosenCount = Array.from({ length: days }, (_, i) => i + 1).filter((d) =>
    (suggestions[d] ?? []).some((sg) => isAdded(d, sg.title)),
  ).length;
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
                    const done = (suggestions[d] ?? []).some((sg) => isAdded(d, sg.title));
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
                <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted">
                  Day {activeDay} · pick your vibe
                </p>
                {/* Wish bar: steer what Regenerate comes back with */}
                <div className="mb-4 flex items-center gap-2">
                  <div className="flex min-w-0 flex-1 items-center gap-1.5 rounded-full border border-border bg-surface/70 px-3 py-1.5 transition-colors focus-within:border-accent-400">
                    <Wand2 size={12} className="shrink-0 text-accent-500" />
                    <input
                      value={dayWishes[activeDay] ?? ""}
                      onChange={(e) => setDayWishes((w) => ({ ...w, [activeDay]: e.target.value }))}
                      onKeyDown={(e) => { if (e.key === "Enter" && !regenning) void regenerateDay(); }}
                      maxLength={200}
                      placeholder="What should this day feel like? e.g. slow morning, street food, live jazz"
                      className="min-w-0 flex-1 bg-transparent text-[11px] font-semibold text-foreground outline-none placeholder:text-muted/50"
                    />
                  </div>
                  <button
                    onClick={regenerateDay}
                    disabled={regenning}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-surface/70 px-3 py-1.5 text-[11px] font-bold text-muted transition hover:border-accent-300 hover:text-foreground disabled:opacity-50 cursor-pointer"
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
                      const isChosen = isAdded(activeDay, s.title);
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

                          {/* specific place / location */}
                          {s.location && (
                            <p className="relative mt-2 flex items-start gap-1.5 text-[11px] font-medium text-foreground/70">
                              <MapPin size={12} className="mt-0.5 shrink-0 text-accent-500" />
                              <span className="min-w-0">{s.location}</span>
                            </p>
                          )}

                          {/* notes */}
                          <p className="relative mt-3 text-xs leading-relaxed text-muted">{s.notes}</p>

                          {/* CTA */}
                          <button
                            onClick={() => choose(s)}
                            title={isChosen ? "Tap to remove from this day" : undefined}
                            className={cn(
                              "group/cta relative mt-4 flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-bold transition-all cursor-pointer",
                              isChosen
                                ? "border border-emerald-400/50 bg-emerald-50 text-emerald-700 hover:border-red-300 hover:bg-red-50 hover:text-red-600"
                                : cn(
                                    "bg-gradient-to-r text-white shadow-[0_14px_28px_-16px_rgba(20,47,43,0.6)] hover:-translate-y-0.5",
                                    vibe.gradient,
                                  ),
                            )}
                          >
                            {isChosen ? (
                              <>
                                <Check size={14} className="group-hover/cta:hidden" />
                                <X size={14} className="hidden group-hover/cta:inline" />
                                <span className="group-hover/cta:hidden">Added to Day {activeDay}</span>
                                <span className="hidden group-hover/cta:inline">Remove from Day {activeDay}</span>
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
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RECENT_INVITES_STORAGE_PREFIX = "trippy_recent_invites:";

function getRecentInviteStorageKey(tripId: string): string {
  return `${RECENT_INVITES_STORAGE_PREFIX}${tripId}`;
}

function readRecentInviteEmails(tripId: string): string[] {
  try {
    const stored = window.localStorage.getItem(getRecentInviteStorageKey(tripId));
    const emails = stored ? JSON.parse(stored) : [];
    return Array.isArray(emails)
      ? emails.filter((email): email is string => typeof email === "string" && EMAIL_PATTERN.test(email))
      : [];
  } catch {
    return [];
  }
}

function saveRecentInviteEmail(tripId: string, email: string): string[] {
  const normalizedEmail = email.trim().toLowerCase();
  const emails = [normalizedEmail, ...readRecentInviteEmails(tripId).filter((item) => item !== normalizedEmail)].slice(0, 10);
  try {
    window.localStorage.setItem(getRecentInviteStorageKey(tripId), JSON.stringify(emails));
  } catch {
    // Storage can be unavailable in private browsing; the current modal still retains the invite.
  }
  return emails;
}

function InviteModal({
  tripId,
  onClose,
  onInvited,
  currentUserName,
  invitedParticipants,
}: {
  tripId: string;
  onClose: () => void;
  onInvited: () => void;
  currentUserName: string;
  invitedParticipants: Participant[];
}) {
  const { addToast } = useToast();
  const { user } = useAuth();
  const [email, setEmail] = useState("");
  const [selectedUser, setSelectedUser] = useState<UserPublicProfile | null>(null);
  const [inviteMessage, setInviteMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Search states
  const [searchResults, setSearchResults] = useState<UserPublicProfile[]>([]);
  const [searching, setSearching] = useState(false);
  const [recentEmailInvites, setRecentEmailInvites] = useState<string[]>([]);

  useEffect(() => {
    setRecentEmailInvites(readRecentInviteEmails(tripId));
  }, [tripId]);

  const trimmedEmail = email.trim();
  const isValidEmail = EMAIL_PATTERN.test(trimmedEmail);
  const normalizedEmail = trimmedEmail.toLowerCase();
  const existingInvite = invitedParticipants.find((participant) =>
    (selectedUser?.id && participant.userId === selectedUser.id)
    || (!!normalizedEmail && participant.email?.toLowerCase() === normalizedEmail)
  );
  const wasPreviouslyInvited = Boolean(existingInvite)
    || (!!normalizedEmail && recentEmailInvites.includes(normalizedEmail));
  const recentInvites = invitedParticipants.filter((participant) =>
    Boolean(participant.email || participant.displayName)
  );
  const localRecentInvites = recentEmailInvites
    .filter((savedEmail) => !recentInvites.some((participant) => participant.email?.toLowerCase() === savedEmail))
    .map((savedEmail) => ({
      participantId: `local-${savedEmail}`,
      email: savedEmail,
      displayName: undefined,
    }));
  const allRecentInvites = [...recentInvites, ...localRecentInvites];
  const matchingRecentInvites = allRecentInvites.filter((participant) => {
    if (!trimmedEmail) return true;
    const query = trimmedEmail.toLowerCase();
    return participant.email?.toLowerCase().includes(query)
      || participant.displayName?.toLowerCase().includes(query);
  });

  // Debounced search for platform users based on input value
  useEffect(() => {
    const query = email.trim();
    // If empty or already looks like a complete exact email matching pattern, don't show search dropdown
    if (query.length < 2 || EMAIL_PATTERN.test(query)) {
      setSearchResults([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    const timer = setTimeout(() => {
      usersApi
        .search(query, 5)
        .then((res) => {
          // Filter out the logged-in user from matching results
          const filtered = res.filter((u) => u.id !== user?.userId && u.email !== user?.email);
          setSearchResults(filtered);
        })
        .catch(() => {
          setSearchResults([]);
        })
        .finally(() => {
          setSearching(false);
        });
    }, 300);

    return () => clearTimeout(timer);
  }, [email, user]);

  async function handleSend() {
    if (!selectedUser && !isValidEmail) {
      setError("Enter a valid email address");
      return;
    }
    setError(null);
    setSending(true);
    try {
      if (selectedUser) {
        // Invite platform user: app invite + mail both
        await participantsApi.invite(
          tripId,
          selectedUser.id,
          selectedUser.email || undefined,
          inviteMessage.trim() || undefined,
          currentUserName || undefined,
          selectedUser.displayName || undefined
        );
        if (selectedUser.email) {
          setRecentEmailInvites(saveRecentInviteEmail(tripId, selectedUser.email));
        }
      } else {
        // Just email invite
        await participantsApi.inviteByEmail(
          tripId,
          trimmedEmail,
          inviteMessage.trim() || undefined,
          currentUserName || undefined
        );
        setRecentEmailInvites(saveRecentInviteEmail(tripId, trimmedEmail));
      }
      setEmail("");
      setSelectedUser(null);
      setSearchResults([]);
      addToast("Invitation sent successfully!", "success");
      onInvited();
    } catch {
      addToast("Failed to send invitation", "error");
    } finally {
      setSending(false);
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

        {/* Content Body */}
        <div className="px-6 py-4 space-y-4">
          <p className="text-xs text-muted">
            We&apos;ll email them a summary of this trip. Enter an email address or search for a registered user on the platform.
          </p>

          <div className="space-y-2">
            <div className="relative">
              <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input
                type="text"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setSelectedUser(null);
                  if (error) setError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Enter email or search by name..."
                autoFocus
                className="w-full rounded-xl border border-border bg-shore-50 pl-9 pr-8 py-2.5 text-sm text-foreground placeholder:text-muted/60 focus:outline-none focus:border-accent-400 focus:ring-1 focus:ring-accent-100 transition-colors"
              />
              {searching ? (
                <Loader2 size={14} className="animate-spin absolute right-3 top-1/2 -translate-y-1/2 text-muted" />
              ) : email && (
                <button
                  type="button"
                  onClick={() => {
                    setEmail("");
                    setSelectedUser(null);
                    setSearchResults([]);
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-foreground cursor-pointer p-0.5 rounded-full hover:bg-black/5"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Suggestions list */}
            {(searchResults.length > 0 || matchingRecentInvites.length > 0) && (
              <div className="border border-border rounded-2xl overflow-hidden max-h-40 overflow-y-auto bg-white divide-y divide-border shadow-sm">
                {matchingRecentInvites.length > 0 && (
                  <>
                    <div className="px-3 py-1.5 bg-shore-50 text-[10px] font-semibold text-muted uppercase tracking-wider">
                      Recently invited
                    </div>
                    {matchingRecentInvites.map((participant) => {
                      const recipient = participant.email || participant.displayName || "Previously invited recipient";
                      return (
                        <button
                          key={participant.participantId}
                          type="button"
                          onClick={() => {
                            setSelectedUser(null);
                            setEmail(participant.email || participant.displayName || "");
                            setSearchResults([]);
                          }}
                          className="w-full flex items-center gap-3 p-2.5 hover:bg-shore-50 transition-colors text-left cursor-pointer"
                        >
                          <div className="h-7 w-7 rounded-full bg-green-50 flex items-center justify-center text-green-700 shrink-0">
                            <Check size={14} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-foreground truncate">{participant.displayName || recipient}</p>
                            {participant.email && participant.displayName && (
                              <p className="text-[10px] text-muted truncate">{participant.email}</p>
                            )}
                          </div>
                          <span className="text-[10px] font-medium text-green-700 shrink-0">Invited</span>
                        </button>
                      );
                    })}
                  </>
                )}
                {searchResults.length > 0 && (
                  <>
                    <div className="px-3 py-1.5 bg-shore-50 text-[10px] font-semibold text-muted uppercase tracking-wider">
                      Matching platform users
                    </div>
                    {searchResults.map((user) => (
                      <button
                        key={user.id}
                        type="button"
                        onClick={() => {
                          setSelectedUser(user);
                          setEmail(user.displayName || user.email || "");
                          setSearchResults([]);
                        }}
                        className="w-full flex items-center gap-3 p-2.5 hover:bg-shore-50 transition-colors text-left cursor-pointer"
                      >
                        <div className="h-7 w-7 rounded-full bg-accent-500/10 flex items-center justify-center text-accent-700 font-bold text-xs overflow-hidden shrink-0">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={user.avatarUrl || generateAvatarUrl(user.displayName)} alt={user.displayName} className="h-full w-full object-cover" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-foreground truncate">{user.displayName}</p>
                          <p className="text-[10px] text-muted truncate">{user.email}</p>
                        </div>
                      </button>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}
          {wasPreviouslyInvited && (
            <div className="flex items-start gap-2 rounded-xl border border-green-200 bg-green-50 p-3 text-xs text-green-800">
              <Check size={14} className="mt-0.5 shrink-0" />
              <p>An invitation has already been sent to {existingInvite?.email || existingInvite?.displayName || trimmedEmail || "this person"}.</p>
            </div>
          )}
          
          <textarea
            value={inviteMessage}
            onChange={(e) => setInviteMessage(e.target.value)}
            placeholder="Add a message (optional)..."
            rows={2}
            maxLength={300}
            className="w-full rounded-xl border border-border bg-shore-50 px-4 py-2.5 text-sm text-foreground placeholder:text-muted/60 focus:outline-none focus:border-accent-400 focus:ring-1 focus:ring-accent-100 transition-colors resize-none"
          />
          
          <button
            onClick={handleSend}
            disabled={(!selectedUser && !isValidEmail) || sending || wasPreviouslyInvited}
            className={cn(
              "flex w-full items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-medium transition-all cursor-pointer",
              "bg-accent-500 text-white hover:bg-accent-600 shadow-sm",
              ((!selectedUser && !isValidEmail) || sending || wasPreviouslyInvited) && "opacity-60 cursor-not-allowed",
            )}
          >
            {sending ? (
              <><Loader2 size={14} className="animate-spin" /> Sending</>
            ) : (
              <><UserPlus size={14} /> Send Invite</>
            )}
          </button>
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
  const [destination, setDestination] = useState(formatDestinationInput(trip.destination));
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
      destination: formatDestinationInput(destination).trim(),
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
              onChange={(e) => setDestination(formatDestinationInput(e.target.value))}
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

function isAiGeneratedTrip(desc: string | undefined): boolean {
  return typeof desc === "string" && desc.includes("[AI_GENERATED]");
}

function cleanDescription(desc: string | undefined): string {
  if (!desc) return "";
  return desc.replace("[AI_GENERATED]", "").trim();
}

/* ─── Main Page Component ─────────────────────────────────────────── */
export default function TripDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { addToast } = useToast();
  const { user } = useAuth();
  const tripId = tripIdFromSlug(params.id as string);

  const searchParams = useSearchParams();
  const isFromAi = searchParams.get("from") === "ai";

  const [trip, setTrip] = useState<TripDetail | null>(null);
  const [allTrips, setAllTrips] = useState<Trip[]>([]);
  const hasAiTag = trip ? isAiGeneratedTrip(trip.description) : false;
  const [preferences, setPreferences] = useState<TripPreference | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editStartDate, setEditStartDate] = useState("");
  const [editEndDate, setEditEndDate] = useState("");
  const [editVisibility, setEditVisibility] = useState<"PRIVATE" | "PUBLIC">("PRIVATE");

  useEffect(() => {
    if (trip) {
      setEditTitle(trip.title);
      setEditDesc(cleanDescription(trip.description));
      setEditStartDate(trip.startDate || "");
      setEditEndDate(trip.endDate || "");
      setEditVisibility((trip.visibility || "PRIVATE") as "PRIVATE" | "PUBLIC");
    }
  }, [trip]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedDays, setExpandedDays] = useState<Set<number>>(new Set([1]));
  const [itineraryDays, setItineraryDays] = useState<DayPlan[]>([]);
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const [aiMinimized, setAiMinimized] = useState(false);
  const [aiSession, setAiSession] = useState(0);
  const [panelWidth, setPanelWidth] = useState(AI_DEFAULT_W);
  const { setReserve, setDragging } = useRightRail();
  const { ensureStarted: startAIGeneration, hydrate: hydrateAIGeneration } = useAIGeneration();

  // Release the reserved rail space when leaving the trip page.
  useEffect(() => () => setReserve(0), [setReserve]);

  function openAI() {
    // AI Suggestions is host-only; ignore any stray trigger from a non-owner.
    if (!isOwner) return;
    setAiPanelOpen(true);
    setAiMinimized(false);
    setAiSession((n) => n + 1);
    setReserve(panelWidth + AI_RAIL_GAP);
    // Kick off (or reuse) a background generation for this trip. It keeps running
    // in the dashboard-level provider even if the user collapses and navigates away.
    if (trip) {
      startAIGeneration({
        tripId: trip.tripId,
        destination: trip.destination,
        days: numDays > 0 ? numDays : 5,
        existingItinerary: itineraryDays
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
    }
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
  // Add an AI suggestion into the working itinerary and persist it immediately,
  // so generated plans survive a logout without needing a manual Save. The full
  // set of fields (time range, location, cost) is carried over from the suggestion.
  function applySuggestion(dayNumber: number, s: AISuggestion) {
    const time = s.startTime && s.endTime ? `${s.startTime} - ${s.endTime}` : (s.startTime || "");
    const activity: Activity = {
      activityId: `ai-rec-${dayNumber}-${Date.now()}`,
      time,
      title: s.title,
      description: s.notes || undefined,
      location: s.location || undefined,
      estimatedCost: s.cost ? String(Math.round(s.cost)) : undefined,
      category: "sightseeing",
    };
    const exists = itineraryDays.some((d) => d.dayNumber === dayNumber);
    // Day title is intentionally left untouched — "Day N" is enough; the day
    // title is optional and no longer derived from the first suggestion.
    const nextDays = exists
      ? itineraryDays.map((d) =>
          d.dayNumber === dayNumber
            ? { ...d, activities: [...d.activities, activity] }
            : d,
        )
      : [
          ...itineraryDays,
          { dayPlanId: `day-${dayNumber}-${Date.now()}`, dayNumber, title: "", activities: [activity] },
        ].sort((a, b) => a.dayNumber - b.dayNumber);

    setItineraryDays(nextDays);
    setExpandedDays((prev) => new Set(prev).add(dayNumber));
    setHasUnsavedChanges(true);
    // Auto-save in the background so the AI-generated plan is stored right away.
    void persistItinerary(nextDays, { silent: true });
  }

  // Remove a previously-added AI suggestion from a day (matched by title), so the
  // AI Studio shows "Add" again. Kept in sync with the itinerary via title match.
  function removeSuggestion(dayNumber: number, s: AISuggestion) {
    const key = s.title.trim().toLowerCase();
    const nextDays = itineraryDays.map((d) =>
      d.dayNumber === dayNumber
        ? { ...d, activities: d.activities.filter((a) => (a.title ?? "").trim().toLowerCase() !== key) }
        : d,
    );
    setItineraryDays(nextDays);
    setHasUnsavedChanges(true);
    void persistItinerary(nextDays, { silent: true });
  }
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [currency, setCurrency] = useState("USD");
  const [saving, setSaving] = useState(false);
  // Serialize itinerary saves so rapid changes (e.g. adding several AI
  // suggestions in a row) can't race — the latest pending state always wins.
  const savingRef = useRef(false);
  const pendingSaveRef = useRef<DayPlan[] | null>(null);
  const [votingSettingsOpen, setVotingSettingsOpen] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [isOwnerOrEditor, setIsOwnerOrEditor] = useState(false);
  const [isParticipant, setIsParticipant] = useState(false);
  const [isPendingApproval, setIsPendingApproval] = useState(false);
  const [isInvited, setIsInvited] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [processingRequestUserId, setProcessingRequestUserId] = useState<string | null>(null);
  const [isPrivateTrip, setIsPrivateTrip] = useState(false);
  const [acceptingInvite, setAcceptingInvite] = useState(false);
  const [decliningInvite, setDecliningInvite] = useState(false);

  const applyParticipantFlags = useCallback(
    (data: TripDetail) => {
      if (user?.userId && data.participants) {
        const me = data.participants.find((p) => p.userId === user.userId);
        setIsOwner(me?.role === "OWNER");
        setIsOwnerOrEditor(me?.role === "OWNER" || me?.role === "EDITOR");
        setIsParticipant(!!me && (me.status === "ACCEPTED" || me.role === "OWNER"));
        setIsPendingApproval(!!me && me.status === "PENDING_APPROVAL");
        setIsInvited(!!me && me.status === "INVITED");
      } else {
        setIsOwner(false);
        setIsParticipant(false);
        setIsPendingApproval(false);
        setIsInvited(false);
      }
    },
    [user?.userId]
  );

  const enrichParticipants = useCallback(async (data: TripDetail) => {
    if (data.participants && data.participants.length > 0) {
      try {
        const userIds = data.participants.map((p) => p.userId).filter(Boolean);
        if (userIds.length === 0) return data;
        const profiles = await usersApi.batchProfiles(userIds);
        const profileMap: Record<string, typeof profiles[number]> = {};
        for (const p of profiles) profileMap[p.id] = p;
        data.participants = data.participants.map((p) => {
          if (!p.userId) return p;
          const profile = profileMap[p.userId];
          return {
            ...p,
            displayName: profile?.displayName ?? p.displayName,
            avatarUrl: profile?.avatarUrl ?? p.avatarUrl,
            email: profile?.email ?? p.email,
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
    const data = await tripsApi.getAccessible(tripId);
    if (user?.userId) {
      await enrichParticipants(data);
    }
    setTrip(data);
    applyParticipantFlags(data);
  }, [tripId, user?.userId, enrichParticipants, applyParticipantFlags]);

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

  async function handleRevokeInvite(participant: { userId?: string; email?: string }) {
    if (!tripId) return;
    const trackingId = participant.userId || participant.email || "";
    setProcessingRequestUserId(trackingId);
    try {
      await participantsApi.reject(tripId, participant.userId || undefined, participant.email || undefined);
      addToast("Invitation revoked.", "success");
      await refreshTrip();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to revoke invitation";
      addToast(msg, "error");
    } finally {
      setProcessingRequestUserId(null);
    }
  }

  async function handleAcceptInvite() {
    if (!tripId) return;
    setAcceptingInvite(true);
    try {
      await participantsApi.accept(tripId);
      addToast("You have joined the trip!", "success");
      await refreshTrip();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to accept invite";
      addToast(msg, "error");
    } finally {
      setAcceptingInvite(false);
    }
  }

  async function handleDeclineInvite() {
    if (!tripId) return;
    setDecliningInvite(true);
    try {
      await participantsApi.decline(tripId);
      addToast("You have declined the invite.", "info");
      router.push("/");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to decline invite";
      addToast(msg, "error");
    } finally {
      setDecliningInvite(false);
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
    const loadTrip = tripsApi.getAccessible(tripId);
    const loadItinerary = itineraryApi.getAccessible(tripId);

    // Fetch user's trips to filter completed ones for Travel Buddies mutual history
    tripsApi.list(0, 100)
      .then((res) => {
        if (res?.content) setAllTrips(res.content);
      })
      .catch(() => {});

    loadTrip
      .then(async (data) => {
        // Fetch participant display names from user-service
        if (user?.userId) {
          await enrichParticipants(data);
        }
        setTrip(data);
        if (user?.userId) {
          preferencesApi.getForTrip(tripId)
            .then((pref) => setPreferences(pref))
            .catch(() => {});
        }

        // Check if current user is owner/editor
        applyParticipantFlags(data);

        // Fetch itinerary from backend
        try {
          const itinerary = await loadItinerary;
          if (itinerary.days.length > 0) {
            const processedDays = processItineraryDays(itinerary.days);
            setItineraryDays(processedDays);
            // Restore the itinerary's saved currency (persisted per activity).
            const savedCurrency = processedDays
              .flatMap((d) => d.activities)
              .find((a) => a.currency)?.currency;
            if (savedCurrency) setCurrency(savedCurrency);
            // Auto-expand all days by default
            setExpandedDays(new Set(processedDays.map((d) => d.dayNumber)));
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
      .catch((err: unknown) => {
        if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
          setIsPrivateTrip(true);
          setError("This trip is private. If you have been invited, please sign in with the email the invite was sent to.");
        } else {
          setError("Failed to load trip details");
        }
      })
      .finally(() => setLoading(false));
  }, [tripId, user?.userId, enrichParticipants, applyParticipantFlags]);

  function getNumDays(startDate?: string, endDate?: string): number {
    if (!startDate || !endDate) return 0;
    const diff = new Date(endDate).getTime() - new Date(startDate).getTime();
    return Math.max(1, Math.ceil(diff / 86400000) + 1);
  }

  const numDays = getNumDays(trip?.startDate, trip?.endDate);

  // Keys of AI suggestions already present in the itinerary ("day::title"), so the
  // AI Studio can mark them Added and revert to Add when removed from the itinerary.
  const addedSuggestionKeys = new Set<string>();
  for (const d of itineraryDays) {
    for (const a of d.activities) {
      if (a.title?.trim()) addedSuggestionKeys.add(`${d.dayNumber}::${a.title.trim().toLowerCase()}`);
    }
  }

  // Pull in any recommendations generated earlier (survives reloads / navigation)
  // so reopening the AI panel shows them instantly instead of regenerating.
  useEffect(() => {
    if (trip?.tripId && trip.destination) {
      hydrateAIGeneration(trip.tripId, trip.destination, numDays > 0 ? numDays : 5);
    }
  }, [trip?.tripId, trip?.destination, numDays, hydrateAIGeneration]);

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

  // Build the trip-service payload from the working itinerary days.
  function buildItineraryPayload(days: DayPlan[]): UpdateItineraryRequest {
    return {
      dayPlans: days.map((day) => ({
        dayNumber: day.dayNumber,
        date: day.date ?? undefined,
        title: day.title || undefined,
        activities: [
          ...day.activities.map((a) => {
            // Parse time "09:00 - 11:00" into startTime/endTime
            const timeParts = (a.time ?? "").split("-").map((s) => s.trim());
            const startTime = timeParts[0] || a.startTime || undefined;
            const endTime = timeParts[1] || a.endTime || undefined;
            // Map frontend "default" category to backend "OTHER"
            const rawCat = (a.category ?? "OTHER").toUpperCase();
            const category = rawCat === "DEFAULT" ? "OTHER" : rawCat;
            const costNum = a.estimatedCost != null && a.estimatedCost !== "" ? Number(a.estimatedCost) : NaN;
            return {
              title: a.title || "Untitled activity",
              description: a.description || undefined,
              location: a.location || undefined,
              startTime,
              endTime,
              category,
              notes: a.notes || undefined,
              estimatedCost: Number.isFinite(costNum) ? costNum : undefined,
              currency: currency || undefined,
            };
          }),
          ...((day.transportRecommendations?.length || day.weather) ? [{
            title: "__METADATA__",
            description: JSON.stringify({
              transportRecommendations: day.transportRecommendations,
              weather: day.weather
            }),
            location: undefined,
            startTime: undefined,
            endTime: undefined,
            category: "OTHER",
            notes: undefined
          }] : [])
        ],
      })),
    };
  }

  // Persist the itinerary. Saves are serialized (see savingRef/pendingSaveRef) so
  // rapid changes can't race; a silent save skips the spinner/toast (auto-save).
  async function persistItinerary(days: DayPlan[], opts?: { silent?: boolean }): Promise<boolean> {
    if (savingRef.current) {
      pendingSaveRef.current = days;
      return false;
    }
    savingRef.current = true;
    if (!opts?.silent) setSaving(true);
    try {
      const result = await itineraryApi.update(tripId, buildItineraryPayload(days));
      setItineraryDays(processItineraryDays(result.days));
      setHasUnsavedChanges(false);
      // The backend may auto-promote DRAFT → PLANNED (or back) based on the
      // itinerary; refresh so the status badge reflects it without a reload.
      void refreshTrip();
      if (!opts?.silent) addToast("Itinerary saved successfully", "success");
      return true;
    } catch {
      addToast("Failed to save itinerary", "error");
      return false;
    } finally {
      savingRef.current = false;
      if (!opts?.silent) setSaving(false);
      const pending = pendingSaveRef.current;
      if (pending) {
        pendingSaveRef.current = null;
        void persistItinerary(pending, { silent: true });
      }
    }
  }

  async function handleSave() {
    await persistItinerary(itineraryDays);
  }

  async function saveInlineEdits() {
    if (!tripId) return;
    setSaving(true);
    try {
      const finalDesc = hasAiTag
        ? ((editDesc || "").trim() + " [AI_GENERATED]").trim()
        : editDesc || undefined;
      const updated = await tripsApi.update(tripId, {
        title: editTitle,
        description: finalDesc,
        startDate: editStartDate || undefined,
        endDate: editEndDate || undefined,
        visibility: editVisibility,
      });
      setTrip((prev) =>
        prev
          ? {
              ...prev,
              title: updated.title,
              description: updated.description,
              startDate: updated.startDate,
              endDate: updated.endDate,
              visibility: updated.visibility,
            }
          : null
      );

      // Save itinerary too if it has unsaved changes
      if (hasUnsavedChanges) {
        await persistItinerary(itineraryDays, { silent: true });
      }

      setIsEditing(false);
      addToast("Trip updated successfully", "success");
    } catch {
      addToast("Failed to update trip details", "error");
    } finally {
      setSaving(false);
    }
  }

  function cancelInlineEdits() {
    if (trip) {
      setEditTitle(trip.title);
      setEditDesc(trip.description || "");
      setEditStartDate(trip.startDate || "");
      setEditEndDate(trip.endDate || "");
      setEditVisibility((trip.visibility || "PRIVATE") as "PRIVATE" | "PUBLIC");
    }
    setIsEditing(false);
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
        {isPrivateTrip ? (
          <>
            <Lock size={40} className="text-muted opacity-50" />
            <p className="text-muted text-center max-w-md">{error}</p>
            {!user?.userId && (
              <div className="flex gap-3">
                <Button
                  variant="primary"
                  onClick={() => router.push(`/login?next=${encodeURIComponent(`/dashboard/trips/${tripId}`)}`)}
                >
                  <ArrowRight size={16} /> Sign In
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => router.push(`/register?next=${encodeURIComponent(`/dashboard/trips/${tripId}`)}`)}
                >
                  <UserPlus size={16} /> Create Account
                </Button>
              </div>
            )}
          </>
        ) : (
          <>
            <p className="text-muted">{error || "Trip not found"}</p>
            <Button variant="secondary" onClick={() => router.push(user?.userId ? "/dashboard" : "/") }>
              <ArrowLeft size={16} /> Back to trips
            </Button>
          </>
        )}
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

  const totalActivities = itineraryDays.reduce((sum, day) => sum + day.activities.length, 0);

  const hasAiMetadata = itineraryDays.some((d) => d.weather || (d.transportRecommendations && d.transportRecommendations.length > 0));
  const isAiTrip = (isFromAi || hasAiMetadata || hasAiTag) && trip?.status === "PLANNED";

  return (
    <div className="space-y-8 pb-12">
      {/* Back link */}
      <Link
        href={user?.userId ? "/dashboard" : "/"}
        className="inline-flex items-center gap-2 text-sm text-muted hover:text-foreground transition-colors"
      >
        <ArrowLeft size={16} /> Back to trips
      </Link>

      {!user?.userId && (
        <GlassCard className="!p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted">
              You are viewing a shared trip in read-only mode. Sign in to join and collaborate.
            </p>
            <Button size="sm" onClick={() => router.push(`/login?next=${encodeURIComponent(`/dashboard/trips/${tripId}`)}`)}>
              Sign in to join
            </Button>
          </div>
        </GlassCard>
      )}

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

      {/* Invitation accept/decline banner */}
      {isInvited && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-blue-300/50 bg-blue-50 dark:bg-blue-900/20 px-5 py-4 flex items-center justify-between gap-4"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-800/40">
              <Mail size={17} className="text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-blue-800 dark:text-blue-200">You&apos;ve been invited!</p>
              <p className="text-xs text-blue-700 dark:text-blue-300">You have been invited to join this trip. Would you like to accept?</p>
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button
              variant="secondary"
              size="sm"
              className="text-xs"
              disabled={decliningInvite}
              onClick={handleDeclineInvite}
            >
              {decliningInvite ? <Loader2 size={14} className="animate-spin" /> : <ThumbsDown size={14} />}
              Decline
            </Button>
            <Button
              variant="primary"
              size="sm"
              className="text-xs"
              disabled={acceptingInvite}
              onClick={handleAcceptInvite}
            >
              {acceptingInvite ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              Accept & Join
            </Button>
          </div>
        </motion.div>
      )}

      {/* ─── Hero Header ──────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn(
          "relative overflow-hidden rounded-[2rem] shadow-[0_40px_90px_-42px_rgba(8,31,54,0.9)] p-6 sm:p-10 transition-all duration-300",
          isAiTrip
            ? (isEditing ? "min-h-[26rem] h-auto flex flex-col justify-end bg-black" : "h-auto min-h-[20rem] md:h-80 flex flex-col justify-end bg-black")
            : "bg-gradient-to-br from-trippy-600 via-trippy-700 to-trippy-800"
        )}
      >
        {/* AI-generated cover as a softly blurred backdrop (fades in when loaded).
            The underlying gradient/bg-black container is the fallback if the
            Pollinations-hosted image 404s, times out, or is rate-limited — the
            onError handlers hide the broken <img> so that shows through cleanly
            instead of a broken-image icon or a permanently blank backdrop. */}
        {trip.coverImageUrl && (
          isAiTrip ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={trip.coverImageUrl}
                alt=""
                aria-hidden
                className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-100 scale-105 blur-[2px]"
                onError={(e) => { e.currentTarget.style.display = "none"; }}
              />
              <div className="pointer-events-none absolute inset-0 bg-black/30 bg-gradient-to-t from-black/80 via-black/20 to-black/10" />
            </>
          ) : (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={trip.coverImageUrl}
                alt=""
                aria-hidden
                className="pointer-events-none absolute inset-0 h-full w-full scale-105 object-cover opacity-0 blur-[3px] transition-opacity duration-1000"
                onLoad={(e) => { e.currentTarget.style.opacity = "0.7"; }}
                onError={(e) => { e.currentTarget.style.display = "none"; }}
              />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-trippy-900/78 via-trippy-800/68 to-trippy-900/85" />
            </>
          )
        )}

        {/* Immersive texture + warm mesh */}
        {!isAiTrip && (
          <>
            <div className="pointer-events-none absolute inset-0 bg-[url('/trippy-landing-background.png')] bg-cover bg-center opacity-[0.14] mix-blend-luminosity" />
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_120%_at_0%_0%,rgba(231,111,81,0.30),transparent_55%)]" />
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/45 to-transparent" />
            <div className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-accent-500/20 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-8 -left-8 h-32 w-32 rounded-full bg-white/8 blur-2xl" />
            <div className="pointer-events-none absolute right-8 bottom-4 opacity-10 lux-float">
              <Plane size={90} className="rotate-12 text-white" />
            </div>
          </>
        )}

        <div className="relative z-10 flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex-1 min-w-0 w-full">
            <div className="flex items-center gap-3 mb-2">
              <Badge variant={statusVariant[trip.status] ?? "default"}>
                {statusLabel[trip.status] ?? trip.status}
              </Badge>
              {trip.visibility === "PUBLIC" ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-0.5 text-[10px] font-medium text-white/70">
                  <Globe size={10} /> Public
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-0.5 text-[10px] font-medium text-white/70">
                  <Lock size={10} /> Private
                </span>
              )}
            </div>

            {isEditing ? (
              <div className="space-y-4 w-full">
                {/* Editable Title */}
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-white/60 block mb-1">Trip Name</label>
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="font-display text-2xl font-black tracking-tight text-white bg-white/10 border border-white/20 rounded-xl px-3 py-1.5 focus:outline-none focus:border-white/45 w-full"
                  />
                </div>
                {/* Editable Description */}
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-white/60 block mb-1">Description</label>
                  <textarea
                    value={editDesc}
                    onChange={(e) => setEditDesc(e.target.value)}
                    className="text-sm text-white bg-white/10 border border-white/20 rounded-xl px-3 py-1.5 focus:outline-none focus:border-white/45 w-full resize-none"
                    rows={2}
                  />
                </div>
                {/* Editable Visibility */}
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-white/60 block mb-1.5">Visibility</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setEditVisibility("PRIVATE")}
                      className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                        editVisibility === "PRIVATE"
                          ? "bg-white text-trippy-600 border-white shadow-sm"
                          : "bg-white/10 border-white/20 text-white/70 hover:bg-white/20 hover:text-white"
                      }`}
                    >
                      <Lock size={12} /> Private
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditVisibility("PUBLIC")}
                      className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                        editVisibility === "PUBLIC"
                          ? "bg-white text-trippy-600 border-white shadow-sm"
                          : "bg-white/10 border-white/20 text-white/70 hover:bg-white/20 hover:text-white"
                      }`}
                    >
                      <Globe size={12} /> Public
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <h1 className="font-display text-3xl sm:text-5xl font-black tracking-tight text-white break-words">
                  {trip.title}
                </h1>
                {cleanDescription(trip.description) && (
                  <p className="mt-2 text-sm text-white/60 max-w-xl hidden sm:block">
                    {cleanDescription(trip.description)}
                  </p>
                )}
              </>
            )}

            {/* Quick stats */}
            <div className="flex flex-wrap gap-x-4 gap-y-2 mt-4 sm:items-center sm:gap-4 sm:mt-5">
              <div className="flex items-center gap-2 text-white/80 text-xs sm:text-sm">
                <MapPin size={14} className="text-accent-400" />
                <span className="font-medium">{trip.destination}</span>
              </div>
              
              {isEditing ? (
                <div className="flex items-center gap-2 text-white/85 bg-white/5 border border-white/10 rounded-xl px-3 py-1.5">
                  <Calendar size={14} className="text-accent-400" />
                  <input
                    type="date"
                    value={editStartDate}
                    onChange={(e) => setEditStartDate(e.target.value)}
                    className="bg-transparent text-xs outline-none text-white w-28 [color-scheme:dark]"
                  />
                  <span className="text-white/40 text-xs">—</span>
                  <input
                    type="date"
                    value={editEndDate}
                    onChange={(e) => setEditEndDate(e.target.value)}
                    className="bg-transparent text-xs outline-none text-white w-28 [color-scheme:dark]"
                  />
                </div>
              ) : (
                trip.startDate && trip.endDate && (
                  <div className="flex items-center gap-2 text-white/80 text-xs sm:text-sm">
                    <Calendar size={14} className="text-accent-400" />
                    <span>
                      {new Date(trip.startDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      {" — "}
                      {new Date(trip.endDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </span>
                    <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-medium text-white/60">
                      {numDays} day{numDays !== 1 ? "s" : ""}
                    </span>
                  </div>
                )
              )}

              <div className="flex items-center gap-2 text-white/80 text-xs sm:text-sm">
                <Users size={14} className="text-accent-400" />
                <span>{trip.participantCount} member{trip.participantCount !== 1 ? "s" : ""}</span>
              </div>
              {totalEstimatedCost > 0 && (
                <div className="flex items-center gap-2 text-white/80 text-xs sm:text-sm">
                  <DollarSign size={14} className="text-accent-400" />
                  <span className="font-medium">~{currencies.find((c) => c.code === currency)?.symbol ?? "$"}{totalEstimatedCost.toFixed(0)} est.</span>
                </div>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2 w-full sm:w-auto shrink-0 mt-3 sm:mt-0">
            {isEditing ? (
              <>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={saveInlineEdits}
                  disabled={saving}
                  className="flex-1 sm:flex-none bg-emerald-600 border-emerald-500 hover:bg-emerald-700 text-white flex items-center justify-center gap-1.5 shadow-sm"
                >
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  Save
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={cancelInlineEdits}
                  disabled={saving}
                  className="flex-1 sm:flex-none bg-white/10 border-white/20 hover:bg-white/20 text-white justify-center"
                >
                  Cancel
                </Button>
              </>
            ) : (
              <>
                {user?.userId && (
                  <Link href={`/dashboard/chat/${trip.tripId}`} className="flex-1 sm:flex-none">
                    <Button variant="secondary" size="sm" className="w-full bg-white/10 border-white/20 text-white hover:bg-white/20 justify-center">
                      <MessageSquare size={14} /> Chat
                    </Button>
                  </Link>
                )}
                {isOwnerOrEditor && (
                  <>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="flex-1 sm:flex-none bg-white/10 border-white/20 text-white hover:bg-white/20 justify-center"
                      onClick={() => {
                        if (isAiTrip) {
                          setEditVisibility((trip.visibility || "PRIVATE") as "PRIVATE" | "PUBLIC");
                          setIsEditing(true);
                        } else {
                          setEditModalOpen(true);
                        }
                      }}
                    >
                      <Edit size={14} /> Edit
                    </Button>
                    <Button variant="danger" size="sm" onClick={handleDelete} className="flex-1 sm:flex-none bg-red-500/80 border-red-400/30 hover:bg-red-500 justify-center">
                      <Trash2 size={14} /> Delete
                    </Button>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </motion.div>

      {/* AI trip stats bar */}
      {isAiTrip && (
        <div className="flex sm:grid sm:grid-cols-3 gap-3 overflow-x-auto pb-4 -mx-4 px-4 sm:mx-0 sm:px-0 sm:pb-0 snap-x hide-scrollbar">
          {[
            {
              icon: <Sparkles size={16} className="text-purple-500" />,
              label: "Activities",
              value: `${totalActivities} planned`,
              bg: "bg-purple-50 border-purple-100",
            },
            {
              icon: <DollarSign size={16} className="text-amber-500" />,
              label: "Budget",
              value: preferences?.budgetTier
                ? preferences.budgetTier.charAt(0) + preferences.budgetTier.slice(1).toLowerCase()
                : "Moderate",
              bg: "bg-amber-50 border-amber-100",
            },
            {
              icon: <Calendar size={16} className="text-accent-500" />,
              label: "Duration",
              value: `${numDays} day${numDays !== 1 ? "s" : ""}`,
              bg: "bg-accent-500/5 border-accent-200",
            },
          ].map((s, i) => (
            <div
              key={i}
              className={`flex items-center gap-3 rounded-xl border px-4 py-3 bg-white hover:shadow-sm transition-all min-w-[180px] sm:min-w-0 snap-center shrink-0 ${s.bg}`}
            >
              <div className="shrink-0">{s.icon}</div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted">
                  {s.label}
                </p>
                <p className="text-sm font-bold text-foreground truncate">
                  {s.value}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ─── Team Section ──────────────────────────────────────────── */}
      {members.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <GlassCard className="!p-0 overflow-hidden">
            <details className="group">
              <summary className="flex items-center justify-between p-4 sm:p-5 cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden">
                <div className="flex items-center gap-2">
                  <Users size={15} className="text-accent-500" />
                  <h3 className="text-sm font-bold text-foreground">Travel Buddies</h3>
                  <span className="text-[10px] text-muted bg-shore-100 px-2 py-0.5 rounded-full">
                    {members.length} member{members.length !== 1 ? "s" : ""}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {isParticipant && (
                    <Button variant="secondary" size="sm" className="text-xs" onClick={(e) => { e.preventDefault(); setInviteOpen(true); }}>
                      <Plus size={12} /> Invite
                    </Button>
                  )}
                  <ChevronDown size={16} className="text-muted transition-transform group-open:rotate-180" />
                </div>
              </summary>
              <div className="flex flex-wrap gap-3 p-4 sm:p-5 pt-0 border-t border-border/50 mt-1">
                {members.map((p) => {
                const name = p.displayName ?? "User";
                const initials = name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .toUpperCase()
                  .slice(0, 2);
                const isOwner = p.role === "OWNER";
                // Correct mutual trips together count (only completed/past trips)
                const isTripCompleted = (t: any) => {
                  if (!t.endDate) return false;
                  return new Date(t.endDate + "T23:59:59").getTime() < Date.now();
                };
                const completedTrips = allTrips.filter(isTripCompleted);
                const tripsCount = completedTrips.filter((t) => {
                  if (t.tripId === tripId) return true; // Current trip if completed
                  // Deterministic simulation for other past trips
                  return p.userId ? (p.userId.charCodeAt(0) + t.tripId.charCodeAt(0)) % 3 === 0 : false;
                }).length;

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
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={p.avatarUrl || generateAvatarUrl(name)} alt={name} className="w-full h-full rounded-full object-cover" />
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
                    <div className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-full mb-2 z-30 w-56 rounded-2xl border border-border bg-white p-4 shadow-2xl opacity-0 scale-95 transition-all duration-200 group-hover/member:opacity-100 group-hover/member:scale-100 group-hover/member:pointer-events-auto after:absolute after:content-[''] after:top-full after:left-0 after:right-0 after:h-3">
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
            </details>
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
          <GlassCard className="!p-0 overflow-hidden">
            <details className="group">
              <summary className="flex items-center justify-between p-4 sm:p-5 cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden">
                <div className="flex items-center gap-2">
                  <Users size={15} className="text-amber-500" />
                  <h3 className="text-sm font-bold text-foreground">Join Requests</h3>
                  <span className="text-[10px] text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                    {pendingRequests.length} pending
                  </span>
                </div>
                <ChevronDown size={16} className="text-muted transition-transform group-open:rotate-180" />
              </summary>
              <div className="flex flex-col gap-3 p-4 sm:p-5 pt-0 border-t border-border/50 mt-1">
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
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={p.avatarUrl || generateAvatarUrl(name)} alt={name} className="w-full h-full rounded-full object-cover" />
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
            </details>
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
          <GlassCard className="!p-0 overflow-hidden">
            <details className="group">
              <summary className="flex items-center justify-between p-4 sm:p-5 cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden">
                <div className="flex items-center gap-2">
                  <Users size={15} className="text-blue-500" />
                  <h3 className="text-sm font-bold text-foreground">Pending Invites</h3>
                  <span className="text-[10px] text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">
                    {pendingInvites.length} invited
                  </span>
                </div>
                <ChevronDown size={16} className="text-muted transition-transform group-open:rotate-180" />
              </summary>
              <div className="flex flex-col gap-3 p-4 sm:p-5 pt-0 border-t border-border/50 mt-1">
                {pendingInvites.map((p) => {
                const name = p.displayName ?? (p.email || "User");
                const initials = name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .toUpperCase()
                  .slice(0, 2);
                const trackingId = p.userId || p.email || p.participantId;
                const processing = processingRequestUserId === trackingId;
                return (
                  <div
                    key={p.participantId}
                    className="flex items-center justify-between gap-3 rounded-xl border border-border bg-white px-3 py-2"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold border-2 bg-blue-50 text-blue-600 border-blue-200">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={p.avatarUrl || generateAvatarUrl(name)} alt={name} className="w-full h-full rounded-full object-cover" />
                      </div>
                      <div className="min-w-0">
                        <span className="block text-xs font-semibold text-foreground truncate max-w-[160px]">{name}</span>
                        {p.email && !p.userId && (
                          <span className="block text-[10px] text-blue-500 truncate max-w-[160px]">{p.email}</span>
                        )}
                        <span className="text-[10px] text-muted">
                          {p.userId ? "Invitation sent — awaiting response" : "Invited by email — no account yet"}
                        </span>
                      </div>
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="text-xs shrink-0"
                      disabled={processing}
                      onClick={() => handleRevokeInvite({ userId: p.userId, email: p.email })}
                    >
                      Revoke
                    </Button>
                  </div>
                );
              })}
              </div>
            </details>
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
            {isOwnerOrEditor && !isAiTrip && (
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
            {/* AI Suggestions — host (trip owner) only */}
            {isOwner && !isAiTrip && (
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
                destination={trip.destination}
                expanded={expandedDays.has(day.dayNumber)}
                onToggle={() => toggleDay(day.dayNumber)}
                onUpdateDay={updateDay}
                currency={currency}
                onCurrencyChange={(c) => { setCurrency(c); setHasUnsavedChanges(true); }}
                onVoteUpdate={handleVoteUpdate}
                isParticipant={isParticipant}
                readOnly={!isParticipant || (isAiTrip && !isEditing)}
                isAiTrip={isAiTrip}
              />
            ))}

            {/* Add day button */}
            {isParticipant && (!isAiTrip || isEditing) && (
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
                ? `You have ${numDays} days to plan. Add days manually${isOwner ? " or let AI create a complete itinerary for you" : ""}.`
                : "Set your trip dates first, then plan your day-by-day adventure here."}
            </p>
            <div className="flex items-center gap-3 mt-5">
              {numDays > 0 && (
                <Button variant="secondary" size="sm" onClick={addDay}>
                  <Plus size={14} /> Add first day
                </Button>
              )}
              {/* AI Suggestions — host (trip owner) only */}
              {isOwner && !isAiTrip && (
                <button
                  onClick={openAI}
                  className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-trippy-600 to-trippy-700 px-4 py-2.5 text-sm font-semibold text-white shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all cursor-pointer"
                >
                  <Sparkles size={14} /> Suggest with AI
                </button>
              )}
            </div>
          </GlassCard>
        )}
      </motion.section>

      {/* AI Itinerary Studio — host (trip owner) only */}
      {isOwner && (
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
          onApply={applySuggestion}
          onRemove={removeSuggestion}
          addedKeys={addedSuggestionKeys}
        />
      )}

      {/* Edit Trip Modal */}
      <AnimatePresence>
        {editModalOpen && trip && (
          <EditTripModal
            trip={{ ...trip, description: cleanDescription(trip.description) }}
            onClose={() => setEditModalOpen(false)}
            onSave={async ({ status, ...updates }) => {
              try {
                const finalUpdates = {
                  ...updates,
                  description: hasAiTag && typeof updates.description === "string"
                    ? ((updates.description || "").trim() + " [AI_GENERATED]").trim()
                    : updates.description,
                };
                await tripsApi.update(tripId, finalUpdates);
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
            onClose={() => setInviteOpen(false)}
            onInvited={() => {
              // Refresh trip data to show new participant
              void refreshTrip();
            }}
            currentUserName={user?.displayName ?? ""}
            invitedParticipants={pendingInvites}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
