"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import TripFullScreenView from "@/components/ai/TripFullScreenView";
import {
  itineraryApi,
  preferencesApi,
  tripsApi,
  hasTripPreferences,
  ensureTripCoverImage,
  type BudgetTier,
  type CreateTripRequest,
  type TripPreferenceInput,
  type TripType,
  type UpdateItineraryRequest,
  type WeatherSummary,
  type TransportRecommendation,
} from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { ROUTES } from "@/lib/routes";
import { useToast } from "@/lib/toast";
import { tripSlug } from "@/lib/utils";
import { loadAiTripRouteState, updateAiTripRouteState } from "@/lib/ai-trip-route-state";

interface AiItineraryDay {
  dayNumber: number;
  date?: string;
  title: string;
  weather?: WeatherSummary;
  transportRecommendations?: TransportRecommendation[];
  activities: {
    time?: string;
    title: string;
    description?: string;
    location?: string;
    estimatedCost?: string;
    category?: string;
    tips?: string;
  }[];
}

interface GeneratedTrip {
  title: string;
  destination: string;
  duration: string;
  budget: string;
  groupSize: string;
  rating: number;
  highlights: string[];
  reason: string;
  bestTimeToVisit: string;
  image: string;
  googleMapsUrl?: string;
  aiItinerary?: AiItineraryDay[];
}

interface AiTripPageState {
  trip: GeneratedTrip;
  userPrompt?: string;
  userDates?: { start: string; end?: string };
  preferenceContext?: {
    selectedFilters?: string[];
    budget?: string;
    diet?: string;
    preferences?: string;
    customPreference?: string;
  };
  savedTripId?: string;
}

function offsetDate(baseDate: string, days: number): string {
  const date = new Date(baseDate);
  date.setDate(date.getDate() + days);
  return date.toISOString().split("T")[0];
}

function parseActivityTime(time?: string): { startTime?: string; endTime?: string } {
  if (!time) return {};
  const parts = time.split("-").map((s) => s.trim());
  const start = parts[0];
  const end = parts[1];
  const isValid = (t: string) => /^\d{1,2}:\d{2}$/.test(t);
  return {
    startTime: isValid(start) ? start : undefined,
    endTime: isValid(end) ? end : undefined,
  };
}

function mapAiCategory(category?: string): string {
  if (!category) return "OTHER";
  const normalized = category.toUpperCase();
  switch (normalized) {
    case "CULTURE":
      return "SIGHTSEEING";
    case "FOOD":
      return "FOOD";
    case "SIGHTSEEING":
      return "SIGHTSEEING";
    case "TRANSPORT":
      return "TRANSPORT";
    case "SHOPPING":
      return "SHOPPING";
    case "NATURE":
    case "WELLNESS":
    case "NIGHTLIFE":
    case "ADVENTURE":
      return "ACTIVITY";
    default:
      return "OTHER";
  }
}

function inferTripType(filters: string[]): TripType | undefined {
  const priority: TripType[] = ["BEACH", "MOUNTAIN", "CITY", "NATURE", "ADVENTURE", "CULTURE"];
  const upper = filters.map((f) => f.toUpperCase());
  for (const type of priority) {
    if (upper.includes(type)) return type;
  }
  return undefined;
}

function mapBudgetToTier(budget?: string): BudgetTier | undefined {
  if (!budget) return undefined;
  const lower = budget.toLowerCase();
  if (lower.includes("luxury") || lower.includes("high")) return "LUXURY";
  if (lower.includes("budget") || lower.includes("cheap") || lower.includes("economy")) return "ECONOMY";
  if (lower.includes("moderate") || lower.includes("mid")) return "MODERATE";
  return undefined;
}

function AiTripPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated } = useAuth();
  const { addToast } = useToast();

  const sid = searchParams.get("sid") || "";
  const [state, setState] = useState<AiTripPageState | null>(null);
  const [loadError, setLoadError] = useState("");
  const [saveVisibility, setSaveVisibility] = useState<"PRIVATE" | "PUBLIC">("PRIVATE");
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const handleVisibilityChange = async (visibility: "PRIVATE" | "PUBLIC") => {
    setSaveVisibility(visibility);
    if (state?.savedTripId) {
      try {
        await tripsApi.update(state.savedTripId, { visibility });
        addToast(`Trip is now ${visibility.toLowerCase()}!`, "success");
      } catch (err) {
        addToast("Failed to update visibility.", "error");
      }
    }
  };

  useEffect(() => {
    if (!sid) {
      setLoadError("Missing trip URL state. Please generate a trip again.");
      return;
    }

    const loaded = loadAiTripRouteState<AiTripPageState>(sid);
    if (!loaded?.trip) {
      setLoadError("This AI trip URL has expired. Please generate it again.");
      return;
    }

    setState(loaded);
  }, [sid]);

  const canSave = useMemo(() => Boolean(state?.userDates?.start), [state]);

  async function handleSave(trip: GeneratedTrip) {
    if (!state) return;

    if (!isAuthenticated) {
      addToast("Please log in to save your AI trip.", "error");
      router.push(ROUTES.login);
      return;
    }

    if (!canSave || !state.userDates?.start) {
      setSaveError("Please select travel dates before saving.");
      return;
    }

    const startDate = state.userDates.start;
    const endDate = state.userDates.end || state.userDates.start;

    setIsSaving(true);
    setSaveError("");

    try {
      let tripId = state.savedTripId;
      let title = trip.title;

      if (tripId) {
        const updatePayload: Partial<CreateTripRequest> = {
          title: trip.title,
          destination: trip.destination,
          description: ((trip.reason || trip.highlights.join(", ") || "").trim() + " [AI_GENERATED]").trim(),
          startDate,
          endDate,
          visibility: saveVisibility,
        };
        if (trip.image) {
          updatePayload.coverImageUrl = trip.image;
        }
        await tripsApi.update(tripId, updatePayload);
      } else {
        const createPayload: CreateTripRequest = {
          title: trip.title,
          destination: trip.destination,
          description: ((trip.reason || trip.highlights.join(", ") || "").trim() + " [AI_GENERATED]").trim(),
          startDate,
          endDate,
          visibility: saveVisibility,
        };

        const created = await tripsApi.create(createPayload);
        tripId = created.tripId;
        title = created.title;

        // Save cover image immediately using trip.image
        if (trip.image) {
          try {
            await tripsApi.update(tripId, { coverImageUrl: trip.image });
          } catch (e) {
            console.error("Failed to update trip cover image", e);
          }
        }

        // Cache the newly created tripId in state/storage
        updateAiTripRouteState(sid, state.trip, tripId);
        setState((prev) => (prev ? { ...prev, savedTripId: tripId } : null));
      }

      if (trip.aiItinerary && trip.aiItinerary.length > 0) {
        const itineraryPayload: UpdateItineraryRequest = {
          dayPlans: trip.aiItinerary.map((day) => ({
            dayNumber: day.dayNumber,
            date: offsetDate(startDate, day.dayNumber - 1),
            title: day.title || `Day ${day.dayNumber}`,
            activities: [
              ...(day.activities || []).map((act) => {
                const { startTime, endTime } = parseActivityTime(act.time);
                return {
                  title: act.title,
                  description: act.description,
                  location: act.location,
                  startTime,
                  endTime,
                  category: mapAiCategory(act.category),
                  notes: act.tips,
                };
              }),
              ...((day.transportRecommendations?.length || day.weather) ? [{
                title: "__METADATA__",
                description: JSON.stringify({
                  transportRecommendations: day.transportRecommendations,
                  weather: day.weather
                }),
                location: "",
                category: "OTHER",
                notes: ""
              }] : [])
            ],
          })),
        };
        await itineraryApi.update(tripId, itineraryPayload);
      }

      const filters = state.preferenceContext?.selectedFilters || [];
      const preferenceInput: TripPreferenceInput = {
        tripType: inferTripType(filters),
        budgetTier: mapBudgetToTier(trip.budget),
        notes: [
          state.preferenceContext?.budget,
          state.preferenceContext?.diet,
          state.preferenceContext?.preferences,
          state.preferenceContext?.customPreference,
        ]
          .filter(Boolean)
          .join(". ") || undefined,
      };

      if (hasTripPreferences(preferenceInput)) {
        try {
          await preferencesApi.save(tripId, preferenceInput);
        } catch (err) {
          console.error("Failed to save AI trip preferences", err);
        }
      }

      // Transition AI-generated trips to PLANNED status so they don't show as "Draft"
      if (trip.aiItinerary && trip.aiItinerary.length > 0) {
        try {
          await tripsApi.updateStatus(tripId, "PLANNED");
        } catch {
          // Non-critical — trip is still saved, just shows as Draft
        }
      }

      // Fire cover image generation (non-blocking) only if we don't have a pre-fetched Wikipedia image
      if (!trip.image) {
        void ensureTripCoverImage(tripId, trip.destination);
      }

      addToast(state.savedTripId ? "Trip updated successfully!" : "Trip saved to your dashboard!", "success");
      router.push(`${ROUTES.dashboard}/trips/${tripSlug(title, tripId)}?from=ai`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save trip.";
      setSaveError(message);
      addToast(message, "error");
    } finally {
      setIsSaving(false);
    }
  }

  if (loadError) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col items-center justify-center px-4 py-10 text-center">
        <h1 className="text-2xl font-black text-foreground">AI trip unavailable</h1>
        <p className="mt-3 text-muted">{loadError}</p>
        <Link href={ROUTES.home} className="mt-6 font-medium text-trippy-500 hover:text-trippy-600">
          Go back home
        </Link>
      </main>
    );
  }

  if (!state) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-3xl items-center justify-center px-4 py-10 text-center">
        <p className="text-muted">Loading AI trip...</p>
      </main>
    );
  }

  return (
    <TripFullScreenView
      trip={state.trip}
      userPrompt={state.userPrompt}
      userDates={state.userDates}
      onClose={() => router.push(ROUTES.home)}
      onSave={(trip) => void handleSave(trip)}
      saved={Boolean(state.savedTripId)}
      isSaving={isSaving}
      saveError={saveError}
      visibility={saveVisibility}
      onVisibilityChange={handleVisibilityChange}
      sid={sid}
    />
  );
}

export default function AiTripPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto flex min-h-screen w-full max-w-3xl items-center justify-center px-4 py-10 text-center">
          <p className="text-muted">Loading AI trip...</p>
        </main>
      }
    >
      <AiTripPageContent />
    </Suspense>
  );
}
