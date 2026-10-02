"use client";

import { useCallback, useState } from "react";
import {
  useAccount,
  useWriteContract,
  useWaitForTransactionReceipt,
  useSwitchChain,
} from "wagmi";
import { bsc } from "wagmi/chains";
import { maxUint256, type Address, type Hex } from "viem";
import { ConnectButton } from "@/components/wallet/ConnectButton";
import { BSC } from "@/lib/tokens";
import { ERC20_ABI, ROUTER_ABI } from "@/lib/pancakeswap";
import { formatUsd } from "@/lib/parity";
import type { SimulateTradeResult } from "@/lib/binance-web3";

type Props = {
  simulation: SimulateTradeResult;
  onMessage: (msg: string) => void;
};

/**
 * Real small spot buy for xStocks via PancakeSwap V2.
 * Flow: ensure BSC → check path from simulate → approve USDT if needed → swap.
 * Never auto-signs; each step is a user wallet prompt.
 */
export function XstocksBuy({ simulation, onMessage }: Props) {
  const { address, isConnected, chainId } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync, data: txHash, isPending } = useWriteContract();
  const { isLoading: confirming, isSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
  });
  const [phase, setPhase] = useState<"idle" | "approve" | "swap" | "done">(
    "idle"
  );
  const [localHash, setLocalHash] = useState<Hex | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pcs = simulation.pcs;

  const run = useCallback(async () => {
    setError(null);
    if (!pcs || !address) {
      onMessage("Connect a wallet on BSC to buy xStocks via PancakeSwap.");
      return;
    }
    if (simulation.amountUsd > 500) {
      setError("Parity caps live xStocks buys at $500 for safety in this MVP.");
      return;
    }
    try {
      if (chainId !== bsc.id) {
        await switchChainAsync({ chainId: bsc.id });
      }
      const amountIn = BigInt(pcs.amountInWei);
      const amountOutMin = BigInt(pcs.amountOutMinWei);
      const path = pcs.path as Address[];

      setPhase("approve");
      onMessage("Approve USDT for PancakeSwap (wallet will prompt)…");
      const approveHash = await writeContractAsync({
        address: BSC.USDT,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [BSC.PCS_V2_ROUTER, maxUint256],
        chainId: bsc.id,
      });
      setLocalHash(approveHash);
      onMessage(`Approve submitted: ${approveHash.slice(0, 10)}… Waiting…`);

      // Brief pause then swap (user confirms second tx)
      setPhase("swap");
      onMessage(
        `Swap ~${formatUsd(simulation.amountUsd)} USDT → tokens (wallet will prompt). Slippage ${(pcs.slippageBps / 100).toFixed(2)}%.`
      );
      const swapHash = await writeContractAsync({
        address: BSC.PCS_V2_ROUTER,
        abi: ROUTER_ABI,
        functionName: "swapExactTokensForTokens",
        args: [
          amountIn,
          amountOutMin,
          path,
          address,
          BigInt(Math.floor(Date.now() / 1000) + 600),
        ],
        chainId: bsc.id,
      });
      setLocalHash(swapHash);
      setPhase("done");
      onMessage(
        `Swap submitted. View on BscScan: ${BSC.explorerTx(swapHash)}`
      );
    } catch (e) {
      setPhase("idle");
      const msg = e instanceof Error ? e.message : "Transaction rejected";
      setError(msg.slice(0, 280));
      onMessage(`Buy cancelled or failed: ${msg.slice(0, 160)}`);
    }
  }, [
    pcs,
    address,
    chainId,
    switchChainAsync,
    writeContractAsync,
    simulation.amountUsd,
    onMessage,
  ]);

  if (!isConnected) {
    return (
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <p className="text-sm text-slate-400">
          Connect a wallet on BNB Chain to place a small xStocks spot buy.
        </p>
        <ConnectButton />
      </div>
    );
  }

  if (!pcs) {
    return (
      <p className="text-sm text-amber-300">
        Simulate again to build a PancakeSwap path before buying.
      </p>
    );
  }

  const hash = localHash || txHash;

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <p className="text-sm text-slate-400">
          Spot only · max $500 · you sign every tx · never auto-signed
        </p>
        <button
          type="button"
          disabled={isPending || confirming || phase === "done"}
          onClick={() => void run()}
          className="btn-press btn-gold rounded-xl px-5 py-2.5 text-sm disabled:opacity-50"
        >
          {phase === "approve"
            ? "Approve in wallet…"
            : phase === "swap"
              ? "Swap in wallet…"
              : phase === "done"
                ? "Submitted"
                : isPending || confirming
                  ? "Confirming…"
                  : "Connect wallet & buy"}
        </button>
      </div>
      {error && (
        <p className="text-xs text-red-300">{error}</p>
      )}
      {hash && (
        <a
          href={BSC.explorerTx(hash)}
          target="_blank"
          rel="noreferrer"
          className="text-xs text-[#f3ba2f] underline break-all"
        >
          {isSuccess || phase === "done" ? "Tx on BscScan: " : "Pending tx: "}
          {hash}
        </a>
      )}
    </div>
  );
}
