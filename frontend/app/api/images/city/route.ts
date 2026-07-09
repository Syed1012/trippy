import { NextResponse } from "next/server";

/**
 * Fetches a city/destination photo from Wikipedia's free REST API.
 * No API key required.
 *
 * Usage: GET /api/images/city?q=Paris,France
 */

const imageCache = new Map<string, string>();

async function fetchWikipediaImage(query: string): Promise<string | null> {
  // Try Wikipedia REST API — returns the main image of an article
  const encoded = encodeURIComponent(query);
  const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encoded}`;

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Trippy/1.0 (travel planner app)" },
    });
    if (!res.ok) return null;
    const data = await res.json();

    // Wikipedia returns originalimage (high-res) and thumbnail
    const img = data?.originalimage?.source || data?.thumbnail?.source;
    if (img) return img;
  } catch {
    // Wikipedia lookup failed
  }

  return null;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim();

  if (!query) {
    return NextResponse.json({ error: "Missing ?q= parameter" }, { status: 400 });
  }

  // Check in-memory cache
  if (imageCache.has(query)) {
    return NextResponse.json({ image: imageCache.get(query), cached: true });
  }

  // Try different search terms for better results
  const parts = query.split(",").map((s) => s.trim());
  const cityName = parts[0];

  // Try: "CityName" → "CityName tourism" → "CityName country"
  const searches = [
    cityName,
    `${cityName} (city)`,
    parts.length > 1 ? `${cityName}, ${parts[1]}` : null,
  ].filter(Boolean) as string[];

  for (const term of searches) {
    const img = await fetchWikipediaImage(term);
    if (img) {
      imageCache.set(query, img);
      return NextResponse.json({ image: img, cached: false });
    }
  }

  // Final fallback
  const fallback = `https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=800&auto=format&fit=crop&q=80`;
  imageCache.set(query, fallback);
  return NextResponse.json({ image: fallback, cached: false, fallback: true });
}
