"use client";

import { FormEvent, useState } from "react";

type Props = {
  initialTicker?: string;
  initialAmount?: string;
  onSubmit: (amount: number, ticker: string) => void;
  loading?: boolean;
};

export function BuyForm({
  initialTicker = "NVDA",
  initialAmount = "20",
  onSubmit,
  loading,
}: Props) {
  const [amount, setAmount] = useState(initialAmount);
  const [ticker, setTicker] = useState(initialTicker);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const n = Number(amount);
    const t = ticker.trim().toUpperCase();
    if (!t || !Number.isFinite(n) || n <= 0) return;
    onSubmit(n, t);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 sm:flex-row sm:items-end"
    >
      <label className="flex flex-1 flex-col gap-1.5">
        <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
          Amount (USD)
        </span>
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
            $
          </span>
          <input
            type="number"
            min="1"
            step="1"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-7 pr-3 text-lg font-medium text-slate-900 shadow-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
            placeholder="20"
            required
          />
        </div>
      </label>

      <label className="flex flex-1 flex-col gap-1.5">
        <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
          Stock ticker
        </span>
        <input
          type="text"
          value={ticker}
          onChange={(e) => setTicker(e.target.value.toUpperCase())}
          className="w-full rounded-xl border border-slate-200 bg-white py-3 px-3 text-lg font-medium uppercase tracking-wide text-slate-900 shadow-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
          placeholder="NVDA"
          maxLength={8}
          required
        />
      </label>

      <button
        type="submit"
        disabled={loading}
        className="rounded-xl bg-emerald-600 px-6 py-3 text-base font-semibold text-white shadow-sm hover:bg-emerald-500 disabled:opacity-60 disabled:cursor-not-allowed transition-colors sm:min-w-[140px]"
      >
        {loading ? "Comparing…" : "Find fair price"}
      </button>
    </form>
  );
}
