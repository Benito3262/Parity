"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { BuyForm } from "@/components/BuyForm";
import { ResultsTable } from "@/components/ResultsTable";
import { StepsUI, type FlowStep } from "@/components/StepsUI";
import type { SimulateTradeResult } from "@/lib/binance-web3";
import { MOCK_TICKERS } from "@/lib/binance-web3";
import type { ParityComparison } from "@/lib/parity";

type QuoteResponse = {
  mode: string;
  comparison: ParityComparison;
};

type SimulateResponse = {
  mode: string;
  result: SimulateTradeResult;
};

const CHIP_TICKERS = [
  "NVDA",
  "AAPL",
  "TSLA",
  "MSFT",
  "AMZN",
  "META",
  "GOOGL",
  "SPY",
  "QQQ",
  "COIN",
  "MSTR",
  "PLTR",
  "AMD",
  "NFLX",
];

export function TradeFlow() {
  const searchParams = useSearchParams();
  const initialTicker = useMemo(() => {
    const t = (searchParams.get("ticker") || "NVDA").trim().toUpperCase();
    return t.slice(0, 8) || "NVDA";
  }, [searchParams]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [comparison, setComparison] = useState<ParityComparison | null>(null);
  const [selectedIssuer, setSelectedIssuer] = useState<string | null>(null);
  const [step, setStep] = useState<FlowStep>("compare");
  const [simulation, setSimulation] = useState<SimulateTradeResult | null>(
    null
  );
  const [simulateLoading, setSimulateLoading] = useState(false);
  const [executeMessage, setExecuteMessage] = useState<string | null>(null);
  const [lastQuery, setLastQuery] = useState<{
    amount: number;
    ticker: string;
  } | null>(null);
  const [formKey, setFormKey] = useState(0);

  const runCompare = useCallback(async (amount: number, ticker: string) => {
    setLoading(true);
    setError(null);
    setSimulation(null);
    setExecuteMessage(null);
    setStep("compare");
    setLastQuery({ amount, ticker });

    try {
      const res = await fetch(
        `/api/quote?ticker=${encodeURIComponent(ticker)}&amount=${amount}`
      );
      const data = (await res.json()) as QuoteResponse & { error?: string };
      if (!res.ok) throw new Error(data.error || "Quote failed");
      setComparison(data.comparison);
      setSelectedIssuer(data.comparison.bestIssuer);
    } catch (e) {
      setComparison(null);
      setSelectedIssuer(null);
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, []);

  // Prefill from ?ticker= on first mount
  useEffect(() => {
    void runCompare(20, initialTicker);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runSimulate = useCallback(async () => {
    if (!comparison || !selectedIssuer || !lastQuery) return;
    setSimulateLoading(true);
    setError(null);
    setExecuteMessage(null);
    try {
      const res = await fetch("/api/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          issuer: selectedIssuer,
          ticker: lastQuery.ticker,
          amountUsd: lastQuery.amount,
        }),
      });
      const data = (await res.json()) as SimulateResponse & { error?: string };
      if (!res.ok) throw new Error(data.error || "Simulate failed");
      setSimulation(data.result);
      setStep(data.result.ok ? "simulate" : "compare");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Simulate failed");
    } finally {
      setSimulateLoading(false);
    }
  }, [comparison, selectedIssuer, lastQuery]);

  const runExecute = useCallback(() => {
    setStep("execute");
    setExecuteMessage(
      "Wallet connect is a placeholder. Live BSC spot buys will plug in once BINANCE_WEB3_API_KEY is set and a wallet adapter is wired. No funds move in this MVP."
    );
  }, []);

  function pickTicker(t: string) {
    setFormKey((k) => k + 1);
    void runCompare(lastQuery?.amount ?? 20, t);
  }

  return (
    <div className="space-y-6">
      <div className="glass animate-fade-up rounded-2xl p-5 sm:p-6 shadow-lg shadow-black/20">
        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-white">
          Buy like you mean it — we pick the fair route
        </h1>
        <p className="mt-1.5 text-sm text-slate-400 max-w-2xl">
          Same stock, three tokens on BNB (bStocks, Ondo, xStocks). Hours and
          tokens-per-share differ, so prices drift — especially on weekends.
          Say how much you want; Parity shows the true price per share.
        </p>
        <div className="mt-5">
          <BuyForm
            key={formKey}
            initialTicker={lastQuery?.ticker ?? initialTicker}
            initialAmount={String(lastQuery?.amount ?? 20)}
            onSubmit={runCompare}
            loading={loading}
          />
        </div>
        <div className="mt-4">
          <p className="text-xs text-slate-500 mb-2">
            Mock mode · {MOCK_TICKERS.length} liquid tickers · spot only
          </p>
          <div className="flex flex-wrap gap-1.5">
            {CHIP_TICKERS.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => pickTicker(t)}
                className={`ticker-chip rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tabular-nums ${
                  (lastQuery?.ticker ?? initialTicker) === t
                    ? "border-[#f3ba2f]/45 bg-[#f3ba2f]/10 text-[#f3ba2f]"
                    : "border-white/10 bg-white/[0.03] text-slate-400"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && (
        <div className="animate-fade-in rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {comparison && (
        <>
          <ResultsTable
            comparison={comparison}
            selectedIssuer={selectedIssuer}
            onSelect={(issuer) => {
              setSelectedIssuer(issuer);
              setSimulation(null);
              setExecuteMessage(null);
              setStep("compare");
            }}
          />
          <StepsUI
            current={step}
            simulation={simulation}
            simulateLoading={simulateLoading}
            onSimulate={runSimulate}
            onExecute={runExecute}
            executeMessage={executeMessage}
            canSimulate={Boolean(
              selectedIssuer &&
                comparison.rows.some(
                  (r) => r.issuer === selectedIssuer && r.tradeableNow
                )
            )}
          />
        </>
      )}
    </div>
  );
}
