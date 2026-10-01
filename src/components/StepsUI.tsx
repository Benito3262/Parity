"use client";

import type { SimulateTradeResult } from "@/lib/binance-web3";
import { formatUsd } from "@/lib/parity";

export type FlowStep = "compare" | "simulate" | "execute";

type Props = {
  current: FlowStep;
  simulation: SimulateTradeResult | null;
  simulateLoading: boolean;
  onSimulate: () => void;
  onExecute: () => void;
  executeMessage: string | null;
  canSimulate: boolean;
};

const STEPS: { id: FlowStep; label: string; blurb: string }[] = [
  {
    id: "compare",
    label: "Compare",
    blurb: "Check all three issuers and true price per share",
  },
  {
    id: "simulate",
    label: "Simulate",
    blurb: "Dry-run the best (or selected) route — no money moves",
  },
  {
    id: "execute",
    label: "Buy",
    blurb: "Connect wallet and place the spot buy on BNB Chain",
  },
];

export function StepsUI({
  current,
  simulation,
  simulateLoading,
  onSimulate,
  onExecute,
  executeMessage,
  canSimulate,
}: Props) {
  const idx = STEPS.findIndex((s) => s.id === current);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-5">
      <ol className="flex flex-col sm:flex-row gap-3 sm:gap-2">
        {STEPS.map((step, i) => {
          const done = i < idx;
          const active = i === idx;
          return (
            <li
              key={step.id}
              className={`flex-1 rounded-xl px-3 py-2.5 border ${
                active
                  ? "border-emerald-500 bg-emerald-50"
                  : done
                    ? "border-emerald-200 bg-emerald-50/40"
                    : "border-slate-100 bg-slate-50"
              }`}
            >
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Step {i + 1}
              </p>
              <p
                className={`text-sm font-semibold ${
                  active || done ? "text-emerald-900" : "text-slate-500"
                }`}
              >
                {step.label}
              </p>
              <p className="text-xs text-slate-500 mt-0.5 hidden sm:block">
                {step.blurb}
              </p>
            </li>
          );
        })}
      </ol>

      {current === "compare" && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <p className="text-sm text-slate-600">
            Pick a tradeable issuer above (best route is pre-highlighted), then
            run a test trade.
          </p>
          <button
            type="button"
            disabled={!canSimulate || simulateLoading}
            onClick={onSimulate}
            className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {simulateLoading ? "Simulating…" : "Simulate trade"}
          </button>
        </div>
      )}

      {(current === "simulate" || current === "execute") && simulation && (
        <div className="space-y-4">
          <div className="rounded-xl bg-slate-50 border border-slate-100 p-4 text-sm">
            {simulation.ok ? (
              <>
                <p className="font-medium text-slate-900">
                  Test run OK via {simulation.route}
                </p>
                <dl className="mt-2 grid grid-cols-2 gap-2 text-slate-600">
                  <div>
                    <dt className="text-xs text-slate-400">You spend</dt>
                    <dd className="font-semibold tabular-nums">
                      {formatUsd(simulation.amountUsd)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-400">Est. tokens</dt>
                    <dd className="font-semibold tabular-nums">
                      {simulation.estimatedTokens.toFixed(4)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-400">Price / share</dt>
                    <dd className="font-semibold tabular-nums">
                      {formatUsd(simulation.effectivePricePerShare)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-400">Est. fees</dt>
                    <dd className="font-semibold tabular-nums">
                      {formatUsd(simulation.estimatedFeesUsd, 4)}
                    </dd>
                  </div>
                </dl>
                {simulation.warning && (
                  <p className="mt-2 text-xs text-amber-700">
                    {simulation.warning}
                  </p>
                )}
              </>
            ) : (
              <p className="text-amber-800 font-medium">
                {simulation.warning ?? "Simulation failed"}
              </p>
            )}
          </div>

          <ul className="space-y-1.5">
            {simulation.steps.map((s) => (
              <li
                key={s.label}
                className="flex items-center gap-2 text-sm text-slate-700"
              >
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                    s.status === "ok"
                      ? "bg-emerald-100 text-emerald-700"
                      : s.status === "skip"
                        ? "bg-slate-100 text-slate-400"
                        : "bg-amber-100 text-amber-700"
                  }`}
                >
                  {s.status === "ok" ? "✓" : s.status === "skip" ? "–" : "…"}
                </span>
                {s.label}
              </li>
            ))}
          </ul>

          {simulation.ok && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-slate-100 pt-4">
              <p className="text-sm text-slate-600">
                Live buy needs a wallet on BNB Chain (BSC). Spot only — no
                leverage.
              </p>
              <button
                type="button"
                onClick={onExecute}
                className="rounded-xl border-2 border-dashed border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:border-emerald-500 hover:text-emerald-700 transition-colors"
              >
                Connect wallet & buy
              </button>
            </div>
          )}

          {executeMessage && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              {executeMessage}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
