import { NextResponse } from "next/server";
import {
  type DayWeather,
  type WeatherHour,
  weatherEmoji,
  wmoToCondition,
  owmMainToCondition,
  weatherAdvice,
  formatHourLabel,
} from "@/lib/weather";

export const runtime = "nodejs";

const OPEN_METEO_GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search";
const OPEN_METEO_FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
const OPENWEATHER_FORECAST_URL =
  process.env.OPENWEATHER_FORECAST_URL || "https://api.openweathermap.org/data/2.5/forecast";

/** Days from today (UTC-date based) that OpenWeather's free 5-day forecast still covers. */
const OPENWEATHER_MAX_DAYS = 5;
/** Open-Meteo publishes forecasts ~16 days out; beyond that we fall back to a climatology estimate. */
const OPEN_METEO_MAX_DAYS = 16;

// Small module-level cache so repeated day cards / navigation don't re-hit upstreams.
const cache = new Map<string, { at: number; data: DayWeather }>();
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const destination = (searchParams.get("destination") ?? "").trim();
  const date = (searchParams.get("date") ?? "").trim();

  if (!destination || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json(
      { error: "destination and date (YYYY-MM-DD) are required" },
      { status: 400 },
    );
  }

  const cacheKey = `${destination.toLowerCase()}|${date}`;
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    return NextResponse.json(hit.data);
  }

  try {
    const coords = await geocode(destination);
    if (!coords) {
      return NextResponse.json(
        { error: `Could not locate "${destination}"` },
        { status: 404 },
      );
    }

    const daysOut = daysFromToday(date);
    let data: DayWeather | null = null;

    // ≤5 days out → use the user's OpenWeather key when present (their configured provider).
    if (daysOut <= OPENWEATHER_MAX_DAYS && process.env.OPENWEATHER_API_KEY) {
      data = await fetchOpenWeather(coords, date);
    }
    // Otherwise (or if OpenWeather failed / no key) → Open-Meteo, which covers ~16 days hourly.
    if (!data && daysOut <= OPEN_METEO_MAX_DAYS) {
      data = await fetchOpenMeteo(coords, date);
    }
    // Beyond forecast range → climatology estimate so far-out trips still show something.
    if (!data) {
      data = seasonalEstimate(coords.lat, date);
    }

    cache.set(cacheKey, { at: Date.now(), data });
    return NextResponse.json(data);
  } catch (err) {
    console.warn("[weather] lookup failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Weather lookup failed" }, { status: 502 });
  }
}

/* ── Geocoding (Open-Meteo, no key) ──────────────────────────────────── */
interface Coords {
  lat: number;
  lon: number;
}

async function geocode(destination: string): Promise<Coords | null> {
  const city = destination.split(",")[0].trim();
  const url = new URL(OPEN_METEO_GEOCODING_URL);
  url.searchParams.set("name", city);
  url.searchParams.set("count", "1");
  url.searchParams.set("language", "en");
  url.searchParams.set("format", "json");
  const geo = await fetchJson<{ results?: Array<{ latitude: number; longitude: number }> }>(
    url.toString(),
  );
  const loc = geo?.results?.[0];
  if (typeof loc?.latitude !== "number" || typeof loc?.longitude !== "number") return null;
  return { lat: loc.latitude, lon: loc.longitude };
}

/* ── OpenWeather 5-day / 3-hour forecast ─────────────────────────────── */
interface OwmForecast {
  list?: Array<{
    dt_txt: string; // "2026-07-19 12:00:00"
    main?: { temp?: number };
    weather?: Array<{ main?: string; description?: string }>;
  }>;
}

async function fetchOpenWeather(coords: Coords, date: string): Promise<DayWeather | null> {
  const url = new URL(OPENWEATHER_FORECAST_URL);
  url.searchParams.set("lat", String(coords.lat));
  url.searchParams.set("lon", String(coords.lon));
  url.searchParams.set("units", "metric");
  url.searchParams.set("appid", process.env.OPENWEATHER_API_KEY ?? "");
  const res = await fetchJson<OwmForecast>(url.toString());
  const entries = (res?.list ?? []).filter((e) => e.dt_txt?.startsWith(date));
  if (entries.length === 0) return null;

  const hourly: WeatherHour[] = entries.map((e) => {
    const hour = parseInt(e.dt_txt.slice(11, 13), 10);
    const condition = owmMainToCondition(e.weather?.[0]?.main, e.weather?.[0]?.description);
    return {
      iso: `${date}T${e.dt_txt.slice(11, 16)}`,
      hour,
      label: formatHourLabel(hour),
      temp: Math.round(e.main?.temp ?? 0),
      condition,
      icon: weatherEmoji(condition),
    };
  });

  return summarize(date, hourly, "openweather");
}

