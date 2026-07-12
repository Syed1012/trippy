"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  Calendar,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  Route,
  Search,
  SlidersHorizontal,
  Sparkles,
  Stamp,
  Globe,
  Utensils,
} from "lucide-react";
import AITripBuilderModal, { type AIBuilderRequest } from "@/components/ai/AITripBuilderModal";
import AuthModal from "@/components/auth/AuthModal";
import Logo from "@/components/Logo";
import AmbientBackground from "@/components/layout/AmbientBackground";
import Navbar from "@/components/layout/Navbar";
import TripTicket from "@/components/landing/TripTicket";
import { Button } from "@/components/ui";
import { useAuth } from "@/lib/auth-context";
import { savePendingTrip } from "@/lib/pending-trip";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/lib/routes";

const HERO_IDEAS = [
  "a 7-day food trip through Kyoto",
  "a quiet coastal week in Portugal",
  "a family adventure in Costa Rica",
  "a luxury long weekend in Paris",
  "a remote-work month in Barcelona",
];

const TRIP_TYPE_FILTERS = ["Beach", "Adventure", "City", "Nature", "Culture", "Wellness"];

const NO_PREFERENCE_LABEL = "No preference";

const BUDGET_OPTIONS = [NO_PREFERENCE_LABEL, "Budget", "Moderate", "Premium", "Luxury"];

const VISIBILITY_OPTIONS = ["Public", "Private"];

const DIET_OPTIONS = [NO_PREFERENCE_LABEL, "Vegetarian", "Vegan", "Halal", "Jain"];

const PACE_OPTIONS = [NO_PREFERENCE_LABEL, "Balanced pace", "Relaxed", "Packed"];

const DEFAULT_PEOPLE = 2;
const DEFAULT_BUDGET = "";

const revealContainer = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.08 },
  },
};

const revealItem = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.58, ease: "easeOut" as const },
  },
};

function useTypingEffect(words: string[], typingSpeed = 62, pause = 1500) {
  const [text, setText] = useState("");
  const [wordIndex, setWordIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (words.length === 0) return;

    const current = words[wordIndex] ?? "";
    const delay = !isDeleting && text === current ? pause : isDeleting ? typingSpeed / 2 : typingSpeed;
    const timeout = setTimeout(() => {
      if (!isDeleting && text === current) {
        setIsDeleting(true);
        return;
      }

      if (isDeleting && text === "") {
        setIsDeleting(false);
        setWordIndex((prev) => (prev + 1) % words.length);
        return;
      }

      setText(isDeleting ? current.slice(0, text.length - 1) : current.slice(0, text.length + 1));
    }, delay);

    return () => clearTimeout(timeout);
  }, [text, wordIndex, isDeleting, words, typingSpeed, pause]);

  return text;
}

