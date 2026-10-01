"use client";

import { useCallback, useState } from "react";
import { BuyForm } from "@/components/BuyForm";
import { ResultsTable } from "@/components/ResultsTable";
import { StepsUI, type FlowStep } from "@/components/StepsUI";
import type { SimulateTradeResult } from "@/lib/binance-web3";
import type { ParityComparison } from "@/lib/parity";

type QuoteResponse = {
  mode: string;
  comparison: ParityComparison;
};

type SimulateResponse = {
  mode: string;
  result: SimulateTradeResult;
};

export function TradeFlow() {
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

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm">
        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-slate-900">
          Buy like you mean it — we pick the fair route
        </h1>
        <p className="mt-1.5 text-sm text-slate-500 max-w-2xl">
          Same stock, three tokens on BNB (bStocks, Ondo, xStocks). Hours and
          tokens-per-share differ, so prices drift — especially on weekends.
          Say how much you want; Parity shows the true price per share.
        </p>
        <div className="mt-5">
          <BuyForm onSubmit={runCompare} loading={loading} />
        </div>
        <p className="mt-3 text-xs text-slate-400">
          Mock mode · sample data for{" "}
          <button
            type="button"
            className="underline hover:text-emerald-600"
            onClick={() => runCompare(20, "NVDA")}
          >
            NVDA
          </button>{" "}
          and{" "}
          <button
            type="button"
            className="underline hover:text-emerald-600"
            onClick={() => runCompare(20, "AAPL")}
          >
            AAPL
          </button>
          . Spot only — no perps.
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
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
            canSimulate={Boolean(selectedIssuer && comparison.bestIssuer)}
          />
        </>
      )}
    </div>
  );
}
