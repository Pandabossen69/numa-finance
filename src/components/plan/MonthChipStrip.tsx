"use client";

import { type ReactNode } from "react";
import { ChipStrip } from "@/components/ui/ChipStrip";

/**
 * Month chips with reserved ‹/› flex slots (never over glyphs).
 * Partial pills get `is-clipped` via React className (DOM classList was wiped
 * on parent re-render). Overflow defaults true so phone widths never flash a
 * mid-glyph before measure.
 */
export function MonthChipStrip({ children }: { children: ReactNode }) {
  return (
    <ChipStrip
      startLabel="Föregående månader"
      endLabel="Nästa månader"
      activeSelector=".numa-month-chip.is-active"
    >
      {children}
    </ChipStrip>
  );
}
