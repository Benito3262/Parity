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
    return <span className="text-slate-400">—</span>;
  }
  const up = row.premiumVsClosePct >= 0;
  return (
    <span
      className={
        up
          ? "font-medium text-amber-700"
          : "font-medium text-emerald-700"
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
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        Open now
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 ring-1 ring-inset ring-slate-500/10"
      title={row.tradeableReason}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
      Closed
    </span>
  );
}

export function ResultsTable({ comparison, selectedIssuer, onSelect }: Props) {
  const { rows, marketClose, summary } = comparison;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 px-4 py-3 text-sm text-emerald-950">
        <p className="font-medium">{summary}</p>
        {marketClose && (
          <p className="mt-1 text-emerald-800/80 text-xs">
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
      <div className="hidden md:block overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Issuer</th>
              <th className="px-4 py-3 font-medium">Can trade?</th>
              <th className="px-4 py-3 font-medium">Price / share</th>
              <th className="px-4 py-3 font-medium">vs last close</th>
              <th className="px-4 py-3 font-medium">Liquidity</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => (
              <tr
                key={row.issuer}
                className={
                  row.isBestRoute
                    ? "bg-emerald-50/40"
                    : selectedIssuer === row.issuer
                      ? "bg-slate-50"
                      : "bg-white"
                }
              >
                <td className="px-4 py-3.5">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-900">
                      {row.displayName}
                    </span>
                    {row.isBestRoute && (
                      <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                        Best route
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {row.tokenSymbol}
                    {row.tokensPerShare !== 1
                      ? ` · ${row.tokensPerShare} tokens = 1 share`
                      : ""}
                  </p>
                </td>
                <td className="px-4 py-3.5">
                  <TradeableBadge row={row} />
                  {!row.tradeableNow && row.tradeableReason && (
                    <p className="mt-1 text-xs text-slate-400 max-w-[160px]">
                      {row.tradeableReason}
                    </p>
                  )}
                </td>
                <td className="px-4 py-3.5 font-semibold tabular-nums text-slate-900">
                  {formatUsd(row.pricePerShare)}
                </td>
                <td className="px-4 py-3.5 tabular-nums">
                  <PremiumCell row={row} />
                </td>
                <td className="px-4 py-3.5">
                  <p className="capitalize text-slate-700">{row.liquidity}</p>
                  <p className="text-xs text-slate-400 max-w-[180px]">
                    {row.liquidityNote}
                  </p>
                </td>
                <td className="px-4 py-3.5 text-right">
                  <button
                    type="button"
                    disabled={!row.tradeableNow}
                    onClick={() => onSelect(row.issuer)}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-emerald-500 hover:text-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
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
        {rows.map((row) => (
          <button
            key={row.issuer}
            type="button"
            disabled={!row.tradeableNow}
            onClick={() => onSelect(row.issuer)}
            className={`w-full text-left rounded-2xl border p-4 shadow-sm transition-colors disabled:opacity-60 ${
              row.isBestRoute
                ? "border-emerald-300 bg-emerald-50/50"
                : selectedIssuer === row.issuer
                  ? "border-slate-400 bg-white"
                  : "border-slate-200 bg-white"
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold text-slate-900">{row.displayName}</p>
                <p className="text-xs text-slate-400">{row.tokenSymbol}</p>
              </div>
              {row.isBestRoute && (
                <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold uppercase text-white">
                  Best
                </span>
              )}
            </div>
            <div className="mt-3 flex flex-wrap gap-3 text-sm">
              <TradeableBadge row={row} />
              <span className="font-semibold tabular-nums">
                {formatUsd(row.pricePerShare)}
                <span className="font-normal text-slate-400"> / share</span>
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
