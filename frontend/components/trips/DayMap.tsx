"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import type * as LeafletTypes from "leaflet";
import {
  Loader2, Navigation, MapPinOff, Route as RouteIcon, Search, X,
  Sparkles, Plus, Check, Star, MessageSquareQuote,
} from "lucide-react";

export interface DayMapStop {
  title: string;
  location: string;
  time?: string;
}

export interface DayMapPlace {
  id: string;
  name: string;
  category: string;
  address: string;
  lat: number;
  lng: number;
}

interface Resolved {
  title: string;
  time?: string;
  lat: number;
  lng: number;
}

interface PlaceInsight {
  id: string;
  rating: number;
  reviewCount: number;
  reviews: { author: string; rating: number; when: string; text: string }[];
}

interface RankResult {
  source: string;
  summary?: string | null;
  rankings: { placeId: string; rank: number; name: string; reason: string }[];
}

const ACCENT = "#e76f51";
const ACCENT_DARK = "#c2410c";
const END = "#123d36";
const SEARCH_PIN = "#7c3aed";
const SEARCH_PIN_DARK = "#5b21b6";
const LETTERS = ["A", "B", "C", "D", "E", "F"];
const MEDALS = ["🥇", "🥈", "🥉"];

/** Reviews survive re-searches within the session — keyed by stable place id. */
const insightCache = new Map<string, PlaceInsight>();

/**
 * The day's spatial cockpit: itinerary stops with a road-following route
 * (unchanged), plus a place search bar — type a specific place or a category
 * query ("coffee shops near Ludwigsburg") to drop up to six selectable violet
 * pins with AI-written reviews, ask the local AI for a top-3 verdict, and add
 * any result straight into the day's plan.
 */
