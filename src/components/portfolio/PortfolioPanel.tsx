"use client";

import Link from "next/link";

/** Mock holdings until live tokenized-stock balances are wired. */
const MOCK_HOLDINGS = [
  {
    ticker: "NVDA",
    issuer: "xStocks",
    shares: 0.12,
    valueUsd: 14.4,
    note: "Mock",
  },
  {
    ticker: "AAPL",
    issuer: "Ondo",
    shares: 0.05,
    valueUsd: 11.2,
    note: "Mock",
  },
];

type Props = {
  /** When true, show sample rows. When false, empty state only. */
  showMock?: boolean;
};

export function PortfolioPanel({ showMock = true }: Props) {
  const rows = showMock ? MOCK_HOLDINGS : [];
  const total = rows.reduce((sum, r) => sum + r.valueUsd, 0);

  return (
    <div className="glass rounded-2xl p-5 sm:p-6 animate-fade-up stagger-1 space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-white">Portfolio</h2>
          <p className="mt-1 text-sm text-slate-400">
            Tokenized stock holdings on BNB Chain.
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Est. value
          </p>
          <p className="text-xl font-semibold tabular-nums text-white">
            ${total.toFixed(2)}
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-200/90 leading-relaxed">
        <strong className="font-semibold">Mock data</strong> — balances are
        placeholders until the live tokenized-stocks API / on-chain reads are
        connected. Do not treat these as real positions.
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-10 text-center">
          <p className="text-sm font-medium text-slate-300">No holdings yet</p>
          <p className="mt-1 text-xs text-slate-500">
            Compare issuers and buy spot on the trade flow.
          </p>
          <Link
            href="/trade"
            className="btn-press btn-gold mt-4 inline-flex rounded-full px-4 py-2 text-sm"
          >
            Buy stock
          </Link>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-white/5">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-white/5 text-[10px] uppercase tracking-wider text-slate-500">
                <th className="px-3 py-2.5 font-semibold">Ticker</th>
                <th className="px-3 py-2.5 font-semibold">Issuer</th>
                <th className="px-3 py-2.5 font-semibold text-right">Shares</th>
                <th className="px-3 py-2.5 font-semibold text-right">Value</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={`${row.ticker}-${row.issuer}`}
                  className="border-b border-white/[0.04] last:border-0"
                >
                  <td className="px-3 py-3">
                    <span className="font-semibold text-white">{row.ticker}</span>
                    <span className="ml-2 rounded-full bg-white/5 px-1.5 py-0.5 text-[10px] text-slate-500">
                      {row.note}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-slate-400">{row.issuer}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-slate-300">
                    {row.shares.toFixed(4)}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums text-slate-200">
                    ${row.valueUsd.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex flex-wrap gap-2 pt-1">
        <Link
          href="/trade"
          className="btn-press rounded-full border border-[#f3ba2f]/30 bg-[#f3ba2f]/10 px-4 py-2 text-xs font-semibold text-[#f3ba2f]"
        >
          Open buy flow
        </Link>
      </div>
    </div>
  );
}
