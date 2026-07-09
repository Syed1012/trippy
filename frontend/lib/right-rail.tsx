"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

/**
 * Coordinates a resizable right-hand rail (e.g. the AI Itinerary Studio drawer)
 * with the dashboard shell. Pages push how much horizontal space to reserve on
 * the right; the shell's <main> reflows to fill the remaining left area instead
 * of shrinking a centered column. `dragging` lets the shell drop its transition
 * so live resizing stays smooth.
 */
interface RightRailValue {
  /** Pixels reserved on the right edge for the rail (0 = none). */
  reserve: number;
  /** True while the user is actively dragging the rail handle. */
  dragging: boolean;
  setReserve: (px: number) => void;
  setDragging: (value: boolean) => void;
}

const RightRailContext = createContext<RightRailValue | null>(null);

export function RightRailProvider({ children }: { children: ReactNode }) {
  const [reserve, setReserve] = useState(0);
  const [dragging, setDragging] = useState(false);
  return (
    <RightRailContext.Provider value={{ reserve, dragging, setReserve, setDragging }}>
      {children}
    </RightRailContext.Provider>
  );
}

/** Safe no-op fallback when used outside a provider. */
export function useRightRail(): RightRailValue {
  return (
    useContext(RightRailContext) ?? {
      reserve: 0,
      dragging: false,
      setReserve: () => {},
      setDragging: () => {},
    }
  );
}