/* ── Open-Meteo hourly forecast ──────────────────────────────────────── */
interface MeteoForecast {
  hourly?: { time?: string[]; temperature_2m?: number[]; weathercode?: number[] };
  daily?: { time?: string[]; temperature_2m_max?: number[]; temperature_2m_min?: number[] };
}

async function fetchOpenMeteo(coords: Coords, date: string): Promise<DayWeather | null> {
  const url = new URL(OPEN_METEO_FORECAST_URL);
  url.searchParams.set("latitude", String(coords.lat));
  url.searchParams.set("longitude", String(coords.lon));
  url.searchParams.set("hourly", "temperature_2m,weathercode");
  url.searchParams.set("daily", "temperature_2m_max,temperature_2m_min");
  url.searchParams.set("timezone", "auto");
  url.searchParams.set("start_date", date);
  url.searchParams.set("end_date", date);
  const res = await fetchJson<MeteoForecast>(url.toString());

  const times = res?.hourly?.time ?? [];
  const temps = res?.hourly?.temperature_2m ?? [];
  const codes = res?.hourly?.weathercode ?? [];
  const hourly: WeatherHour[] = [];
  for (let i = 0; i < times.length; i++) {
    if (!times[i]?.startsWith(date)) continue;
    const hour = parseInt(times[i].slice(11, 13), 10);
    const condition = wmoToCondition(codes[i]);
    hourly.push({
      iso: times[i],
      hour,
      label: formatHourLabel(hour),
      temp: Math.round(temps[i] ?? 0),
      condition,
      icon: weatherEmoji(condition),
    });
  }
  if (hourly.length === 0) return null;

  const high = num(res?.daily?.temperature_2m_max?.[0]);
  const low = num(res?.daily?.temperature_2m_min?.[0]);
  return summarize(date, hourly, "open-meteo", high, low);
}

/* ── Seasonal climatology estimate (beyond forecast range) ───────────── */
function seasonalEstimate(latitude: number, date: string): DayWeather {
  const month = parseInt(date.split("-")[1], 10) - 1;
  const isNorthern = latitude >= 0;
  const northernSeason =
    [11, 0, 1].includes(month) ? "winter"
    : [2, 3, 4].includes(month) ? "spring"
    : [5, 6, 7].includes(month) ? "summer"
    : "autumn";
  const season = isNorthern
    ? northernSeason
    : northernSeason === "winter" ? "summer"
    : northernSeason === "summer" ? "winter"
    : northernSeason === "spring" ? "autumn"
    : "spring";

  const absLat = Math.abs(latitude);
  let temp: number;
  if (absLat < 23) temp = season === "winter" ? 26 : 32;
  else if (absLat < 40) temp = season === "summer" ? 30 : season === "winter" ? 12 : 20;
  else if (absLat < 60) temp = season === "summer" ? 22 : season === "winter" ? 3 : 13;
  else temp = season === "summer" ? 12 : season === "winter" ? -10 : 2;

  const condition = season === "summer" ? "Clear sky" : season === "winter" ? "Overcast" : "Partly cloudy";
  return {
    date,
    tempC: temp,
    high: temp + 4,
    low: temp - 4,
    condition,
    icon: weatherEmoji(condition),
    advice: `Typical ${season} conditions — forecast opens ~16 days out.`,
    source: "seasonal",
    hourly: [],
  };
}

/* ── Shared summary builder ──────────────────────────────────────────── */
function summarize(
  date: string,
  hourly: WeatherHour[],
  source: DayWeather["source"],
  highIn?: number | null,
  lowIn?: number | null,
): DayWeather {
  const temps = hourly.map((h) => h.temp);
  const high = highIn ?? Math.max(...temps);
  const low = lowIn ?? Math.min(...temps);
  // Representative = the entry closest to 13:00 (typical peak activity hour).
  const midday = hourly.reduce((best, h) =>
    Math.abs(h.hour - 13) < Math.abs(best.hour - 13) ? h : best,
  );
  return {
    date,
    tempC: midday.temp,
    high,
    low,
    condition: midday.condition,
    icon: midday.icon,
    advice: weatherAdvice(midday.condition),
    source,
    hourly,
  };
}

/* ── Utilities ───────────────────────────────────────────────────────── */
function daysFromToday(date: string): number {
  const target = new Date(`${date}T00:00:00Z`).getTime();
  const now = new Date();
  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.round((target - todayUtc) / 86_400_000);
}

function num(v: number | undefined | null): number | null {
  return typeof v === "number" && Number.isFinite(v) ? Math.round(v) : null;
}

async function fetchJson<T>(url: string): Promise<T | undefined> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6_000);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) return undefined;
    return (await response.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
}
