"use client";

import { type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  CalendarDays,
  DollarSign,
  MapPin,
  Backpack,
  Compass,
  Route,
  SlidersHorizontal,
  Stamp,
  Globe,
  Utensils,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface TripTicketProps {
  destination: string;
  startDate: string;
  endDate: string;
  filters: string[];
  budget: string;
  visibility: string;
  diet: string;
  pace: string;
  /** Destination + valid dates present — the ticket can be redeemed. */
  ready: boolean;
  onCreate: () => void;
}

const stampIn = {
  initial: { opacity: 0, scale: 1.45, rotate: -7, y: 4 },
  animate: { opacity: 1, scale: 1, rotate: 0, y: 0 },
  exit: { opacity: 0, scale: 0.9, y: -4 },
  transition: { type: "spring" as const, stiffness: 480, damping: 26 },
};

function TicketField({
  icon,
  label,
  value,
  placeholder,
  big = false,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  placeholder: string;
  big?: boolean;
}) {
  return (
    <div className="min-w-0 text-left">
      <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-[#8c978f]">
        <span className="text-[#d5653e]">{icon}</span>
        {label}
      </span>
      <div className={cn("mt-1", big ? "min-h-8" : "min-h-5")}>
        <AnimatePresence mode="wait" initial={false}>
          {value ? (
            <motion.p
              key={value}
              {...stampIn}
              className={cn(
                "truncate font-black text-[#17211f]",
                big ? "font-display text-xl sm:text-2xl" : "text-sm",
              )}
            >
              {value}
            </motion.p>
          ) : (
            <motion.p
              key="placeholder"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className={cn("truncate font-bold text-[#c3cbc2]", big ? "text-xl" : "text-sm")}
            >
              {placeholder}
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function formatTicketDates(startDate: string, endDate: string) {
  const parse = (value: string) => (value ? new Date(`${value}T00:00:00`) : null);
  const start = parse(startDate);
  const end = parse(endDate);
  const fmt = (date: Date) => date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  if (start && end && startDate !== endDate) return `${fmt(start)} → ${fmt(end)}`;
  if (start) return `${fmt(start)} · 1 day`;
  return "";
}

function tripNights(startDate: string, endDate: string) {
  if (!startDate || !endDate) return 0;
  const ms = new Date(`${endDate}T00:00:00`).getTime() - new Date(`${startDate}T00:00:00`).getTime();
  return Math.max(0, Math.round(ms / 86400000));
}

export default function TripTicket({
  destination,
  startDate,
  endDate,
  filters,
  budget,
  visibility,
  diet,
  pace,
  ready,
  onCreate,
}: TripTicketProps) {
  const dateLabel = formatTicketDates(startDate, endDate);
  const nights = tripNights(startDate, endDate);
  const filled = [destination, dateLabel, visibility, budget, pace, diet, filters.length > 0 ? "y" : ""]
    .filter(Boolean).length;
  const progress = Math.round((filled / 7) * 100);

  return (
    <motion.div
      initial={{ opacity: 0, y: 34, rotate: -1.6, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, rotate: -0.6, scale: 1 }}
      exit={{ opacity: 0, y: 24, scale: 0.97 }}
      whileHover={{ rotate: 0, y: -3 }}
      transition={{ type: "spring", stiffness: 260, damping: 26 }}
      className="relative mx-auto mt-9 w-full max-w-3xl"
    >
      <div className="relative flex flex-col overflow-hidden rounded-[1.4rem] border border-white/85 bg-[#fdfaf3] shadow-[0_44px_110px_-52px_rgba(20,47,43,0.95)] sm:flex-row">
        {/* ── Main section ─────────────────────────────────────── */}
        <div className="relative flex-1 p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3 border-b border-dashed border-[#dfe0d2] pb-3">
            <span className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.2em] text-[#2a2018]">
              <span className="grid h-6 w-6 place-items-center rounded-full bg-[#2a2018] text-[#f0b091]">
                <Compass size={12} />
              </span>
              Trippy
            </span>
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#8c978f]">
              Trip pass
            </span>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
            <TicketField
              icon={<MapPin size={11} />}
              label="Destination"
              value={destination}
              placeholder="Somewhere amazing…"
              big
            />
            <TicketField
              icon={<CalendarDays size={11} />}
              label={nights > 0 ? `Dates · ${nights + 1} days` : "Dates"}
              value={dateLabel}
              placeholder="Pick your dates"
              big
            />
          </div>

          <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
            <TicketField icon={<Globe size={11} />} label="Visibility" value={visibility} placeholder="—" />
            <TicketField icon={<DollarSign size={11} />} label="Budget" value={budget} placeholder="—" />
            <TicketField icon={<Route size={11} />} label="Pace" value={pace} placeholder="—" />
            <TicketField icon={<Utensils size={11} />} label="Diet" value={diet} placeholder="—" />
          </div>

          {/* Trip style tags */}
          <AnimatePresence>
            {filters.length > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="mt-4 flex flex-wrap items-center gap-1.5">
                  <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-[0.14em] text-[#8c978f]">
                    <SlidersHorizontal size={10} className="text-[#d5653e]" /> Style
                  </span>
                  <AnimatePresence initial={false}>
                    {filters.map((filter) => (
                      <motion.span
                        key={filter}
                        {...stampIn}
                        className="rounded-full bg-[#2a2018] px-2.5 py-0.5 text-[11px] font-black text-white"
                      >
                        {filter}
                      </motion.span>
                    ))}
                  </AnimatePresence>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Packing progress */}
          <div className="mt-5">
            <div className="relative h-1.5 overflow-visible rounded-full bg-[#ece5d4]">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-[#d5653e] to-[#b95534]"
                animate={{ width: `${Math.max(progress, 4)}%` }}
                transition={{ type: "spring", stiffness: 120, damping: 20 }}
              />
              <motion.span
                className="absolute -top-2 text-[#2a2018]"
                animate={{ left: `calc(${Math.max(progress, 4)}% - 8px)` }}
                transition={{ type: "spring", stiffness: 120, damping: 20 }}
              >
                <Backpack size={13} />
              </motion.span>
            </div>
            <p className="mt-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-[#8c978f]">
              Trip {progress}% packed
            </p>
          </div>

          {/* READY stamp */}
          <AnimatePresence>
            {ready && (
              <motion.div
                initial={{ opacity: 0, scale: 2.2, rotate: 14 }}
                animate={{ opacity: 1, scale: 1, rotate: -12 }}
                exit={{ opacity: 0, scale: 1.4 }}
                transition={{ type: "spring", stiffness: 380, damping: 20 }}
                className="pointer-events-none absolute right-4 top-12 grid h-20 w-20 place-items-center rounded-full border-[3px] border-[#d5653e]/70 text-center sm:right-6"
              >
                <span className="px-1 text-[9px] font-black uppercase leading-tight tracking-[0.14em] text-[#d5653e]/80">
                  Ready to go
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Perforation ──────────────────────────────────────── */}
        <div className="relative hidden w-0 border-l-2 border-dashed border-[#dfe0d2] sm:block">
          <span className="absolute -left-2.5 -top-2.5 h-5 w-5 rounded-full bg-[#f4ead9] shadow-[inset_0_-2px_4px_rgba(20,47,43,0.08)]" />
          <span className="absolute -bottom-2.5 -left-2.5 h-5 w-5 rounded-full bg-[#f4ead9] shadow-[inset_0_2px_4px_rgba(20,47,43,0.08)]" />
        </div>
        <div className="relative block h-0 border-t-2 border-dashed border-[#dfe0d2] sm:hidden" />

        {/* ── Stub ─────────────────────────────────────────────── */}
        <div className="flex flex-col justify-between gap-4 bg-[#fbf6ea] p-5 sm:w-56 sm:p-6">
          <div className="flex items-center justify-between sm:block">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#8c978f]">Trip №</p>
              <p className="mt-0.5 font-display text-lg font-black text-[#17211f]">TRP-001</p>
            </div>
            <div className="sm:mt-3">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#8c978f]">Status</p>
              <p className="mt-0.5 font-display text-lg font-black text-[#17211f]">Dreaming</p>
            </div>
          </div>

          {/* Barcode */}
          <div
            aria-hidden
            className="h-10 w-full rounded-sm opacity-80"
            style={{
              backgroundImage:
                "repeating-linear-gradient(90deg, #2a2018 0px, #2a2018 2px, transparent 2px, transparent 5px, #2a2018 5px, #2a2018 6px, transparent 6px, transparent 11px)",
            }}
          />

          <motion.button
            type="button"
            onClick={onCreate}
            animate={
              ready
                ? {
                    boxShadow: [
                      "0 18px 40px -20px rgba(213,101,62,0.85)",
                      "0 18px 46px -14px rgba(213,101,62,1)",
                      "0 18px 40px -20px rgba(213,101,62,0.85)",
                    ],
                  }
                : { boxShadow: "0 12px 30px -22px rgba(20,47,43,0.6)" }
            }
            transition={ready ? { duration: 1.8, repeat: Infinity, ease: "easeInOut" } : undefined}
            whileHover={ready ? { y: -2, scale: 1.02 } : undefined}
            whileTap={ready ? { scale: 0.98 } : undefined}
            className={cn(
              "group flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-black transition-colors duration-300",
              ready
                ? "cursor-pointer bg-[#d5653e] text-white hover:bg-[#b95534]"
                : "cursor-pointer bg-[#ece5d4] text-[#8c978f] hover:bg-[#e4dbc6]",
            )}
          >
            {ready ? (
              <>
                <Stamp size={15} />
                Create this trip
                <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
              </>
            ) : (
              "Add destination & dates"
            )}
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}
