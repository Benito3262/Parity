"use client";

import type { SimulateTradeResult } from "@/lib/binance-web3";
import { formatUsd } from "@/lib/parity";
import { XstocksBuy } from "@/components/trade/XstocksBuy";
import type { ParityRow } from "@/lib/parity";

export type FlowStep = "compare" | "simulate" | "execute";

type Props = {
  current: FlowStep;
  simulation: SimulateTradeResult | null;
  simulateLoading: boolean;
  onSimulate: () => void;
  onExecute: () => void;
  executeMessage: string | null;
  onExecuteMessage: (msg: string) => void;
  canSimulate: boolean;
  selectedRow?: ParityRow | null;
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
  onExecuteMessage,
  canSimulate,
  selectedRow,
}: Props) {
  const idx = STEPS.findIndex((s) => s.id === current);
  const isXstocks = (simulation?.issuer || selectedRow?.issuer) === "xstocks";

  return (
    <div className="glass rounded-2xl p-5 space-y-5 animate-fade-up">
      <ol className="flex flex-col sm:flex-row gap-3 sm:gap-2">
        {STEPS.map((step, i) => {
          const done = i < idx;
          const active = i === idx;
          return (
            <li
              key={step.id}
              className={`flex-1 rounded-xl px-3 py-2.5 border transition-colors duration-300 ${
                active
                  ? "border-[#f3ba2f]/50 bg-[#f3ba2f]/10"
                  : done
                    ? "border-[#f3ba2f]/20 bg-[#f3ba2f]/5"
                    : "border-white/5 bg-white/[0.02]"
              }`}
            >
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Step {i + 1}
              </p>
              <p
                className={`text-sm font-semibold ${
                  active || done ? "text-[#f3ba2f]" : "text-slate-500"
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
          <p className="text-sm text-slate-400">
            Pick a tradeable issuer above (best route is pre-highlighted), then
            run a test trade.
          </p>
          <button
            type="button"
            disabled={!canSimulate || simulateLoading}
            onClick={onSimulate}
            className="btn-press rounded-xl border border-white/15 bg-white/5 px-5 py-2.5 text-sm font-semibold text-white hover:border-[#f3ba2f]/40 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {simulateLoading ? "Simulating…" : "Simulate trade"}
          </button>
        </div>
      )}

      {(current === "simulate" || current === "execute") && simulation && (
        <div className="space-y-4 route-enter">
          <div className="rounded-xl bg-white/[0.03] border border-white/5 p-4 text-sm">
            {simulation.ok ? (
              <>
                <p className="font-medium text-white">
                  Test run OK via {simulation.route}
                </p>
                <dl className="mt-2 grid grid-cols-2 gap-2 text-slate-300">
                  <div>
                    <dt className="text-xs text-slate-500">You spend</dt>
                    <dd className="font-semibold tabular-nums number-tick">
                      {formatUsd(simulation.amountUsd)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">Est. tokens</dt>
                    <dd className="font-semibold tabular-nums number-tick">
                      {simulation.estimatedTokens.toFixed(4)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">Price / share</dt>
                    <dd className="font-semibold tabular-nums number-tick">
                      {formatUsd(simulation.effectivePricePerShare)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">Est. fees</dt>
                    <dd className="font-semibold tabular-nums number-tick">
                      {formatUsd(simulation.estimatedFeesUsd, 4)}
                    </dd>
                  </div>
                </dl>
                {simulation.priceImpactPct != null && (
                  <p className="mt-2 text-xs text-slate-400">
                    Est. price impact: {simulation.priceImpactPct.toFixed(2)}%
                  </p>
                )}
                {simulation.warning && (
                  <p className="mt-2 text-xs text-amber-400">
                    {simulation.warning}
                  </p>
                )}
              </>
            ) : (
              <p className="text-amber-400 font-medium">
                {simulation.warning ?? "Simulation failed"}
              </p>
            )}
          </div>

          <ul className="space-y-1.5">
            {simulation.steps.map((s) => (
              <li
                key={s.label}
                className="flex items-center gap-2 text-sm text-slate-300"
              >
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                    s.status === "ok"
                      ? "bg-emerald-500/15 text-emerald-400"
                      : s.status === "skip"
                        ? "bg-white/5 text-slate-500"
                        : "bg-amber-500/15 text-amber-400"
                  }`}
                >
                  {s.status === "ok" ? "✓" : s.status === "skip" ? "–" : "…"}
                </span>
                {s.label}
              </li>
            ))}
          </ul>

          {simulation.ok && (
            <div className="border-t border-white/5 pt-4 space-y-3">
              {isXstocks ? (
                <XstocksBuy
                  simulation={simulation}
                  onMessage={(msg) => {
                    onExecute();
                    onExecuteMessage(msg);
                  }}
                />
              ) : (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <p className="text-sm text-slate-400">
                    Ondo / bStock live fills need the Binance Web3 API
                    (BINANCE_LIVE). Spot only — no leverage.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      onExecute();
                      onExecuteMessage(
                        "Ondo/bStock execute is stubbed until BINANCE_LIVE=true and portal API keys are provisioned. xStocks can buy live via PancakeSwap."
                      );
                    }}
                    className="btn-press rounded-xl border-2 border-dashed border-white/15 bg-white/[0.02] px-5 py-2.5 text-sm font-semibold text-slate-200 hover:border-[#f3ba2f]/50 hover:text-[#f3ba2f]"
                  >
                    Connect wallet & buy
                  </button>
                </div>
              )}
            </div>
          )}

          {executeMessage && (
            <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-200 animate-fade-in break-words">
              {executeMessage}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
