/**
 * Shared weather helpers used by both the `/api/weather` route (server) and the
 * itinerary editor (client). The route returns the normalized {@link DayWeather}
 * shape below; the client just renders it.
 */

export interface WeatherHour {
  /** Full ISO-ish timestamp, e.g. "2026-07-19T14:00". */
  iso: string;
  /** Hour of day, 0-23 (local to the destination). */
  hour: number;
  /** Human label, e.g. "2 PM". */
  label: string;
  /** Rounded temperature in °C. */
  temp: number;
  /** Normalized condition, e.g. "Partly cloudy". */
  condition: string;
  /** Emoji for the condition. */
  icon: string;
}

export interface DayWeather {
  /** Requested date, "YYYY-MM-DD". */
  date: string;
  /** Representative temperature for the day in °C (midday-ish or average). */
  tempC: number | null;
  high: number | null;
  low: number | null;
  condition: string;
  icon: string;
  advice: string;
  /** Where the numbers came from. "seasonal" = climatology estimate (out of forecast range). */
  source: "openweather" | "open-meteo" | "seasonal";
  /** Hour-by-hour forecast across the day (may be empty for seasonal estimates). */
  hourly: WeatherHour[];
}

/** Map a normalized condition string to a representative emoji. */
export function weatherEmoji(condition?: string): string {
  if (!condition) return "🌤️";
  const c = condition.toLowerCase();
  if (c.includes("thunder") || c.includes("storm")) return "⛈️";
  if (c.includes("drizzle")) return "🌦️";
  if (c.includes("freezing")) return "🌧️";
  if (c.includes("snow")) return "🌨️";
  if (c.includes("rain") || c.includes("shower")) return "🌧️";
  if (c.includes("fog") || c.includes("mist") || c.includes("haze")) return "🌫️";
  if (c.includes("overcast")) return "☁️";
  if (c.includes("partly")) return "⛅";
  if (c.includes("mainly clear")) return "🌤️";
  if (c.includes("cloud")) return "☁️";
  if (c.includes("clear") || c.includes("sun")) return "☀️";
  return "🌤️";
}

/** WMO weather-interpretation code (Open-Meteo) → normalized condition. */
export function wmoToCondition(code: number | undefined): string {
  if (code === undefined) return "Forecast unavailable";
  if (code === 0) return "Clear sky";
  if (code === 1) return "Mainly clear";
  if (code === 2) return "Partly cloudy";
  if (code === 3) return "Overcast";
  if (code === 45 || code === 48) return "Foggy";
  if (code >= 51 && code <= 55) return "Drizzle";
  if (code >= 56 && code <= 57) return "Freezing drizzle";
  if (code >= 61 && code <= 65) return "Rain";
  if (code >= 66 && code <= 67) return "Freezing rain";
  if (code >= 71 && code <= 77) return "Snow";
  if (code >= 80 && code <= 82) return "Rain showers";
  if (code >= 85 && code <= 86) return "Snow showers";
  if (code >= 95 && code <= 99) return "Thunderstorm";
  return "Mixed conditions";
}

/** OpenWeather `weather[0].main` → normalized condition. */
export function owmMainToCondition(main: string | undefined, description?: string): string {
  const m = (main ?? "").toLowerCase();
  if (m === "clear") return "Clear sky";
  if (m === "clouds") {
    const d = (description ?? "").toLowerCase();
    if (d.includes("few") || d.includes("scattered")) return "Partly cloudy";
    if (d.includes("broken")) return "Cloudy";
    return "Overcast";
  }
  if (m === "drizzle") return "Drizzle";
  if (m === "rain") return "Rain";
  if (m === "thunderstorm") return "Thunderstorm";
  if (m === "snow") return "Snow";
  if (["mist", "fog", "haze", "smoke"].includes(m)) return "Foggy";
  return description ? description.replace(/\b\w/g, (ch) => ch.toUpperCase()) : "Mixed conditions";
}

/** Short, practical advice line for a condition. */
export function weatherAdvice(condition: string): string {
  const c = condition.toLowerCase();
  if (c.includes("thunder") || c.includes("storm")) return "Storms likely — keep indoor backups ready.";
  if (c.includes("rain") || c.includes("shower") || c.includes("drizzle")) return "Pack a compact umbrella or rain jacket.";
  if (c.includes("snow")) return "Bundle up — snow on the cards.";
  if (c.includes("fog")) return "Low visibility — plan extra travel time.";
  if (c.includes("clear") || c.includes("sun")) return "Great for outdoor plans — bring sun protection.";
  if (c.includes("cloud") || c.includes("overcast")) return "Mild and grey — comfortable for walking.";
  return "Check the local forecast closer to the day.";
}

/** Format an hour (0-23) as a compact "9 AM" / "2 PM" label. */
export function formatHourLabel(hour: number): string {
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12} ${hour < 12 ? "AM" : "PM"}`;
}

/* ── Client fetch with in-memory de-duplication ──────────────────────── */
const inflight = new Map<string, Promise<DayWeather | null>>();

/**
 * Fetch normalized day weather for a destination + date. Results are cached per
 * (destination, date) for the page session so multiple day cards and re-renders
 * don't hit the route repeatedly.
 */
export function fetchDayWeather(destination: string, date: string): Promise<DayWeather | null> {
  const key = `${destination.trim().toLowerCase()}|${date}`;
  const cached = inflight.get(key);
  if (cached) return cached;

  const promise = fetch(
    `/api/weather?destination=${encodeURIComponent(destination)}&date=${encodeURIComponent(date)}`,
  )
    .then((r) => (r.ok ? (r.json() as Promise<DayWeather>) : null))
    .catch(() => null)
    .then((data) => {
      // Don't cache a miss forever — let a later render retry.
      if (!data) inflight.delete(key);
      return data;
    });

  inflight.set(key, promise);
  return promise;
}
