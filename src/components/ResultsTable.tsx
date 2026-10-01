"use client";

import type { ParityComparison, ParityRow } from "@/lib/parity";
import { formatPct, formatUsd } from "@/lib/parity";

type Props = {
  comparison: ParityComparison;
  selectedIssuer: string | null;
  onSelect: (issuer: string) => void;
};

function PremiumCell({ row }: { row: ParityRow }) {
  if (row.premiumVsClosePct == null) {
    return <span className="text-slate-500">—</span>;
  }
  const up = row.premiumVsClosePct >= 0;
  return (
    <span
      className={
        up
          ? "font-medium text-amber-400 number-tick"
          : "font-medium text-emerald-400 number-tick"
      }
      title={
        row.premiumVsCloseUsd != null
          ? `${formatUsd(row.premiumVsCloseUsd)} vs close`
          : undefined
      }
    >
      {formatPct(row.premiumVsClosePct)}
    </span>
  );
}

function TradeableBadge({ row }: { row: ParityRow }) {
  if (row.tradeableNow) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-400 ring-1 ring-inset ring-emerald-500/25">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
        Open now
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full bg-white/5 px-2 py-0.5 text-xs font-medium text-slate-400 ring-1 ring-inset ring-white/10"
      title={row.tradeableReason}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-slate-500" />
      Closed
    </span>
  );
}

export function ResultsTable({ comparison, selectedIssuer, onSelect }: Props) {
  const { rows, marketClose, summary } = comparison;

  return (
    <div className="space-y-4 route-enter">
      <div className="glass-strong rounded-2xl border border-[#f3ba2f]/20 px-4 py-3 text-sm text-slate-100">
        <p className="font-medium text-white">{summary}</p>
        {marketClose && (
          <p className="mt-1 text-slate-400 text-xs">
            Reference: last {marketClose.sessionLabel} for {marketClose.ticker}{" "}
            was {formatUsd(marketClose.closeUsd)} (
            {new Date(marketClose.asOf).toLocaleString(undefined, {
              dateStyle: "medium",
              timeStyle: "short",
              timeZone: "America/New_York",
            })}{" "}
            ET)
          </p>
        )}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block overflow-hidden rounded-2xl glass shadow-lg shadow-black/20">
        <table className="w-full text-left text-sm">
          <thead className="bg-white/[0.03] text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Issuer</th>
              <th className="px-4 py-3 font-medium">Can trade?</th>
              <th className="px-4 py-3 font-medium">Price / share</th>
              <th className="px-4 py-3 font-medium">vs last close</th>
              <th className="px-4 py-3 font-medium">Liquidity</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {rows.map((row, i) => (
              <tr
                key={row.issuer}
                className={`animate-fade-up stagger-${i + 1} ${
                  row.isBestRoute
                    ? "best-glow bg-[#f3ba2f]/[0.06]"
                    : selectedIssuer === row.issuer
                      ? "bg-white/[0.04]"
                      : "bg-transparent"
                }`}
              >
                <td className="px-4 py-3.5">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-white">
                      {row.displayName}
                    </span>
                    {row.isBestRoute && (
                      <span className="rounded-full bg-gradient-to-r from-[#f3ba2f] to-[#e8a017] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#0b1220]">
                        Best route
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {row.tokenSymbol}
                    {row.tokensPerShare !== 1
                      ? ` · ${row.tokensPerShare} tokens = 1 share`
                      : ""}
                  </p>
                </td>
                <td className="px-4 py-3.5">
                  <TradeableBadge row={row} />
                  {!row.tradeableNow && row.tradeableReason && (
                    <p className="mt-1 text-xs text-slate-500 max-w-[160px]">
                      {row.tradeableReason}
                    </p>
                  )}
                </td>
                <td className="px-4 py-3.5 font-semibold tabular-nums text-white number-tick">
                  {formatUsd(row.pricePerShare)}
                </td>
                <td className="px-4 py-3.5 tabular-nums">
                  <PremiumCell row={row} />
                </td>
                <td className="px-4 py-3.5">
                  <p className="capitalize text-slate-300">{row.liquidity}</p>
                  <p className="text-xs text-slate-500 max-w-[180px]">
                    {row.liquidityNote}
                  </p>
                </td>
                <td className="px-4 py-3.5 text-right">
                  <button
                    type="button"
                    disabled={!row.tradeableNow}
                    onClick={() => onSelect(row.issuer)}
                    className="btn-press rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:border-[#f3ba2f]/50 hover:text-[#f3ba2f] disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {selectedIssuer === row.issuer ? "Selected" : "Select"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {rows.map((row, i) => (
          <button
            key={row.issuer}
            type="button"
            disabled={!row.tradeableNow}
            onClick={() => onSelect(row.issuer)}
            className={`btn-press animate-fade-up stagger-${i + 1} w-full text-left rounded-2xl glass p-4 disabled:opacity-60 ${
              row.isBestRoute
                ? "best-glow border-[#f3ba2f]/35"
                : selectedIssuer === row.issuer
                  ? "border-white/25"
                  : ""
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold text-white">{row.displayName}</p>
                <p className="text-xs text-slate-500">{row.tokenSymbol}</p>
              </div>
              {row.isBestRoute && (
                <span className="rounded-full bg-gradient-to-r from-[#f3ba2f] to-[#e8a017] px-2 py-0.5 text-[10px] font-bold uppercase text-[#0b1220]">
                  Best
                </span>
              )}
            </div>
            <div className="mt-3 flex flex-wrap gap-3 text-sm">
              <TradeableBadge row={row} />
              <span className="font-semibold tabular-nums text-white">
                {formatUsd(row.pricePerShare)}
                <span className="font-normal text-slate-500"> / share</span>
              </span>
              <PremiumCell row={row} />
            </div>
            <p className="mt-2 text-xs text-slate-500">{row.liquidityNote}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
