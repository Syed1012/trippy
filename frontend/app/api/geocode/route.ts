import { NextResponse } from "next/server";

export const runtime = "nodejs";

// Photon (komoot) — free, no key, OSM-based, tolerant of small bursts.
const PHOTON_URL = "https://photon.komoot.io/api/";

export interface GeocodeResult {
  query: string;
  lat: number;
  lng: number;
  label: string;
}

interface GeocodeBody {
  near?: string;
  queries?: string[];
}

// Module-level cache so re-opening a day map doesn't re-hit the geocoder.
const cache = new Map<string, GeocodeResult | null>();

export async function POST(request: Request) {
  let body: GeocodeBody;
  try {
    body = (await request.json()) as GeocodeBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const near = (body.near ?? "").trim();
  const queries = Array.isArray(body.queries) ? body.queries : [];
  if (queries.length === 0) {
    return NextResponse.json({ results: [] });
  }

  try {
    // Resolve the destination centre once to bias each stop toward the right city.
    const center = near ? await geocodeOne(near, undefined) : null;

    const results = await Promise.all(
      queries.map((q) => {
        const query = (q ?? "").trim();
        if (!query) return Promise.resolve(null);
        // Bias the search with the destination, both in the text and by proximity.
        const biased = near && !query.toLowerCase().includes(near.split(",")[0].toLowerCase())
          ? `${query}, ${near}`
          : query;
        return geocodeOne(biased, center ?? undefined).then((r) =>
          r ? { ...r, query } : null,
        );
      }),
    );

    return NextResponse.json({ results });
  } catch (err) {
    console.warn("[geocode] failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Geocoding failed" }, { status: 502 });
  }
}

interface PhotonResponse {
  features?: Array<{
    geometry?: { coordinates?: [number, number] };
    properties?: { name?: string; city?: string; state?: string; country?: string };
  }>;
}

async function geocodeOne(
  query: string,
  bias: GeocodeResult | undefined,
): Promise<GeocodeResult | null> {
  const key = `${query.toLowerCase()}|${bias ? `${bias.lat.toFixed(2)},${bias.lng.toFixed(2)}` : ""}`;
  if (cache.has(key)) return cache.get(key) ?? null;

  const url = new URL(PHOTON_URL);
  url.searchParams.set("q", query);
  url.searchParams.set("limit", "1");
  if (bias) {
    url.searchParams.set("lat", String(bias.lat));
    url.searchParams.set("lon", String(bias.lng));
  }

  const data = await fetchJson<PhotonResponse>(url.toString());
  const feature = data?.features?.[0];
  const coords = feature?.geometry?.coordinates;
  let result: GeocodeResult | null = null;
  if (coords && typeof coords[0] === "number" && typeof coords[1] === "number") {
    const p = feature?.properties ?? {};
    const label = [p.name, p.city, p.country].filter(Boolean).join(", ") || query;
    result = { query, lat: coords[1], lng: coords[0], label };
  }
  cache.set(key, result);
  return result;
}

async function fetchJson<T>(url: string): Promise<T | undefined> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7_000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "TrippyTripPlanner/1.0 (day-map geocoding)" },
    });
    if (!response.ok) return undefined;
    return (await response.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
}