export default function LandingPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const requestIdRef = useRef(0);
  const typedIdea = useTypingEffect(HERO_IDEAS);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [tripVisibility, setTripVisibility] = useState("");
  const [heroBudget, setHeroBudget] = useState(DEFAULT_BUDGET);
  const [dietPreference, setDietPreference] = useState("");
  const [pacePreference, setPacePreference] = useState("");
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [dateError, setDateError] = useState("");
  const [showAIBuilder, setShowAIBuilder] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [aiBuilderRequest, setAiBuilderRequest] = useState<AIBuilderRequest | undefined>(undefined);

  const hasTicketData = Boolean(
    searchQuery.trim() ||
      startDate ||
      activeFilters.length > 0 ||
      heroBudget ||
      tripVisibility ||
      dietPreference ||
      pacePreference,
  );

  const ticketReady = Boolean(
    searchQuery.trim() &&
      startDate &&
      !isPastDateValue(startDate) &&
      !isPastDateValue(endDate || startDate),
  );

  const stashPendingTrip = () => {
    savePendingTrip({
      destination: searchQuery.trim(),
      startDate,
      endDate: endDate || startDate,
      filters: activeFilters,
      budget: heroBudget || undefined,
      visibility: tripVisibility || undefined,
      diet: dietPreference || undefined,
      pace: pacePreference || undefined,
    });
  };

  const startCreateTripFlow = () => {
    if (!startDate) {
      setDateError("Select a start date to create your trip.");
      return;
    }
    if (isPastDateValue(startDate) || isPastDateValue(endDate || startDate)) {
      setDateError("Please choose today or a future date.");
      return;
    }
    if (!searchQuery.trim()) {
      setDateError("Enter a destination to create your trip.");
      return;
    }

    setDateError("");
    stashPendingTrip();

    if (isAuthenticated) {
      router.push(ROUTES.dashboard);
    } else {
      setShowAuthModal(true);
    }
  };

  const handleAuthSuccess = () => {
    // The pending trip is already stashed; the dashboard picks it up on mount.
    setShowAuthModal(false);
    router.push(ROUTES.dashboard);
  };

  const nextRequestId = () => {
    requestIdRef.current += 1;
    return requestIdRef.current;
  };

  const openAIBuilder = ({
    city = searchQuery.trim(),
    start = startDate,
    end = endDate,
    people = DEFAULT_PEOPLE,
    budget = heroBudget,
    filters = activeFilters,
    diet = dietPreference,
    preferences = pacePreference,
    autoGenerate = false,
  }: {
    city?: string;
    start?: string;
    end?: string;
    people?: number;
    budget?: string;
    filters?: string[];
    diet?: string;
    preferences?: string;
    autoGenerate?: boolean;
  } = {}) => {
    const trimmedCity = city.trim();

    if (!start) {
      setDateError("Select a start date to plan a one-day trip.");
      return;
    }

    const normalizedEnd = end || start;

    if (isPastDateValue(start) || isPastDateValue(normalizedEnd)) {
      setDateError("Please choose today or a future date.");
      return;
    }

    if (!trimmedCity) {
      setDateError("Enter a destination to plan your trip.");
      return;
    }

    setDateError("");
    setAiBuilderRequest({
      requestId: nextRequestId(),
      city: trimmedCity,
      startDate: start,
      endDate: normalizedEnd,
      people,
      budget: budget || undefined,
      filters,
      diet: diet || undefined,
      preferences: preferences || undefined,
      autoGenerate,
    });
    setShowAIBuilder(true);
  };

  const toggleFilter = (filter: string) => {
    setActiveFilters((prev) =>
      prev.includes(filter) ? prev.filter((item) => item !== filter) : [...prev, filter],
    );
  };

  const handleStartDateChange = (value: string) => {
    setDateError("");
    setStartDate(value);
  };

  const handleEndDateChange = (value: string) => {
    setDateError("");
    setEndDate(value);
  };

  return (
    <div className="relative isolate min-h-screen overflow-x-hidden bg-[#f8efe1] text-[#18211f]">
      <AmbientBackground />

      {isAuthenticated ? (
        <Navbar variant="landing" />
      ) : (
        <header className="sticky top-0 z-50 border-b border-white/30 bg-white/18 px-4 shadow-[0_1px_0_rgba(20,47,43,0.04)] backdrop-blur-2xl lg:px-8">
          <div className="mx-auto flex h-16 max-w-7xl items-center justify-between">
            <Link href={ROUTES.home} aria-label="Trippy home">
              <Logo size="md" />
            </Link>

            <div className="flex items-center gap-2">
              <Link href={ROUTES.login}>
                <Button
                  size="sm"
                  className="!rounded-xl !border-white/75 !bg-white/62 px-4 !text-[#17312d] shadow-[0_14px_34px_-24px_rgba(20,47,43,0.86)] backdrop-blur-xl hover:!border-white hover:!bg-white/82"
                >
                  Log in
                </Button>
              </Link>
            </div>
          </div>
        </header>
      )}

      <main className="relative z-10">
        <section className="relative isolate overflow-hidden">
          <div className="relative mx-auto flex min-h-[calc(100svh-4rem)] max-w-7xl flex-col justify-center px-4 py-14 lg:px-8 lg:py-16">
            <motion.div
              variants={revealContainer}
              initial="hidden"
              animate="visible"
              className="mx-auto w-full max-w-6xl text-center"
            >
              <motion.h1
                variants={revealItem}
                className="mx-auto max-w-5xl font-display text-balance text-5xl font-black leading-tight text-[#17211f] sm:text-6xl lg:text-7xl"
              >
                Where are you going next?
              </motion.h1>



              <motion.form
                variants={revealItem}
                onSubmit={(event) => {
                  event.preventDefault();
                  startCreateTripFlow();
                }}
                className="relative z-30 mx-auto mt-8 w-full max-w-5xl rounded-[1.35rem] border border-white/80 bg-white/78 p-2.5 shadow-[0_34px_96px_-58px_rgba(20,47,43,0.82)] backdrop-blur-xl"
              >
                <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_250px]">
                  <label
                    className={cn(
                      "flex min-h-16 items-center gap-3 rounded-[1.05rem] border bg-[#fbf7ee]/92 px-4 text-left transition-all duration-200",
                      focusedField === "destination"
                        ? "border-[#d5653e] bg-white shadow-[0_0_0_4px_rgba(213,101,62,0.12),0_16px_30px_-24px_rgba(20,47,43,0.55)]"
                        : "border-transparent hover:border-[#cbd7cb] hover:bg-white/90",
                    )}
                  >
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white text-[#d5653e] shadow-[inset_0_0_0_1px_rgba(213,101,62,0.16),0_8px_18px_-15px_rgba(20,47,43,0.7)]">
                      <Search size={17} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs font-black uppercase text-[#6f7a73]">Destination / idea</span>
                      <input
                        value={searchQuery}
                        onFocus={() => setFocusedField("destination")}
                        onBlur={() => setFocusedField(null)}
                        onChange={(event) => setSearchQuery(event.target.value)}
                        placeholder={typedIdea || "Two weeks in Japan with great food"}
                        className="mt-1 w-full bg-transparent text-base font-semibold text-[#17211f] outline-none placeholder:text-[#8c978f]"
                      />
                    </span>
                  </label>

                  <DateRangePicker
                    startDate={startDate}
                    endDate={endDate}
                    hasError={Boolean(dateError)}
                    onStartDateChange={handleStartDateChange}
                    onEndDateChange={handleEndDateChange}
                  />

                </div>

                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <Button
                    type="submit"
                    size="lg"
                    className="group cta-sheen relative min-h-16 overflow-hidden !rounded-[1.05rem] !border-transparent !bg-[linear-gradient(180deg,#e58157_0%,#d5653e_52%,#bd5537_100%)] px-5 !text-white ring-1 ring-inset ring-white/15 shadow-[inset_0_1px_0_rgba(255,255,255,0.3),0_2px_5px_-1px_rgba(122,58,34,0.28),0_18px_36px_-20px_rgba(191,85,55,0.9)] transition-all duration-300 hover:-translate-y-0.5 hover:brightness-[1.05] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.38),0_26px_50px_-22px_rgba(213,101,62,0.98)] active:translate-y-0 active:brightness-100"
                  >
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/15 text-white ring-1 ring-inset ring-white/20">
                      <Stamp size={15} />
                    </span>
                    <span className="flex min-w-0 flex-col items-start text-left leading-tight">
                      <span>Create this trip</span>
                      <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/80">
                        You build it · AI suggests
                      </span>
                    </span>
                    <ArrowRight size={16} className="ml-1 shrink-0 transition-transform duration-300 group-hover:translate-x-0.5" />
                  </Button>
                  <Button
                    type="button"
                    size="lg"
                    onClick={() => openAIBuilder({ autoGenerate: true })}
                    className="group cta-sheen relative min-h-16 overflow-hidden !rounded-[1.05rem] !border-transparent !bg-[linear-gradient(180deg,#3a2b1e_0%,#271c12_55%,#180f09_100%)] px-5 !text-white ring-1 ring-inset ring-[#f0b091]/30 shadow-[inset_0_1px_0_rgba(255,224,196,0.16),0_18px_36px_-20px_rgba(24,15,9,0.92),0_0_28px_-10px_rgba(240,176,145,0.5)] transition-all duration-300 hover:-translate-y-0.5 hover:brightness-[1.08] hover:shadow-[inset_0_1px_0_rgba(255,224,196,0.24),0_26px_50px_-22px_rgba(24,15,9,0.95),0_0_36px_-8px_rgba(240,176,145,0.62)] active:translate-y-0 active:brightness-100"
                  >
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#f0b091]/15 text-[#f7c9a8] ring-1 ring-inset ring-[#f0b091]/25">
                      <Sparkles size={15} className="transition-transform duration-300 group-hover:rotate-[18deg] group-hover:scale-110" />
                    </span>
                    <span className="flex min-w-0 flex-col items-start text-left leading-tight">
                      <span>Let AI plan it all</span>
                      <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/65">
                        Sit back · full itinerary
                      </span>
                    </span>
                    <ArrowRight size={16} className="ml-1 shrink-0 transition-transform duration-300 group-hover:translate-x-0.5" />
                  </Button>
                </div>
                {dateError && (
                  <p className="px-2 pt-2 text-left text-xs font-bold text-[#b95534]">
                    {dateError}
                  </p>
                )}
              </motion.form>

              <motion.div
                variants={revealItem}
                className="relative z-10 mx-auto mt-3 flex w-fit max-w-full flex-wrap items-center justify-center gap-2 rounded-[1.35rem] border border-white/60 bg-white/28 px-3 py-2 text-left shadow-[0_18px_54px_-42px_rgba(20,47,43,0.86)] backdrop-blur-2xl sm:rounded-full"
              >
                <PlannerMultiGroup
                  icon={<SlidersHorizontal size={12} />}
                  label="Trip"
                  values={activeFilters}
                  options={TRIP_TYPE_FILTERS}
                  onToggle={toggleFilter}
                />
                <PlannerChoiceGroup
                  icon={<DollarSign size={12} />}
                  label="Budget"
                  value={heroBudget}
                  selected={Boolean(heroBudget)}
                  options={BUDGET_OPTIONS}
                  onChange={setHeroBudget}
                />
                <PlannerChoiceGroup
                  icon={<Globe size={12} />}
                  label="Visibility"
                  value={tripVisibility}
                  selected={Boolean(tripVisibility)}
                  options={[NO_PREFERENCE_LABEL, ...VISIBILITY_OPTIONS]}
                  onChange={setTripVisibility}
                />
                <PlannerChoiceGroup
                  icon={<Utensils size={12} />}
                  label="Diet"
                  value={dietPreference}
                  selected={Boolean(dietPreference)}
                  options={DIET_OPTIONS}
                  onChange={setDietPreference}
                />
                <PlannerChoiceGroup
                  icon={<Route size={12} />}
                  label="Pace"
                  value={pacePreference}
                  selected={Boolean(pacePreference)}
                  options={PACE_OPTIONS}
                  onChange={setPacePreference}
                />
              </motion.div>

              {/* Live trip ticket — assembles as the hero form is filled */}
              <AnimatePresence>
                {hasTicketData && (
                  <TripTicket
                    destination={searchQuery.trim()}
                    startDate={startDate}
                    endDate={endDate || startDate}
                    filters={activeFilters}
                    budget={heroBudget}
                    visibility={tripVisibility}
                    diet={dietPreference}
                    pace={pacePreference}
                    ready={ticketReady}
                    onCreate={startCreateTripFlow}
                  />
                )}
              </AnimatePresence>

            </motion.div>
          </div>
        </section>

      </main>
      <AITripBuilderModal
        open={showAIBuilder}
        onClose={() => setShowAIBuilder(false)}
        initialRequest={aiBuilderRequest}
      />
      <AuthModal
        open={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onSuccess={handleAuthSuccess}
        destination={searchQuery.trim() || undefined}
      />
    </div>
  );
}

function PlannerMultiGroup({
  icon,
  label,
  values,
  options,
  onToggle,
}: {
  icon: ReactNode;
  label: string;
  values: string[];
  options: string[];
  onToggle: (value: string) => void;
}) {
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const summary =
    values.length === 0
      ? label
      : values.length <= 2
        ? values.join(", ")
        : `${values.slice(0, 2).join(", ")} +${values.length - 2}`;
  const hasSelection = values.length > 0;

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!dropdownRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const clearSelections = () => {
    values.forEach(onToggle);
  };

  const selectNoPreference = () => {
    clearSelections();
    setOpen(false);
  };

  const selectOption = (option: string) => {
    onToggle(option);
    setOpen(false);
  };

  return (
    <div ref={dropdownRef} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((current) => !current)}
        className={cn(
          "group inline-flex h-9 max-w-full items-center gap-2 rounded-full border px-2.5 pr-2 text-left text-xs font-black shadow-[0_12px_28px_-22px_rgba(20,47,43,0.9)] transition-all duration-200",
          open
            ? "border-[#d5653e] bg-white text-[#17211f] shadow-[0_0_0_3px_rgba(213,101,62,0.1),0_16px_28px_-22px_rgba(20,47,43,0.9)]"
            : hasSelection
              ? "border-[#2a2018] bg-[#2a2018] text-white hover:-translate-y-0.5 hover:bg-[#3a2b1e]"
              : "border-[#d8e0d3] bg-[linear-gradient(180deg,#fffdf8_0%,#f5efe4_100%)] text-[#53635d] hover:-translate-y-0.5 hover:border-[#c5d0c3] hover:bg-white",
        )}
      >
        <span
          className={cn(
            "grid h-6 w-6 shrink-0 place-items-center rounded-full shadow-[inset_0_0_0_1px_rgba(213,101,62,0.14)] transition-colors",
            hasSelection ? "bg-white/12 text-[#f0b091]" : "bg-white text-[#d5653e]",
          )}
        >
          {icon}
        </span>
        <span
          className={cn(
            "min-w-0 max-w-[10.5rem] truncate",
            hasSelection ? "text-white" : "text-[#6f7a73]",
          )}
        >
          {summary}
        </span>
        <ChevronDown
          size={13}
          className={cn("shrink-0 transition-transform", hasSelection ? "text-white/62" : "text-[#7b8881]", open && "rotate-180")}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="listbox"
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.16, ease: "easeOut" }}
            className="absolute left-0 top-full z-50 mt-2 w-52 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-white/80 bg-white/95 p-1.5 shadow-[0_28px_72px_-42px_rgba(20,47,43,0.9)] backdrop-blur-xl"
          >
            <div className="grid gap-1">
              <button
                type="button"
                role="option"
                aria-selected={!hasSelection}
                onClick={selectNoPreference}
                className={cn(
                  "flex items-center justify-between gap-3 rounded-lg px-2.5 py-1.5 text-left text-xs font-bold transition-colors",
                  !hasSelection ? "bg-[#2a2018] text-white" : "text-[#53635d] hover:bg-[#fbf7ee] hover:text-[#b95534]",
                )}
              >
                <span>{NO_PREFERENCE_LABEL}</span>
                {!hasSelection && <Check size={13} className="text-[#f0b091]" />}
              </button>
              {options.map((option) => {
                const active = values.includes(option);
                return (
                  <button
                    key={option}
                    type="button"
                    role="option"
                    aria-selected={active}
                    onClick={() => selectOption(option)}
                    className={cn(
                      "flex items-center justify-between gap-3 rounded-lg px-2.5 py-1.5 text-left text-xs font-bold transition-colors",
                      active ? "bg-[#2a2018] text-white" : "text-[#53635d] hover:bg-[#fbf7ee] hover:text-[#b95534]",
                    )}
                  >
                    <span>{option}</span>
                    {active && <Check size={13} className="text-[#f0b091]" />}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function PlannerChoiceGroup({
  icon,
  label,
  value,
  selected,
  options,
  onChange,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  selected: boolean;
  options: string[];
  onChange: (value: string) => void;
}) {
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!dropdownRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const selectOption = (option: string) => {
    onChange(option === NO_PREFERENCE_LABEL ? "" : option);
    setOpen(false);
  };

  return (
    <div ref={dropdownRef} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((current) => !current)}
        className={cn(
          "group inline-flex h-9 max-w-full items-center gap-2 rounded-full border px-2.5 pr-2 text-left text-xs font-black shadow-[0_12px_28px_-22px_rgba(20,47,43,0.9)] transition-all duration-200",
          open
            ? "border-[#d5653e] bg-white text-[#17211f] shadow-[0_0_0_3px_rgba(213,101,62,0.1),0_16px_28px_-22px_rgba(20,47,43,0.9)]"
            : selected
              ? "border-[#2a2018] bg-[#2a2018] text-white hover:-translate-y-0.5 hover:bg-[#3a2b1e]"
              : "border-[#d8e0d3] bg-[linear-gradient(180deg,#fffdf8_0%,#f5efe4_100%)] text-[#53635d] hover:-translate-y-0.5 hover:border-[#c5d0c3] hover:bg-white",
        )}
      >
        <span
          className={cn(
            "grid h-6 w-6 shrink-0 place-items-center rounded-full shadow-[inset_0_0_0_1px_rgba(213,101,62,0.14)] transition-colors",
            selected ? "bg-white/12 text-[#f0b091]" : "bg-white text-[#d5653e]",
          )}
        >
          {icon}
        </span>
        <span
          className={cn(
            "min-w-0 max-w-[10.5rem] truncate",
            selected ? "text-white" : "text-[#6f7a73]",
          )}
        >
          {selected ? value : label}
        </span>
        <ChevronDown
          size={13}
          className={cn("shrink-0 transition-transform", selected ? "text-white/62" : "text-[#7b8881]", open && "rotate-180")}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="listbox"
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.16, ease: "easeOut" }}
            className="absolute left-0 top-full z-50 mt-2 w-44 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-white/80 bg-white/95 p-1.5 shadow-[0_28px_72px_-42px_rgba(20,47,43,0.9)] backdrop-blur-xl"
          >
            <div className="grid gap-1">
              {options.map((option) => {
                const active = option === NO_PREFERENCE_LABEL ? !value : option === value;
                return (
                  <button
                    key={option}
                    type="button"
                    role="option"
                    aria-selected={active}
                    onClick={() => selectOption(option)}
                    className={cn(
                      "flex items-center justify-between gap-3 rounded-lg px-2.5 py-1.5 text-left text-xs font-bold transition-colors",
                      active ? "bg-[#2a2018] text-white" : "text-[#53635d] hover:bg-[#fbf7ee] hover:text-[#b95534]",
                    )}
                  >
                    <span>{option}</span>
                    {active && <Check size={13} className="text-[#f0b091]" />}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function DateRangePicker({
  startDate,
  endDate,
  hasError = false,
  onStartDateChange,
  onEndDateChange,
}: {
  startDate: string;
  endDate: string;
  hasError?: boolean;
  onStartDateChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
}) {
  const pickerRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const selected = parseLocalDate(startDate);
    return selected ?? new Date();
  });

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!pickerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  const start = parseLocalDate(startDate);
  const end = parseLocalDate(endDate);
  const today = startOfToday();
  const monthStart = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1);
  const days = buildCalendarDays(monthStart);
  const rangeLabel = formatDateRangeLabel(startDate, endDate);

  useEffect(() => {
    if (isPastDateValue(startDate)) onStartDateChange("");
    if (isPastDateValue(endDate)) onEndDateChange("");
  }, [endDate, onEndDateChange, onStartDateChange, startDate]);

  const selectDate = (date: Date) => {
    if (isPastDate(date)) return;

    const selected = toDateInputValue(date);

    if (!start || end || date < start) {
      onStartDateChange(selected);
      onEndDateChange("");
      return;
    }

    onEndDateChange(selected);
    setOpen(false);
  };

  const clearDates = () => {
    onStartDateChange("");
    onEndDateChange("");
  };

  return (
    <div ref={pickerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className={cn(
          "flex min-h-16 w-full items-center gap-3 rounded-[1.05rem] border bg-[#fbf7ee]/92 px-4 text-left transition-all duration-200 focus-visible:focus-ring",
          open
            ? "border-[#d5653e] bg-white shadow-[0_0_0_4px_rgba(213,101,62,0.12),0_16px_30px_-24px_rgba(20,47,43,0.55)]"
            : hasError
              ? "border-[#d5653e] bg-white shadow-[0_0_0_4px_rgba(213,101,62,0.1)]"
            : "border-transparent hover:border-[#cbd7cb] hover:bg-white/90",
        )}
      >
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white text-[#d5653e] shadow-[inset_0_0_0_1px_rgba(213,101,62,0.16),0_8px_18px_-15px_rgba(20,47,43,0.7)]">
          <Calendar size={17} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-xs font-black uppercase text-[#6f7a73]">Dates</span>
          <span className={cn("mt-1 block truncate text-sm font-black", rangeLabel ? "text-[#17211f]" : "text-[#8c978f]")}>
            {rangeLabel || "Add dates"}
          </span>
        </span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.16, ease: "easeOut" }}
            className="absolute left-0 top-full z-[120] mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-lg border border-[#cbd7cb] bg-white p-4 text-left shadow-2xl"
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setCalendarMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))}
                disabled={calendarMonth.getFullYear() === today.getFullYear() && calendarMonth.getMonth() === today.getMonth()}
                className="grid h-9 w-9 place-items-center rounded-lg border border-[#d6ded4] bg-[#fbf7ee] text-[#2a2018] hover:border-[#d5653e] disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:border-[#d6ded4]"
                aria-label="Previous month"
              >
                <ChevronLeft size={17} />
              </button>
              <div className="text-center">
                <p className="text-sm font-black text-[#17211f]">
                  {monthStart.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
                </p>
                <p className="mt-0.5 text-xs font-semibold text-[#6f7a73]">
                  {start && !end ? "One-day trip selected" : "Select a start date"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCalendarMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))}
                className="grid h-9 w-9 place-items-center rounded-lg border border-[#d6ded4] bg-[#fbf7ee] text-[#2a2018] hover:border-[#d5653e]"
                aria-label="Next month"
              >
                <ChevronRight size={17} />
              </button>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center">
              {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => (
                <div key={day} className="py-2 text-[11px] font-black uppercase text-[#7b827d]">
                  {day}
                </div>
              ))}

              {days.map((date, index) => {
                if (!date) return <div key={`empty-${index}`} className="h-10" />;

                const isStart = Boolean(start && sameDay(date, start));
                const isEnd = Boolean(end && sameDay(date, end));
                const isBetween = Boolean(start && end && date > start && date < end);
                const isPast = isPastDate(date);

                return (
                  <button
                    key={toDateInputValue(date)}
                    type="button"
                    onClick={() => selectDate(date)}
                    disabled={isPast}
                    className={cn(
                      "grid h-10 place-items-center rounded-lg text-sm font-bold transition-all",
                      isPast
                        ? "cursor-not-allowed bg-transparent text-[#b8beb9]"
                        : isStart || isEnd
                        ? "bg-[#2a2018] text-white"
                        : isBetween
                          ? "bg-[#f2e7d9] text-[#2a2018]"
                          : "text-[#17211f] hover:bg-[#fbf1e8] hover:text-[#b95534]",
                    )}
                  >
                    {date.getDate()}
                  </button>
                );
              })}
            </div>

            <div className="mt-4 flex items-center justify-between border-t border-[#e1e8de] pt-4">
              <button
                type="button"
                onClick={clearDates}
                className="text-sm font-bold text-[#6f7a73] transition-colors hover:text-[#b95534]"
              >
                Clear
              </button>
              <Button type="button" size="sm" className="rounded-lg bg-[#2a2018] text-white hover:border-[#2a2018] hover:bg-[#3a2b1e]" onClick={() => setOpen(false)}>
                Done
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function parseLocalDate(value: string) {
  if (!value) return null;
  return new Date(`${value}T00:00:00`);
}

function startOfToday() {
  const today = new Date();
  return new Date(today.getFullYear(), today.getMonth(), today.getDate());
}

function isPastDate(date: Date) {
  return date < startOfToday();
}

function isPastDateValue(value?: string) {
  const date = parseLocalDate(value ?? "");
  return Boolean(date && isPastDate(date));
}

function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDateRangeLabel(startDate: string, endDate: string) {
  const start = parseLocalDate(startDate);
  const end = parseLocalDate(endDate);
  const format = (date: Date) => date.toLocaleDateString(undefined, { month: "short", day: "numeric" });

  if (start && end) return `${format(start)} - ${format(end)}`;
  if (start) return `${format(start)} · 1 day`;
  return "";
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function buildCalendarDays(monthStart: Date) {
  const days: Array<Date | null> = [];
  const year = monthStart.getFullYear();
  const month = monthStart.getMonth();
  const firstDay = monthStart.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  for (let index = 0; index < firstDay; index += 1) {
    days.push(null);
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    days.push(new Date(year, month, day));
  }

  return days;
}
