import type { TripType, BudgetTier } from "@/lib/api";

/**
 * A trip drafted on the public landing page before the user authenticated.
 * Stashed in sessionStorage so it survives the sign-in/sign-up handoff and
 * seeds the internal CreateTripModal on the dashboard.
 */
export interface PendingTrip {
  destination: string;
  startDate: string;
  endDate: string;
  filters: string[];
  budget?: string;
  diet?: string;
  pace?: string;
  travelerType?: string;
  savedAt: number;
}

export interface CreateTripInitialValues {
  title?: string;
  destination?: string;
  startDate?: string;
  endDate?: string;
  tripType?: TripType;
  budgetTier?: BudgetTier;
  visibility?: "PUBLIC" | "PRIVATE";
  preferenceNotes?: string;
}

const STORAGE_KEY = "trippy_pending_trip";
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

export function savePendingTrip(trip: Omit<PendingTrip, "savedAt">) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...trip, savedAt: Date.now() } satisfies PendingTrip),
    );
  } catch {
    // Storage unavailable (private mode/quota) — flow degrades to an empty modal.
  }
}

export function loadPendingTrip(): PendingTrip | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingTrip;
    if (!parsed || typeof parsed.destination !== "string" || !parsed.destination.trim()) {
      return null;
    }
    if (typeof parsed.savedAt !== "number" || Date.now() - parsed.savedAt > MAX_AGE_MS) {
      clearPendingTrip();
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearPendingTrip() {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to clean up if storage is unavailable.
  }
}

/** Landing hero chips → internal TripType enum (Wellness/Mountains have no enum, go to notes). */
const FILTER_TO_TRIP_TYPE: Record<string, TripType> = {
  Beach: "BEACH",
  Adventure: "ADVENTURE",
  City: "CITY",
  Nature: "NATURE",
  Culture: "CULTURE",
};

/** Landing budget labels → internal BudgetTier enum (user_schema.trip_preferences.budget_tier). */
const BUDGET_TO_TIER: Record<string, BudgetTier> = {
  Budget: "ECONOMY",
  Moderate: "MODERATE",
  Premium: "LUXURY",
  Luxury: "LUXURY",
};

const NOTES_MAX_LENGTH = 500;

export function pendingTripToInitialValues(pending: PendingTrip): CreateTripInitialValues {
  const destination = pending.destination.trim();

  const mappedFilter = pending.filters.find((filter) => FILTER_TO_TRIP_TYPE[filter]);
  const tripType = mappedFilter ? FILTER_TO_TRIP_TYPE[mappedFilter] : undefined;
  const extraInterests = pending.filters.filter((filter) => filter !== mappedFilter);

  const budgetTier = pending.budget ? BUDGET_TO_TIER[pending.budget] : undefined;

  // Diet and pace have no dedicated columns yet, so they ride along in notes.
  const noteParts: string[] = [];
  if (extraInterests.length > 0) noteParts.push(`Also into: ${extraInterests.join(", ")}`);
  if (pending.diet) noteParts.push(`Diet: ${pending.diet}`);
  if (pending.pace) noteParts.push(`Pace: ${pending.pace}`);

  return {
    title: buildTitle(destination),
    destination,
    startDate: pending.startDate,
    endDate: pending.endDate || pending.startDate,
    tripType,
    budgetTier,
    preferenceNotes: noteParts.join(" · ").slice(0, NOTES_MAX_LENGTH) || undefined,
  };
}

function buildTitle(destination: string) {
  // Long free-form ideas ("a family adventure in Costa Rica") already read as titles.
  if (destination.length > 40 || /\s(in|to|through|around)\s/i.test(destination)) {
    return capitalize(destination).slice(0, 200);
  }
  return `Trip to ${capitalize(destination)}`.slice(0, 200);
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