export default function DayMap({
  destination,
  stops,
  onAddStop,
}: {
  destination: string;
  stops: DayMapStop[];
  onAddStop?: (place: { name: string; address: string; category: string }) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletTypes.Map | null>(null);
  const leafletRef = useRef<typeof import("leaflet") | null>(null);
  const searchLayerRef = useRef<LeafletTypes.LayerGroup | null>(null);
  const stopBoundsRef = useRef<[number, number][]>([]);

  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [mapEpoch, setMapEpoch] = useState(0);
  const [meta, setMeta] = useState<{ pins: number; distanceKm: number | null; durationMin: number | null }>({
    pins: 0, distanceKm: null, durationMin: null,
  });

  /* ── Search state (all guarded by searchSeq against stale async) ──── */
  const searchSeq = useRef(0);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [results, setResults] = useState<DayMapPlace[]>([]);
  const [insights, setInsights] = useState<Record<string, PlaceInsight>>({});
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const [rank, setRank] = useState<RankResult | null>(null);
  const [ranking, setRanking] = useState(false);

  // Only re-map when the set/order of locations changes — not on every keystroke.
  const signature = useMemo(
    () => stops.map((s) => s.location.trim().toLowerCase()).filter(Boolean).join(">>"),
    [stops],
  );
  const stopsRef = useRef(stops);
  stopsRef.current = stops;

  /* ── Effect A: build the base map (stops + route) ─────────────────── */
  useEffect(() => {
    let cancelled = false;
    let map: LeafletTypes.Map | null = null;

    (async () => {
      setStatus("loading");
      const active = stopsRef.current.filter((s) => s.location.trim());

      // 1) Geocode stops (and the destination as a fallback centre for empty days).
      let resolved: Resolved[] = [];
      let fallbackCenter: [number, number] | null = null;
      try {
        const queries = active.length > 0 ? active.map((s) => s.location) : [destination];
        const res = await fetch("/api/geocode", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ near: destination, queries }),
        });
        const data = await res.json();
        const geo: ({ lat: number; lng: number } | null)[] = data?.results ?? [];
        if (active.length > 0) {
          resolved = active
            .map((s, i): Resolved | null => {
              const r = geo[i];
              return r ? { title: s.title || "Untitled activity", time: s.time, lat: r.lat, lng: r.lng } : null;
            })
            .filter((r): r is Resolved => r !== null);
        } else if (geo[0]) {
          fallbackCenter = [geo[0].lat, geo[0].lng];
        }
      } catch {
        /* handled below */
      }
      if (cancelled) return;
      if (active.length > 0 && resolved.length === 0) {
        setStatus("error");
        return;
      }

      // 2) Init Leaflet.
      const L = (await import("leaflet")).default;
      if (cancelled || !containerRef.current) return;

      map = L.map(containerRef.current, {
        zoomControl: true,
        scrollWheelZoom: false,
        attributionControl: true,
      });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map);

      const points = resolved.map((r) => [r.lat, r.lng] as [number, number]);
      stopBoundsRef.current = points;

      // 3) Road-following route (2+ stops only).
      let routeLine: [number, number][] = points;
      let distanceKm: number | null = null;
      let durationMin: number | null = null;
      if (resolved.length >= 2) {
        try {
          const rr = await fetch("/api/route", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ points: points.map(([lat, lng]) => ({ lat, lng })) }),
          });
          const rd = await rr.json();
          if (Array.isArray(rd?.geometry) && rd.geometry.length > 1) {
            routeLine = rd.geometry;
            distanceKm = rd.distanceKm ?? null;
            durationMin = rd.durationMin ?? null;
          }
        } catch {
          /* straight segments */
        }
        if (cancelled || !map) return;

        L.polyline(routeLine, { color: "#ffffff", weight: 7, opacity: 0.9, lineJoin: "round", lineCap: "round" }).addTo(map);
        L.polyline(routeLine, { color: ACCENT, weight: 4, opacity: 0.95, lineJoin: "round", lineCap: "round" }).addTo(map);

        for (const f of [0.28, 0.52, 0.76]) {
          const i = Math.min(routeLine.length - 2, Math.max(0, Math.floor(f * (routeLine.length - 1))));
          const deg = bearing(routeLine[i], routeLine[i + 1]);
          L.marker(routeLine[i], {
            icon: L.divIcon({ className: "", html: chevronHtml(deg), iconSize: [18, 18], iconAnchor: [9, 9] }),
            interactive: false,
            keyboard: false,
          }).addTo(map);
        }
      }

      // 4) Stop pins — numbered, last one an arrowhead.
      resolved.forEach((r, i) => {
        const isLast = i === resolved.length - 1 && resolved.length >= 2;
        const endBearing = isLast
          ? bearing(routeLine[routeLine.length - 2] ?? points[points.length - 2], routeLine[routeLine.length - 1])
          : 0;
        const icon = L.divIcon({
          className: "",
          html: isLast ? arrowPinHtml(endBearing) : pinHtml(i + 1),
          iconSize: isLast ? [40, 48] : [34, 44],
          iconAnchor: isLast ? [20, 44] : [17, 44],
          tooltipAnchor: [0, -40],
        });
        L.marker([r.lat, r.lng], { icon })
          .addTo(map!)
          .bindTooltip(tooltipHtml(r, i + 1, resolved.length), {
            direction: "top", offset: [0, -4], opacity: 1, className: "daymap-tip",
          });
      });

      // 5) Frame.
      if (points.length > 0) {
        map.fitBounds(L.latLngBounds(points), { padding: [50, 50], maxZoom: 15 });
      } else if (fallbackCenter) {
        map.setView(fallbackCenter, 13);
      } else {
        map.setView([20, 0], 2);
      }

      mapRef.current = map;
      leafletRef.current = L;
      setMeta({ pins: resolved.length, distanceKm, durationMin });
      setStatus("ready");
      setMapEpoch((e) => e + 1); // let the search layer re-attach after a rebuild
      window.setTimeout(() => { if (!cancelled && map) map.invalidateSize(); }, 260);
    })();

    return () => {
      cancelled = true;
      mapRef.current = null;
      leafletRef.current = null;
      searchLayerRef.current = null;
      if (map) map.remove();
    };
  }, [signature, destination]);

  /* ── Effect B: draw search-result pins on top of whatever map exists ── */
  useEffect(() => {
    const map = mapRef.current;
    const L = leafletRef.current;
    if (!map || !L) return;

    if (searchLayerRef.current) {
      searchLayerRef.current.remove();
      searchLayerRef.current = null;
    }
    if (results.length === 0) return;

    const layer = L.layerGroup();
    results.forEach((p, i) => {
      const selected = p.id === selectedId;
      const marker = L.marker([p.lat, p.lng], {
        icon: L.divIcon({
          className: "",
          html: searchPinHtml(LETTERS[i] ?? "?", selected),
          iconSize: selected ? [40, 50] : [34, 44],
          iconAnchor: selected ? [20, 46] : [17, 41],
          tooltipAnchor: [0, -40],
        }),
        zIndexOffset: selected ? 1000 : 500,
      }).bindTooltip(
        `<div style="font:800 12px system-ui,sans-serif;color:#17211f">${escapeHtml(p.name)}</div>
         <div style="font:600 10px system-ui,sans-serif;color:#6a788f">${escapeHtml(p.category)}${p.address ? " · " + escapeHtml(p.address) : ""}</div>`,
        { direction: "top", offset: [0, -4], opacity: 1, className: "daymap-tip" },
      );
      marker.on("click", () => {
        setSelectedId(p.id);
        document.getElementById(`place-card-${p.id}`)?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
      });
      marker.addTo(layer);
    });
    layer.addTo(map);
    searchLayerRef.current = layer;

    // Frame results together with the itinerary stops.
    const all = [...stopBoundsRef.current, ...results.map((p) => [p.lat, p.lng] as [number, number])];
    map.fitBounds(L.latLngBounds(all), { padding: [56, 56], maxZoom: 15 });
  }, [results, selectedId, mapEpoch]);

  /* ── Search + insights + ranking (seq-guarded) ────────────────────── */

  async function runSearch() {
    const q = query.trim();
    if (q.length < 2 || searching) return;
    const seq = ++searchSeq.current;
    setSearching(true);
    setSearchError("");
    setRank(null);
    setSelectedId(null);
    try {
      const res = await fetch(`/api/places?q=${encodeURIComponent(q)}&near=${encodeURIComponent(destination)}`);
      const data = await res.json();
      if (seq !== searchSeq.current) return; // stale
      if (!res.ok) {
        setSearchError(data?.error || "Search failed — try again.");
        return;
      }
      const found: DayMapPlace[] = data?.results ?? [];
      setResults(found);
      if (found.length === 0) {
        setSearchError("No places found — try a broader query or add the city name.");
        return;
      }
      void loadInsights(found, seq);
    } catch {
      if (seq === searchSeq.current) setSearchError("Search failed — check your connection.");
    } finally {
      if (seq === searchSeq.current) setSearching(false);
    }
  }

  async function loadInsights(places: DayMapPlace[], seq: number) {
    // Serve cached reviews instantly; only ask the model for the missing ones.
    const cached: Record<string, PlaceInsight> = {};
    const missing = places.filter((p) => {
      const hit = insightCache.get(p.id);
      if (hit) cached[p.id] = hit;
      return !hit;
    });
    setInsights(cached);
    if (missing.length === 0) return;

    setInsightsLoading(true);
    try {
      const res = await fetch("/api/ai/place-insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          places: missing.map((p) => ({ id: p.id, name: p.name, category: p.category, address: p.address })),
        }),
      });
      const data = await res.json();
      if (seq !== searchSeq.current) return; // user searched again meanwhile
      if (res.ok && Array.isArray(data?.places)) {
        const next = { ...cached };
        for (const ins of data.places as PlaceInsight[]) {
          next[ins.id] = ins;
          insightCache.set(ins.id, ins);
        }
        setInsights(next);
      }
    } catch {
      /* reviews stay hidden — non-fatal */
    } finally {
      if (seq === searchSeq.current) setInsightsLoading(false);
    }
  }

  async function runRank() {
    if (results.length === 0 || ranking) return;
    const seq = searchSeq.current;
    setRanking(true);
    try {
      const res = await fetch("/api/ai/place-rank", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: query.trim() || destination,
          places: results.map((p) => {
            const ins = insights[p.id];
            return {
              id: p.id, name: p.name, category: p.category, address: p.address,
              rating: ins?.rating ?? null,
              reviewCount: ins?.reviewCount ?? null,
              reviewSnippets: ins?.reviews?.slice(0, 2).map((r) => r.text) ?? null,
            };
          }),
        }),
      });
      const data = await res.json();
      if (seq !== searchSeq.current) return; // results changed underneath
      if (res.ok && Array.isArray(data?.rankings) && data.rankings.length > 0) {
        setRank(data as RankResult);
      } else {
        setSearchError(data?.error || "AI ranking unavailable right now.");
      }
    } catch {
      if (seq === searchSeq.current) setSearchError("AI ranking unavailable right now.");
    } finally {
      if (seq === searchSeq.current) setRanking(false);
    }
  }

  function clearSearch() {
    searchSeq.current++;
    setQuery("");
    setResults([]);
    setInsights({});
    setInsightsLoading(false);
    setSelectedId(null);
    setRank(null);
    setRanking(false);
    setSearching(false);
    setSearchError("");
    const map = mapRef.current;
    const L = leafletRef.current;
    if (searchLayerRef.current) {
      searchLayerRef.current.remove();
      searchLayerRef.current = null;
    }
    if (map && L && stopBoundsRef.current.length > 0) {
      map.fitBounds(L.latLngBounds(stopBoundsRef.current), { padding: [50, 50], maxZoom: 15 });
    }
  }

  function focusPlace(p: DayMapPlace) {
    setSelectedId(p.id);
    mapRef.current?.setView([p.lat, p.lng], 16, { animate: true });
  }

  function addPlace(p: DayMapPlace) {
    if (!onAddStop || addedIds.has(p.id)) return;
    onAddStop({ name: p.name, address: p.address, category: p.category });
    setAddedIds((prev) => new Set(prev).add(p.id));
  }

  const rankedIds = useMemo(
    () => new Map((rank?.rankings ?? []).map((r) => [r.placeId, r.rank])),
    [rank],
  );

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border/60 shadow-sm">
      {/* Pulse animation for search pins */}
      <style>{`
        @keyframes daymap-pulse {
          0% { transform: scale(0.7); opacity: 0.55; }
          70% { transform: scale(1.7); opacity: 0; }
          100% { transform: scale(1.7); opacity: 0; }
        }
      `}</style>

      <div className="relative">
        <div ref={containerRef} className="h-[380px] w-full" style={{ background: "#e8ecef" }} />

        {/* Search bar */}
        <form
          onSubmit={(e) => { e.preventDefault(); void runSearch(); }}
          className="absolute right-3 top-3 z-[600] flex w-[min(320px,70%)] items-center gap-1.5 rounded-full border border-white/70 bg-white/95 py-1.5 pl-3 pr-1.5 shadow-[0_14px_34px_-18px_rgba(20,47,43,0.55)] backdrop-blur"
        >
          <Search size={13} className="shrink-0 text-[#7c3aed]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search location — e.g. coffee shops near Ludwigsburg"
            className="min-w-0 flex-1 bg-transparent text-xs font-semibold text-foreground outline-none placeholder:text-muted/50"
          />
          {(query || results.length > 0) && (
            <button
              type="button"
              onClick={clearSearch}
              title="Clear search"
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-muted hover:bg-shore-100 hover:text-foreground cursor-pointer"
            >
              <X size={12} />
            </button>
          )}
          <button
            type="submit"
            disabled={searching || query.trim().length < 2}
            className="flex h-7 shrink-0 items-center gap-1 rounded-full bg-[#7c3aed] px-3 text-[11px] font-bold text-white transition-all hover:bg-[#6d28d9] disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
          >
            {searching ? <Loader2 size={12} className="animate-spin" /> : "Go"}
          </button>
        </form>

        {/* AI opinion trigger */}
        {results.length > 0 && !rank && (
          <button
            onClick={() => void runRank()}
            disabled={ranking}
            className="absolute right-3 top-14 z-[600] flex items-center gap-1.5 rounded-full border border-white/60 bg-gradient-to-r from-[#7c3aed] to-[#e76f51] px-3 py-1.5 text-[11px] font-black text-white shadow-[0_14px_30px_-16px_rgba(124,58,237,0.8)] transition-all hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
          >
            {ranking ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
            {ranking ? "Judging the spots…" : "AI opinion"}
          </button>
        )}

        {/* Stats chips */}
        {status === "ready" && meta.pins > 0 && (
          <div className="pointer-events-none absolute left-3 bottom-3 z-[500] flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-border/60 bg-white/95 px-2.5 py-1 text-[11px] font-bold text-foreground shadow-sm">
              {meta.pins} stop{meta.pins !== 1 ? "s" : ""}
            </span>
            {meta.distanceKm != null && (
              <span className="flex items-center gap-1 rounded-full border border-border/60 bg-white/95 px-2.5 py-1 text-[11px] font-semibold text-muted shadow-sm">
                <RouteIcon size={11} className="text-accent-500" /> {meta.distanceKm} km
                {meta.durationMin != null && <> · {meta.durationMin} min drive</>}
              </span>
            )}
          </div>
        )}

        {/* AI ranking overlay */}
        {rank && (
          <div className="absolute inset-0 z-[650] flex items-stretch justify-end bg-gradient-to-l from-[#17103a]/70 via-[#17103a]/35 to-transparent p-3">
            <div className="flex w-[min(340px,92%)] flex-col overflow-hidden rounded-2xl border border-white/25 bg-[#170f2e]/92 text-white shadow-2xl backdrop-blur-xl">
              <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-[#7c3aed] to-[#e76f51]">
                    <Sparkles size={14} />
                  </span>
                  <div>
                    <p className="text-xs font-black leading-tight">AI verdict</p>
                    <p className="text-[9px] font-semibold uppercase tracking-wider text-white/50">
                      {rank.source === "AI" ? "local model" : "rating-based fallback"}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setRank(null)}
                  title="Dismiss"
                  className="flex h-7 w-7 items-center justify-center rounded-full text-white/70 hover:bg-white/10 hover:text-white cursor-pointer"
                >
                  <X size={14} />
                </button>
              </div>
              <div className="flex-1 space-y-2.5 overflow-y-auto px-4 py-3">
                {rank.summary && (
                  <p className="text-[11px] italic leading-relaxed text-white/75">“{rank.summary}”</p>
                )}
                {rank.rankings.map((r) => {
                  const place = results.find((p) => p.id === r.placeId);
                  return (
                    <button
                      key={r.placeId}
                      onClick={() => place && focusPlace(place)}
                      className="w-full rounded-xl border border-white/12 bg-white/[0.06] px-3 py-2.5 text-left transition-colors hover:bg-white/[0.12] cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-lg leading-none">{MEDALS[r.rank - 1] ?? "•"}</span>
                        <span className="min-w-0 flex-1 truncate text-xs font-black">{r.name}</span>
                        {place && addedIds.has(place.id) && <Check size={12} className="text-emerald-400" />}
                      </div>
                      <p className="mt-1.5 text-[11px] leading-relaxed text-white/70">{r.reason}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Base-map overlays */}
        {status === "loading" && (
          <div className="absolute inset-0 z-[500] flex flex-col items-center justify-center gap-2 bg-shore-50/80 backdrop-blur-sm">
            <Loader2 size={22} className="animate-spin text-accent-500" />
            <p className="text-xs font-semibold text-foreground">Mapping your day…</p>
            <p className="text-[10px] text-muted">Placing stops & tracing the route</p>
          </div>
        )}
        {status === "ready" && meta.pins === 0 && results.length === 0 && (
          <div className="pointer-events-none absolute inset-x-0 bottom-3 z-[400] flex justify-center">
            <span className="flex items-center gap-1.5 rounded-full border border-border/60 bg-white/95 px-3 py-1.5 text-[11px] font-semibold text-muted shadow-sm">
              <Navigation size={11} className="text-[#7c3aed]" /> No stops yet — search above to explore & add places
            </span>
          </div>
        )}
        {status === "error" && (
          <div className="absolute inset-0 z-[500] flex flex-col items-center justify-center gap-2 bg-shore-50/90 text-center px-6">
            <MapPinOff size={22} className="text-muted/60" />
            <p className="text-xs font-semibold text-foreground">Couldn’t place these stops</p>
            <p className="text-[10px] text-muted">Try more specific location names (e.g. add the city).</p>
          </div>
        )}
      </div>

      {/* Search error strip */}
      {searchError && (
        <div className="border-t border-amber-200 bg-amber-50 px-4 py-2 text-[11px] font-semibold text-amber-800">
          {searchError}
        </div>
      )}

      {/* Result cards */}
      {results.length > 0 && (
        <div className="border-t border-border/50 bg-[linear-gradient(180deg,#faf7ff_0%,#ffffff_100%)] px-3 py-3">
          <div className="mb-2 flex items-center justify-between px-1">
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#7c3aed]">
              {results.length} place{results.length !== 1 ? "s" : ""} found
            </p>
            {insightsLoading && (
              <span className="flex items-center gap-1 text-[10px] font-semibold text-muted">
                <Loader2 size={10} className="animate-spin" /> AI is reading the reviews…
              </span>
            )}
          </div>
          <div className="flex gap-2.5 overflow-x-auto pb-1">
            {results.map((p, i) => {
              const ins = insights[p.id];
              const isSelected = p.id === selectedId;
              const isAdded = addedIds.has(p.id);
              const medalRank = rankedIds.get(p.id);
              return (
                <div
                  key={p.id}
                  id={`place-card-${p.id}`}
                  onClick={() => focusPlace(p)}
                  className={`w-[248px] shrink-0 cursor-pointer rounded-xl border bg-white p-3 transition-all ${
                    isSelected
                      ? "border-[#7c3aed] shadow-[0_14px_30px_-18px_rgba(124,58,237,0.7)]"
                      : "border-border/60 shadow-sm hover:border-[#c4b5fd] hover:shadow-md"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[#7c3aed] text-[11px] font-black text-white">
                      {LETTERS[i] ?? "?"}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-xs font-black text-foreground">{p.name}</span>
                    {medalRank && <span className="text-sm leading-none">{MEDALS[medalRank - 1]}</span>}
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <span className="rounded-full bg-[#ede9fe] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[#6d28d9]">
                      {p.category}
                    </span>
                    {p.address && <span className="truncate text-[10px] text-muted">{p.address}</span>}
                  </div>

                  {/* Rating + reviews */}
                  {ins ? (
                    <>
                      <div className="mt-2 flex items-center gap-1.5">
                        <span className="flex items-center gap-0.5">
                          {[1, 2, 3, 4, 5].map((s) => (
                            <Star
                              key={s}
                              size={11}
                              className={s <= Math.round(ins.rating) ? "fill-amber-400 text-amber-400" : "text-shore-200"}
                            />
                          ))}
                        </span>
                        <span className="text-[11px] font-black text-foreground">{ins.rating.toFixed(1)}</span>
                        <span className="text-[10px] text-muted">({ins.reviewCount})</span>
                      </div>
                      <div className="mt-1.5 space-y-1.5">
                        {ins.reviews.slice(0, 2).map((r, ri) => (
                          <div key={ri} className="rounded-lg bg-shore-50/70 px-2 py-1.5">
                            <p className="flex items-center gap-1 text-[9px] font-bold text-foreground/70">
                              <MessageSquareQuote size={9} className="text-[#7c3aed]" />
                              {r.author} · {"★".repeat(Math.max(1, Math.min(5, r.rating)))} · {r.when}
                            </p>
                            <p className="mt-0.5 line-clamp-2 text-[10px] leading-snug text-muted">{r.text}</p>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : insightsLoading ? (
                    <div className="mt-2 space-y-1.5">
                      <div className="h-3 w-24 animate-pulse rounded bg-shore-100" />
                      <div className="h-8 animate-pulse rounded-lg bg-shore-100/80" />
                    </div>
                  ) : (
                    <p className="mt-2 text-[10px] italic text-muted/70">Reviews unavailable</p>
                  )}

                  {/* Add */}
                  {onAddStop && (
                    <button
                      onClick={(e) => { e.stopPropagation(); addPlace(p); }}
                      disabled={isAdded}
                      className={`mt-2.5 flex w-full items-center justify-center gap-1 rounded-lg py-1.5 text-[11px] font-bold transition-colors cursor-pointer ${
                        isAdded
                          ? "cursor-default border border-emerald-300 bg-emerald-50 text-emerald-700"
                          : "bg-[#7c3aed] text-white hover:bg-[#6d28d9]"
                      }`}
                    >
                      {isAdded ? <><Check size={12} /> Added to day</> : <><Plus size={12} /> Add to day</>}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Marker / decoration HTML ─────────────────────────────────────── */
function pinHtml(n: number): string {
  return `<div style="position:relative;width:34px;height:44px;filter:drop-shadow(0 3px 4px rgba(20,47,43,.35))">
    <svg width="34" height="44" viewBox="0 0 34 44" xmlns="http://www.w3.org/2000/svg">
      <path d="M17 1C8.2 1 1 8 1 16.7 1 28.5 17 43 17 43s16-14.5 16-26.3C33 8 25.8 1 17 1z" fill="${ACCENT}" stroke="#fff" stroke-width="1.5"/>
      <circle cx="17" cy="16.5" r="10.5" fill="#fff"/>
    </svg>
    <span style="position:absolute;top:6.5px;left:0;width:34px;text-align:center;font:800 13px system-ui,sans-serif;color:${ACCENT_DARK}">${n}</span>
  </div>`;
}

function searchPinHtml(letter: string, selected: boolean): string {
  const w = selected ? 40 : 34;
  const h = selected ? 50 : 44;
  const fill = selected ? SEARCH_PIN_DARK : SEARCH_PIN;
  return `<div style="position:relative;width:${w}px;height:${h}px;filter:drop-shadow(0 3px 5px rgba(76,29,149,.4))">
    <span style="position:absolute;left:50%;top:38%;width:26px;height:26px;margin:-13px 0 0 -13px;border-radius:50%;background:${fill};animation:daymap-pulse 1.8s ease-out infinite"></span>
    <svg style="position:relative" width="${w}" height="${h}" viewBox="0 0 34 44" xmlns="http://www.w3.org/2000/svg">
      <path d="M17 1C8.2 1 1 8 1 16.7 1 28.5 17 43 17 43s16-14.5 16-26.3C33 8 25.8 1 17 1z" fill="${fill}" stroke="#fff" stroke-width="1.5"/>
      <circle cx="17" cy="16.5" r="10.5" fill="#fff"/>
    </svg>
    <span style="position:absolute;top:${selected ? "17%" : "15%"};left:0;width:${w}px;text-align:center;font:800 ${selected ? 15 : 13}px system-ui,sans-serif;color:${fill}">${escapeHtml(letter)}</span>
  </div>`;
}

function arrowPinHtml(deg: number): string {
  return `<div style="position:relative;width:40px;height:48px;filter:drop-shadow(0 4px 5px rgba(20,47,43,.42))">
    <svg width="40" height="48" viewBox="0 0 40 48" xmlns="http://www.w3.org/2000/svg">
      <path d="M20 1C10 1 2 8.6 2 18.4 2 31.7 20 47 20 47s18-15.3 18-28.6C38 8.6 30 1 20 1z" fill="${END}" stroke="#fff" stroke-width="1.6"/>
      <circle cx="20" cy="18.5" r="12" fill="#fff"/>
    </svg>
    <span style="position:absolute;top:8px;left:8px;width:24px;height:24px;display:flex;align-items:center;justify-content:center;transform:rotate(${deg}deg)">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M8 1.5 14 14 8 11 2 14 8 1.5z" fill="${END}"/>
      </svg>
    </span>
  </div>`;
}

function chevronHtml(deg: number): string {
  return `<div style="width:18px;height:18px;display:flex;align-items:center;justify-content:center;transform:rotate(${deg}deg)">
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M6 1.5 10.5 8.5H1.5L6 1.5z" fill="${ACCENT}" fill-opacity="0.9" stroke="#fff" stroke-width="0.8"/>
    </svg>
  </div>`;
}

function tooltipHtml(r: Resolved, n: number, total: number): string {
  const time = r.time ? `${escapeHtml(r.time)} · ` : "";
  return `<div style="min-width:120px;max-width:210px;padding:1px 2px">
    <div style="font:800 12px system-ui,sans-serif;color:#17211f;line-height:1.25">${escapeHtml(r.title)}</div>
    <div style="font:600 10px system-ui,sans-serif;color:#6a788f;margin-top:2px">${time}is planned here · stop ${n} of ${total}</div>
  </div>`;
}

/* ── Geometry ─────────────────────────────────────────────────────── */
function bearing(a: [number, number], b: [number, number]): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;
  const dLon = toRad(b[1] - a[1]);
  const y = Math.sin(dLon) * Math.cos(toRad(b[0]));
  const x = Math.cos(toRad(a[0])) * Math.sin(toRad(b[0])) - Math.sin(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.cos(dLon);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c,
  );
}
