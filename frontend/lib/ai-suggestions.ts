import { type RecommendationResponse } from "@/lib/api";

/** A single AI itinerary suggestion card shown in the trip AI sidebar. */
export interface AISuggestion {
  id: string;
  vibe: "Top Pick" | "Adventurer" | "Hidden Gem";
  title: string;
  location: string;
  startTime: string;
  endTime: string;
  cost: number;
  mapsUrl: string;
  notes: string;
}

export const VIBE_ORDER: AISuggestion["vibe"][] = ["Top Pick", "Adventurer", "Hidden Gem"];

/** Deterministic client-side fallback used when the model is unavailable. */
export function buildDaySuggestions(day: number, destination: string): AISuggestion[] {
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
      location: city,
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
      location: city,
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
      location: city,
      startTime: "10:30",
      endTime: "20:00",
      cost: 55,
      mapsUrl: maps(gem),
      notes: `Skip the crowds and roam where locals go — indie cafés, tiny galleries and flavors the guidebooks miss.`,
    },
  ];
}

/** Map a backend recommendation response into per-day suggestion cards. */
export function groupRecommendations(
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
        location: o.location ?? "",
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
