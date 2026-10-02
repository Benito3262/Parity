"use client";

import { driftBadgeText } from "@/lib/parity";
import type { ParityComparison, ParityRow } from "@/lib/parity";

export function DriftBadge({
  row,
  comparison,
}: {
  row: ParityRow;
  comparison: ParityComparison;
}) {
  // Rising/falling from this token's premium vs last close over time —
  // not the underlying stock's day-to-day move.
  const text = driftBadgeText({
    premiumVsClosePct: row.premiumVsClosePct,
    closeWeekdayLabel: comparison.closeWeekdayLabel,
    direction: row.premiumDirection ?? null,
    marketClosed: comparison.marketClosed,
  });
  if (!text) return null;
  const high =
    row.premiumVsClosePct != null && row.premiumVsClosePct >= 1.5;
  return (
    <p
      className={`mt-2 text-xs leading-relaxed ${
        high ? "text-amber-300" : "text-slate-400"
      }`}
    >
      <span className="inline-flex items-center rounded-full bg-white/5 px-2 py-0.5 ring-1 ring-inset ring-white/10 mr-1.5">
        Drift
      </span>
      {text}
    </p>
  );
}
