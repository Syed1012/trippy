"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { preferencesApi, recommendationsApi, type TripPreferenceInput } from "@/lib/api";
import { useToast } from "@/lib/toast";
import { type AISuggestion, buildDaySuggestions, groupRecommendations } from "@/lib/ai-suggestions";

export type AIGenStatus = "generating" | "ready";

export interface AIGenState {
  status: AIGenStatus;
  suggestions: Record<number, AISuggestion[]>;
  chosen: Record<number, string>;
  destination: string;
  days: number;
}

export interface ExistingItineraryDay {
  dayNumber: number;
  title?: string;
  activities: { time?: string; title: string; estimatedCost?: string }[];
}

export interface StartGenerationParams {
  tripId: string;
  destination: string;
  days: number;
  existingItinerary?: ExistingItineraryDay[];
}

interface AIGenerationContextValue {
  /** Per-trip generation state (keyed by tripId). */
  states: Record<string, AIGenState>;
  /** Start a whole-trip generation if one isn't already running/ready for the trip. */
  ensureStarted: (params: StartGenerationParams) => void;
  /** Regenerate a single day's options, optionally steered by a free-text wish. */
  regenerateDay: (tripId: string, dayNumber: number, dayWish?: string) => Promise<void>;
  /** Populate state from stored recommendations if nothing is in memory yet. */
  hydrate: (tripId: string, destination: string, days: number) => void;
  /** Record which suggestion the user picked for a day. */
  setChosen: (tripId: string, dayNumber: number, suggestionId: string) => void;
}

const AIGenerationContext = createContext<AIGenerationContextValue | null>(null);

export function useAIGeneration(): AIGenerationContextValue {
  const ctx = useContext(AIGenerationContext);
  if (!ctx) {
    throw new Error("useAIGeneration must be used within an AIGenerationProvider");
  }
  return ctx;
}

function fallbackMap(days: number, destination: string): Record<number, AISuggestion[]> {
  const map: Record<number, AISuggestion[]> = {};
  for (let d = 1; d <= days; d++) map[d] = buildDaySuggestions(d, destination);
  return map;
}

/**
 * Holds AI itinerary generation state above the page level so a generation
 * started on a trip keeps running while the user navigates elsewhere in the
 * dashboard, and is ready when they return. Mounted once in the dashboard layout.
 */
export function AIGenerationProvider({ children }: { children: React.ReactNode }) {
  const { addToast } = useToast();
  const [states, setStates] = useState<Record<string, AIGenState>>({});
  const statesRef = useRef(states);
  useEffect(() => {
    statesRef.current = states;
  }, [states]);

  const inFlight = useRef<Record<string, boolean>>({});
  const hydrated = useRef<Record<string, boolean>>({});
  const prefsCache = useRef<Record<string, TripPreferenceInput | undefined>>({});
  const metaCache = useRef<Record<string, { destination: string; days: number }>>({});

  const loadPreferences = useCallback(async (tripId: string): Promise<TripPreferenceInput | undefined> => {
    if (tripId in prefsCache.current) return prefsCache.current[tripId];
    let prefs: TripPreferenceInput | undefined;
    try {
      const p = await preferencesApi.getForTrip(tripId);
      prefs = {
        tripType: p.tripType,
        budgetTier: p.budgetTier,
        preferredWeather: p.preferredWeather,
        notes: p.notes,
      };
    } catch {
      prefs = undefined;
    }
    prefsCache.current[tripId] = prefs;
    return prefs;
  }, []);

  const runWholeTrip = useCallback(async (params: StartGenerationParams) => {
    const { tripId, destination, days, existingItinerary } = params;
    metaCache.current[tripId] = { destination, days };
    let grouped: Record<number, AISuggestion[]>;
    try {
      const preferences = await loadPreferences(tripId);
      const res = await recommendationsApi.generate({ tripId, destination, days, preferences, existingItinerary });
      grouped = groupRecommendations(res, destination);
      for (let d = 1; d <= days; d++) {
        if (!grouped[d]?.length) grouped[d] = buildDaySuggestions(d, destination);
      }
    } catch {
      grouped = fallbackMap(days, destination);
    }
    setStates((prev) => ({
      ...prev,
      [tripId]: { status: "ready", suggestions: grouped, chosen: prev[tripId]?.chosen ?? {}, destination, days },
    }));
    inFlight.current[tripId] = false;
    const place = destination.split(",")[0]?.trim() || destination || "your trip";
    addToast(`Your AI suggestions for the ${place} itinerary are ready`, "success");
  }, [loadPreferences, addToast]);

  const ensureStarted = useCallback((params: StartGenerationParams) => {
    const { tripId, destination, days } = params;
    const existing = statesRef.current[tripId];
    if (existing && (existing.status === "generating" || existing.status === "ready")) return;
    if (inFlight.current[tripId]) return;
    inFlight.current[tripId] = true;
    setStates((prev) => ({
      ...prev,
      [tripId]: { status: "generating", suggestions: {}, chosen: prev[tripId]?.chosen ?? {}, destination, days },
    }));
    void runWholeTrip(params);
  }, [runWholeTrip]);

  const regenerateDay = useCallback(async (tripId: string, dayNumber: number, dayWish?: string) => {
    const meta = metaCache.current[tripId];
    const destination = meta?.destination ?? statesRef.current[tripId]?.destination ?? "";
    const days = meta?.days ?? statesRef.current[tripId]?.days ?? 1;

    const applyDay = (cards: AISuggestion[]) =>
      setStates((prev) => {
        const cur = prev[tripId];
        if (!cur) return prev;
        const chosen = { ...cur.chosen };
        delete chosen[dayNumber];
        return { ...prev, [tripId]: { ...cur, suggestions: { ...cur.suggestions, [dayNumber]: cards }, chosen } };
      });

    try {
      const preferences = await loadPreferences(tripId);
      const res = await recommendationsApi.generate({ tripId, destination, days, dayNumber, dayWish: dayWish?.trim() || undefined, preferences });
      const grouped = groupRecommendations(res, destination);
      applyDay(grouped[dayNumber]?.length ? grouped[dayNumber] : buildDaySuggestions(dayNumber, destination));
    } catch {
      applyDay(buildDaySuggestions(dayNumber, destination));
    }
  }, [loadPreferences]);

  const hydrate = useCallback((tripId: string, destination: string, days: number) => {
    if (statesRef.current[tripId] || hydrated.current[tripId]) return;
    hydrated.current[tripId] = true;
    metaCache.current[tripId] = { destination, days };
    void (async () => {
      try {
        const res = await recommendationsApi.getStored(tripId);
        if (!res.days?.length) return;
        const grouped = groupRecommendations(res, destination);
        setStates((prev) => (prev[tripId]
          ? prev
          : { ...prev, [tripId]: { status: "ready", suggestions: grouped, chosen: {}, destination, days } }));
      } catch {
        // No stored recommendations yet — leave the trip idle until generation starts.
      }
    })();
  }, []);

  const setChosen = useCallback((tripId: string, dayNumber: number, suggestionId: string) => {
    setStates((prev) => {
      const cur = prev[tripId];
      if (!cur) return prev;
      return { ...prev, [tripId]: { ...cur, chosen: { ...cur.chosen, [dayNumber]: suggestionId } } };
    });
  }, []);

  const value: AIGenerationContextValue = { states, ensureStarted, regenerateDay, hydrate, setChosen };
  return <AIGenerationContext.Provider value={value}>{children}</AIGenerationContext.Provider>;
}
