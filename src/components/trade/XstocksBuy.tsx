"use client";

import { useCallback, useState } from "react";
import {
  useAccount,
  useWriteContract,
  useWaitForTransactionReceipt,
  useSwitchChain,
  usePublicClient,
} from "wagmi";
import { bsc } from "wagmi/chains";
import { type Address, type Hex } from "viem";
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
 * Flow: ensure BSC → check USDT allowance → approve exact amount if needed
 * (wait for receipt) → swap. Never auto-signs; never unlimited approve.
 */
export function XstocksBuy({ simulation, onMessage }: Props) {
  const { address, isConnected, chainId } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const publicClient = usePublicClient({ chainId: bsc.id });
  const { writeContractAsync, isPending } = useWriteContract();
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
    if (simulation.blocked) {
      setError(simulation.warning || "This buy is blocked for safety.");
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

      // Check existing allowance first
      let allowance = BigInt(0);
      if (publicClient) {
        allowance = (await publicClient.readContract({
          address: BSC.USDT,
          abi: ERC20_ABI,
          functionName: "allowance",
          args: [address, BSC.PCS_V2_ROUTER],
        })) as bigint;
      }

      if (allowance < amountIn) {
        setPhase("approve");
        onMessage(
          `Approve exactly ${formatUsd(simulation.amountUsd)} USDT for PancakeSwap (wallet will prompt)…`
        );
        // Exact amount only — never MaxUint256
        const approveHash = await writeContractAsync({
          address: BSC.USDT,
          abi: ERC20_ABI,
          functionName: "approve",
          args: [BSC.PCS_V2_ROUTER, amountIn],
          chainId: bsc.id,
        });
        setLocalHash(approveHash);
        onMessage(
          `Approve submitted: ${approveHash.slice(0, 10)}… Waiting for confirmation…`
        );

        if (publicClient) {
          const receipt = await publicClient.waitForTransactionReceipt({
            hash: approveHash,
            confirmations: 1,
          });
          if (receipt.status !== "success") {
            throw new Error("USDT approval transaction failed on-chain");
          }
        } else {
          // Fallback short wait if no public client
          await new Promise((r) => setTimeout(r, 4000));
        }
      }

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
    publicClient,
    simulation.amountUsd,
    simulation.blocked,
    simulation.warning,
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

  if (simulation.blocked) {
    return (
      <p className="text-sm text-amber-300">
        {simulation.warning ||
          "Buy blocked — execution price is too far above the reference close."}
      </p>
    );
  }

  const hash = localHash;

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <p className="text-sm text-slate-400">
          Spot only · max $500 · exact USDT approve · you sign every tx
        </p>
        <button
          type="button"
          disabled={isPending || phase === "done"}
          onClick={() => void run()}
          className="btn-press btn-gold rounded-xl px-5 py-2.5 text-sm disabled:opacity-50"
        >
          {phase === "approve"
            ? "Approve in wallet…"
            : phase === "swap"
              ? "Swap in wallet…"
              : phase === "done"
                ? "Submitted"
                : isPending
                  ? "Confirming…"
                  : "Connect wallet & buy"}
        </button>
      </div>
      {error && <p className="text-xs text-red-300">{error}</p>}
      {hash && (
        <a
          href={BSC.explorerTx(hash)}
          target="_blank"
          rel="noreferrer"
          className="text-xs text-[#f3ba2f] underline break-all"
        >
          {phase === "done" ? "Tx on BscScan: " : "Pending tx: "}
          {hash}
        </a>
      )}
    </div>
  );
}
