"use client";

import {
  MapPin,
  Calendar,
  Users,
  ArrowUpRight,
  Plane,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface TripCardProps {
  title: string;
  destination: string;
  startDate: string;
  endDate: string;
  status: "DRAFT" | "PLANNED" | "ACTIVE" | "COMPLETED" | "CANCELLED";
  participantCount: number;
  coverImageUrl?: string | null;
  onJoin?: () => void;
  joinLoading?: boolean;
  joinRequested?: boolean;
  invited?: boolean;
}

const STATUS_CONFIG: Record<
  string,
  { bg: string; text: string; dot: string; label: string }
> = {
  DRAFT: {
    bg: "bg-shore-200/60",
    text: "text-trippy-500",
    dot: "bg-trippy-400",
    label: "Draft",
  },
  PLANNED: {
    bg: "bg-accent-50",
    text: "text-accent-600",
    dot: "bg-accent-500",
    label: "Planned",
  },
  ACTIVE: {
    bg: "bg-leaf-100",
    text: "text-green-700",
    dot: "bg-green-500",
    label: "Active",
  },
  COMPLETED: {
    bg: "bg-lagoon-100",
    text: "text-teal-700",
    dot: "bg-teal-500",
    label: "Completed",
  },
  CANCELLED: {
    bg: "bg-red-50",
    text: "text-red-600",
    dot: "bg-red-400",
    label: "Cancelled",
  },
};

/** Random placeholder gradients when no cover image */
const PLACEHOLDER_GRADIENTS = [
  "from-trippy-400/30 to-accent-400/20",
  "from-accent-400/25 to-trippy-300/20",
  "from-lagoon-200/50 to-trippy-300/25",
  "from-leaf-200/40 to-lagoon-200/30",
  "from-accent-200/40 to-shore-200/30",
];

function getGradient(title: string) {
  let hash = 0;
  for (let i = 0; i < title.length; i++) {
    hash = title.charCodeAt(i) + ((hash << 5) - hash);
  }
  return PLACEHOLDER_GRADIENTS[
    Math.abs(hash) % PLACEHOLDER_GRADIENTS.length
  ];
}

function formatDateRange(start: string, end: string) {
  if (start === "TBD" && end === "TBD") return "Dates TBD";
  try {
    const opts: Intl.DateTimeFormatOptions = {
      month: "short",
      day: "numeric",
    };
    const s = start !== "TBD" ? new Date(start).toLocaleDateString("en", opts) : "TBD";
    const e = end !== "TBD" ? new Date(end).toLocaleDateString("en", opts) : "TBD";
    return `${s} — ${e}`;
  } catch {
    return `${start} — ${end}`;
  }
}

export default function TripCard({
  title,
  destination,
  startDate,
  endDate,
  status,
  participantCount,
  coverImageUrl,
  onJoin,
  joinLoading,
  joinRequested,
  invited,
}: TripCardProps) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.DRAFT;

  return (
    <div className="group neu neu-interactive relative flex h-full flex-col overflow-hidden rounded-[1.5rem]">
      {/* ── Cover area ────────────────────────────────────── */}
      <div className="relative h-52 overflow-hidden">
        {coverImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={coverImageUrl}
            alt={title}
            className="h-full w-full object-cover transition-transform duration-[900ms] ease-out group-hover:scale-[1.08]"
          />
        ) : (
          <div className={cn("relative h-full w-full bg-gradient-to-br", getGradient(title))}>
            {/* Subtle dotted texture */}
            <div className="absolute inset-0 bg-[radial-gradient(rgba(18,60,105,0.10)_1px,transparent_1px)] bg-[size:16px_16px] opacity-60" />
            <Plane
              size={72}
              className="absolute right-5 bottom-3 text-white/25 rotate-12 transition-transform duration-700 group-hover:translate-x-2 group-hover:-translate-y-2"
            />
          </div>
        )}

        {/* Cinematic gradient wash for legible overlay text */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0f1a17]/82 via-[#0f1a17]/18 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-br from-accent-500/10 via-transparent to-trippy-600/10 opacity-0 transition-opacity duration-500 group-hover:opacity-100" />

        {/* Status pill */}
        <div className="absolute top-4 left-4">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full bg-white/92 px-3 py-1 text-[11px] font-bold shadow-sm backdrop-blur-md",
              cfg.text,
            )}
          >
            <span className={cn("h-1.5 w-1.5 rounded-full", cfg.dot, status === "ACTIVE" && "animate-pulse")} />
            {cfg.label}
          </span>
        </div>

        {/* Hover arrow */}
        <div className="absolute top-4 right-4 flex h-9 w-9 translate-y-1 items-center justify-center rounded-full bg-white/15 text-white opacity-0 backdrop-blur-md transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
          <ArrowUpRight size={16} />
        </div>

        {/* Title + destination over cover */}
        <div className="absolute inset-x-0 bottom-0 p-4">
          <h3 className="text-lg font-extrabold leading-tight text-white drop-shadow-md line-clamp-1">
            {title}
          </h3>
          <div className="mt-1 flex items-center gap-1.5">
            <MapPin size={13} className="shrink-0 text-accent-300" />
            <span className="truncate text-xs font-medium text-white/85 drop-shadow">{destination}</span>
          </div>
        </div>
      </div>

      {/* ── Card body ─────────────────────────────────────── */}
      <div className="flex flex-1 flex-col gap-3 p-4">
        {/* Date + members chips */}
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-shore-100/80 px-2.5 py-1 text-[11px] font-semibold text-foreground/75">
            <Calendar size={12} className="text-accent-500" />
            {formatDateRange(startDate, endDate)}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-shore-100/80 px-2.5 py-1 text-[11px] font-semibold text-foreground/75">
            <Users size={12} className="text-trippy-500" />
            {participantCount}
          </span>
        </div>

        {/* Join / status actions (public trips) */}
        {onJoin && !joinRequested && !invited && (
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onJoin(); }}
            disabled={joinLoading}
            className="mt-auto w-full rounded-xl bg-gradient-to-r from-accent-500 to-accent-600 px-3 py-2.5 text-xs font-bold text-white shadow-[0_14px_28px_-16px_rgba(231,111,81,0.9)] transition-all hover:-translate-y-0.5 hover:shadow-[0_18px_34px_-16px_rgba(231,111,81,0.95)] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {joinLoading ? "Sending request…" : "Join Trip"}
          </button>
        )}
        {joinRequested && (
          <button
            disabled
            className="mt-auto w-full rounded-xl bg-shore-100/80 px-3 py-2.5 text-xs font-bold text-muted cursor-not-allowed border border-border/60"
          >
            Requested to Join
          </button>
        )}
        {invited && (
          <div className="mt-auto w-full rounded-xl bg-accent-50 border border-accent-200 px-3 py-2.5 text-center text-xs font-bold text-accent-700">
            ✉️ Invited — respond in notifications
          </div>
        )}
      </div>
    </div>
  );
}
