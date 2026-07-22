import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Place search for the trip day-map. Two modes, decided from the query:
 *
 * - "coffee shops near ludwigsburg" → category mode: geocode the area, then a
 *   Photon `osm_tag` POI search biased to it (nearest first, up to 6).
 * - "Sagrada Familia" → place mode: Photon free-text search (up to 6 matches so
 *   the user can pick between same-named places).
 *
 * Photon is free and keyless, matching the existing /api/geocode stack.
 * Results are cached in-memory for 10 minutes.
 */

const PHOTON_URL = "https://photon.komoot.io/api/";
const MAX_RESULTS = 6;
const CATEGORY_MAX_KM = 20;

export interface PlaceResult {
  id: string;
  name: string;
  category: string;
  address: string;
  lat: number;
  lng: number;
}

/** Natural-language category → Photon osm_tag filters (multiple are OR'ed). */
const CATEGORY_TAGS: Record<string, { tags: string[]; q: string }> = {
  coffee: { tags: ["amenity:cafe"], q: "cafe" },
  cafe: { tags: ["amenity:cafe"], q: "cafe" },
  cafes: { tags: ["amenity:cafe"], q: "cafe" },
  restaurant: { tags: ["amenity:restaurant"], q: "restaurant" },
  restaurants: { tags: ["amenity:restaurant"], q: "restaurant" },
  food: { tags: ["amenity:restaurant", "amenity:fast_food"], q: "restaurant" },
  bar: { tags: ["amenity:bar", "amenity:pub"], q: "bar" },
  bars: { tags: ["amenity:bar", "amenity:pub"], q: "bar" },
  pub: { tags: ["amenity:pub"], q: "pub" },
  pubs: { tags: ["amenity:pub"], q: "pub" },
  bakery: { tags: ["shop:bakery"], q: "bakery" },
  bakeries: { tags: ["shop:bakery"], q: "bakery" },
  supermarket: { tags: ["shop:supermarket"], q: "supermarket" },
  supermarkets: { tags: ["shop:supermarket"], q: "supermarket" },
  hotel: { tags: ["tourism:hotel"], q: "hotel" },
  hotels: { tags: ["tourism:hotel"], q: "hotel" },
  hostel: { tags: ["tourism:hostel"], q: "hostel" },
  hostels: { tags: ["tourism:hostel"], q: "hostel" },
  museum: { tags: ["tourism:museum"], q: "museum" },
  museums: { tags: ["tourism:museum"], q: "museum" },
  park: { tags: ["leisure:park"], q: "park" },
  parks: { tags: ["leisure:park"], q: "park" },
  pharmacy: { tags: ["amenity:pharmacy"], q: "pharmacy" },
  pharmacies: { tags: ["amenity:pharmacy"], q: "pharmacy" },
  bank: { tags: ["amenity:bank"], q: "bank" },
  banks: { tags: ["amenity:bank"], q: "bank" },
  gym: { tags: ["leisure:fitness_centre"], q: "fitness" },
  gyms: { tags: ["leisure:fitness_centre"], q: "fitness" },
  cinema: { tags: ["amenity:cinema"], q: "cinema" },
  cinemas: { tags: ["amenity:cinema"], q: "cinema" },
  club: { tags: ["amenity:nightclub"], q: "club" },
  clubs: { tags: ["amenity:nightclub"], q: "club" },
  nightclub: { tags: ["amenity:nightclub"], q: "club" },
  viewpoint: { tags: ["tourism:viewpoint"], q: "viewpoint" },
  viewpoints: { tags: ["tourism:viewpoint"], q: "viewpoint" },
};

/** Multi-word phrases that resolve to a category key above. */
const PHRASE_ALIASES: [RegExp, string][] = [
  [/\bcoffee\s*(shops?|houses?|bars?)?\b/i, "coffee"],
  [/\bfast\s*food\b/i, "food"],
  [/\bnight\s*clubs?\b/i, "club"],
  [/\bfitness( studios?| cent(er|re)s?)?\b/i, "gym"],
];

const cache = new Map<string, { at: number; data: { mode: string; results: PlaceResult[] } }>();
const CACHE_TTL_MS = 10 * 60 * 1000;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").trim();
  const near = (searchParams.get("near") ?? "").trim();

  if (q.length < 2 || q.length > 200) {
    return NextResponse.json({ error: "q must be 2-200 characters" }, { status: 400 });
  }

  const cacheKey = `${q.toLowerCase()}|${near.toLowerCase()}`;
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    return NextResponse.json(hit.data);
  }

  try {
    let data: { mode: "category" | "place"; results: PlaceResult[] } | null = null;

    // 1) "X near/in/around Y" with a known category → POI search around Y.
    const parsed = parseCategoryQuery(q);
    if (parsed) {
      try {
        const area = await geocodeArea(parsed.area || near);
        if (area) {
          const pois = await photonCategorySearch(parsed.spec, area);
          if (pois.length > 0) data = { mode: "category", results: pois };
        }
      } catch {
        /* degrade to place mode */
      }
    }

    // 2) Plain place search (also the fallback when category search yields nothing).
    if (!data) {
      const bias = near ? await geocodeArea(near).catch(() => null) : null;
      const results = await photonSearch(q, bias);
      data = { mode: "place", results };
    }

    if (data.results.length > 0) {
      cache.set(cacheKey, { at: Date.now(), data });
    }
    return NextResponse.json(data);
  } catch (err) {
    console.warn("[places] search failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Place search failed" }, { status: 502 });
  }
}

