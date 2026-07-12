import { NextResponse } from "next/server";

export const runtime = "nodejs";

// OSRM public demo server — free, no key, returns road-following geometry.
const OSRM_URL = "https://router.project-osrm.org/route/v1/driving/";

interface Point {
  lat: number;
  lng: number;
}

interface RouteBody {
  points?: Point[];
}

export interface RouteResult {
  // Ordered [lat, lng] pairs tracing the actual roads (Leaflet order).
  geometry: [number, number][] | null;
  distanceKm: number | null;
  durationMin: number | null;
}

const cache = new Map<string, RouteResult>();

export async function POST(request: Request) {
  let body: RouteBody;
  try {
    body = (await request.json()) as RouteBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const points = (body.points ?? []).filter(
    (p) => typeof p?.lat === "number" && typeof p?.lng === "number",
  );
  if (points.length < 2) {
    return NextResponse.json({ geometry: null, distanceKm: null, durationMin: null });
  }

  const key = points.map((p) => `${p.lat.toFixed(4)},${p.lng.toFixed(4)}`).join(";");
  const hit = cache.get(key);
  if (hit) return NextResponse.json(hit);

  try {
    const coords = points.map((p) => `${p.lng},${p.lat}`).join(";");
    const url = `${OSRM_URL}${coords}?overview=full&geometries=geojson`;
    const data = await fetchJson<{
      code?: string;
      routes?: Array<{ geometry?: { coordinates?: [number, number][] }; distance?: number; duration?: number }>;
    }>(url);

    const route = data?.routes?.[0];
    const coordsOut = route?.geometry?.coordinates;
    let result: RouteResult;
    if (data?.code === "Ok" && Array.isArray(coordsOut) && coordsOut.length > 0) {
      result = {
        geometry: coordsOut.map(([lon, lat]) => [lat, lon] as [number, number]),
        distanceKm: typeof route?.distance === "number" ? Math.round(route.distance / 100) / 10 : null,
        durationMin: typeof route?.duration === "number" ? Math.round(route.duration / 60) : null,
      };
    } else {
      // No road route (e.g. across water) — let the client fall back to straight lines.
      result = { geometry: null, distanceKm: null, durationMin: null };
    }

    cache.set(key, result);
    return NextResponse.json(result);
  } catch (err) {
    console.warn("[route] failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ geometry: null, distanceKm: null, durationMin: null });
  }
}

async function fetchJson<T>(url: string): Promise<T | undefined> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "TrippyTripPlanner/1.0 (day-map routing)" },
    });
    if (!response.ok) return undefined;
    return (await response.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
}
