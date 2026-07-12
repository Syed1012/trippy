"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import type * as LeafletTypes from "leaflet";
import { Loader2, Navigation, MapPinOff, Route as RouteIcon } from "lucide-react";

export interface DayMapStop {
  title: string;
  location: string;
  time?: string;
}

interface Resolved {
  title: string;
  time?: string;
  lat: number;
  lng: number;
}

const ACCENT = "#e76f51";
const ACCENT_DARK = "#c2410c";
const END = "#123d36";

/**
 * Renders the day's activity locations on an OpenStreetMap (Leaflet) map:
 * numbered 📍 pins in planned order, a route line that follows the actual
 * roads (OSRM) with directional chevrons, and an arrowhead resting on the
 * final destination. Hovering a pin shows what's planned there.
 */
export default function DayMap({ destination, stops }: { destination: string; stops: DayMapStop[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "empty" | "error">("loading");
  const [meta, setMeta] = useState<{ pins: number; distanceKm: number | null; durationMin: number | null }>({
    pins: 0,
    distanceKm: null,
    durationMin: null,
  });

  // Only re-map when the set/order of locations changes — not on every title keystroke.
  const signature = useMemo(
    () => stops.map((s) => s.location.trim().toLowerCase()).filter(Boolean).join(">>"),
    [stops],
  );
  const stopsRef = useRef(stops);
  stopsRef.current = stops;

  useEffect(() => {
    let cancelled = false;
    let map: LeafletTypes.Map | null = null;

    (async () => {
      const active = stopsRef.current.filter((s) => s.location.trim());
      if (active.length === 0) {
        setStatus("empty");
        return;
      }
      setStatus("loading");

      // 1) Geocode the location strings (biased by the destination).
      let resolved: Resolved[] = [];
      try {
        const res = await fetch("/api/geocode", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ near: destination, queries: active.map((s) => s.location) }),
        });
        const data = await res.json();
        const results: ({ lat: number; lng: number } | null)[] = data?.results ?? [];
        resolved = active
          .map((s, i): Resolved | null => {
            const r = results[i];
            return r ? { title: s.title || "Untitled activity", time: s.time, lat: r.lat, lng: r.lng } : null;
          })
          .filter((r): r is Resolved => r !== null);
      } catch {
        /* fall through to error state */
      }
      if (cancelled) return;
      if (resolved.length === 0) {
        setStatus("error");
        return;
      }

      // 2) Load Leaflet (client-only) and init the map.
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

      // 3) Road-following route + arrow decorations (only when 2+ stops).
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
          /* fall back to straight segments */
        }
        if (cancelled || !map) return;

        // White casing under a coloured line for legibility over any basemap.
        L.polyline(routeLine, { color: "#ffffff", weight: 7, opacity: 0.9, lineJoin: "round", lineCap: "round" }).addTo(map);
        L.polyline(routeLine, { color: ACCENT, weight: 4, opacity: 0.95, lineJoin: "round", lineCap: "round" }).addTo(map);

        // Directional chevrons sampled along the path — "arrow passing through".
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

      // 4) Pins — numbered for every stop, the last one an arrowhead pointing in.
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
            direction: "top",
            offset: [0, -4],
            opacity: 1,
            className: "daymap-tip",
          });
      });

      // 5) Frame all stops.
      map.fitBounds(L.latLngBounds(points), { padding: [50, 50], maxZoom: 15 });

      setMeta({ pins: resolved.length, distanceKm, durationMin });
      setStatus("ready");
      // Correct sizing once the section has finished opening.
      window.setTimeout(() => { if (!cancelled && map) map.invalidateSize(); }, 260);
    })();

    return () => {
      cancelled = true;
      if (map) {
        map.remove();
        map = null;
      }
    };
  }, [signature, destination]);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border/60 shadow-sm">
      <div ref={containerRef} className="h-[380px] w-full" style={{ background: "#e8ecef" }} />

      {/* Legend / stats chip */}
      {status === "ready" && (
        <div className="pointer-events-none absolute left-3 top-3 z-[500] flex flex-wrap items-center gap-2">
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

      {/* Overlays */}
      {status === "loading" && (
        <div className="absolute inset-0 z-[500] flex flex-col items-center justify-center gap-2 bg-shore-50/80 backdrop-blur-sm">
          <Loader2 size={22} className="animate-spin text-accent-500" />
          <p className="text-xs font-semibold text-foreground">Mapping your day…</p>
          <p className="text-[10px] text-muted">Placing stops & tracing the route</p>
        </div>
      )}
      {status === "empty" && (
        <div className="absolute inset-0 z-[500] flex flex-col items-center justify-center gap-2 bg-shore-50/90 text-center px-6">
          <Navigation size={22} className="text-muted/60" />
          <p className="text-xs font-semibold text-foreground">Add locations to see the day mapped</p>
          <p className="text-[10px] text-muted">Open an activity’s Details and fill in a place.</p>
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