/* ── Query parsing ───────────────────────────────────────────────────── */

function parseCategoryQuery(q: string): { spec: { tags: string[]; q: string }; area: string } | null {
  const m = /^(.{2,60}?)\s+(?:near|in|around|at)\s+(.{2,80})$/i.exec(q);
  const categoryText = (m ? m[1] : q).toLowerCase().trim();
  const area = m ? m[2].trim() : "";

  for (const [re, key] of PHRASE_ALIASES) {
    if (re.test(categoryText)) return { spec: CATEGORY_TAGS[key], area };
  }
  // Single/last-word lookup: "best coffee" → "coffee"
  const words = categoryText.split(/\s+/);
  for (const w of [words[words.length - 1], words[0]]) {
    if (CATEGORY_TAGS[w]) return { spec: CATEGORY_TAGS[w], area };
  }
  return null;
}

/* ── Photon upstream ─────────────────────────────────────────────────── */

interface Area {
  lat: number;
  lng: number;
}

interface PhotonResponse {
  features?: Array<{
    geometry?: { coordinates?: [number, number] };
    properties?: {
      osm_type?: string;
      osm_id?: number;
      name?: string;
      osm_value?: string;
      street?: string;
      housenumber?: string;
      city?: string;
      country?: string;
    };
  }>;
}

async function geocodeArea(name: string): Promise<Area | null> {
  if (!name.trim()) return null;
  const url = new URL(PHOTON_URL);
  url.searchParams.set("q", name.split(",")[0].trim());
  url.searchParams.set("limit", "1");
  const data = await fetchJson<PhotonResponse>(url.toString(), 6000);
  const c = data?.features?.[0]?.geometry?.coordinates;
  return c && typeof c[0] === "number" ? { lat: c[1], lng: c[0] } : null;
}

/** Category POIs around an area — Photon osm_tag search, nearest first, ≤20 km. */
async function photonCategorySearch(
  spec: { tags: string[]; q: string },
  area: Area,
): Promise<PlaceResult[]> {
  const url = new URL(PHOTON_URL);
  url.searchParams.set("q", spec.q);
  url.searchParams.set("limit", "30");
  url.searchParams.set("lat", String(area.lat));
  url.searchParams.set("lon", String(area.lng));
  for (const tag of spec.tags) url.searchParams.append("osm_tag", tag);

  const data = await fetchJson<PhotonResponse>(url.toString(), 8000);
  const scored = toResults(data)
    .map((p) => ({ p, dist: haversineKm(area, { lat: p.lat, lng: p.lng }) }))
    .filter((s) => s.dist <= CATEGORY_MAX_KM)
    .sort((a, b) => a.dist - b.dist)
    .slice(0, MAX_RESULTS);
  return scored.map((s) => s.p);
}

/** Free-text place search — up to 6 matches so same-named places stay pickable. */
async function photonSearch(q: string, bias: Area | null): Promise<PlaceResult[]> {
  const url = new URL(PHOTON_URL);
  url.searchParams.set("q", q);
  url.searchParams.set("limit", String(MAX_RESULTS * 2));
  if (bias) {
    url.searchParams.set("lat", String(bias.lat));
    url.searchParams.set("lon", String(bias.lng));
  }
  const data = await fetchJson<PhotonResponse>(url.toString(), 7000);
  return toResults(data).slice(0, MAX_RESULTS);
}

function toResults(data: PhotonResponse | undefined): PlaceResult[] {
  const out: PlaceResult[] = [];
  const seen = new Set<string>();
  for (const f of data?.features ?? []) {
    const p = f.properties ?? {};
    const c = f.geometry?.coordinates;
    if (!p.name || !c || typeof c[0] !== "number") continue;
    const dedupe = `${p.name.toLowerCase()}|${p.city ?? ""}`;
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);
    out.push({
      id: `${p.osm_type ?? "X"}${p.osm_id ?? c.join(",")}`,
      name: p.name,
      category: (p.osm_value ?? "place").replace(/_/g, " "),
      address: [
        [p.street, p.housenumber].filter(Boolean).join(" "),
        p.city,
        p.country,
      ].filter(Boolean).join(", "),
      lat: c[1],
      lng: c[0],
    });
  }
  return out;
}

/* ── Utilities ───────────────────────────────────────────────────────── */

function haversineKm(a: Area, b: Area): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

async function fetchJson<T>(url: string, timeoutMs: number): Promise<T | undefined> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "TrippyTripPlanner/1.0 (day-map place search)" },
    });
    if (!response.ok) return undefined;
    return (await response.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
}
