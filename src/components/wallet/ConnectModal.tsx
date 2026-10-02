"use client";

import { useEffect, useState } from "react";
import { useConnect, useSwitchChain } from "wagmi";
import { hasWalletConnect, BSC_CHAIN_ID } from "@/lib/wagmi";

type Props = {
  open: boolean;
  onClose: () => void;
};

function connectorLabel(id: string, name: string): string {
  if (id === "injected") return "Browser wallet";
  if (id === "walletConnect") return "WalletConnect";
  return name;
}

function connectorHint(id: string): string {
  if (id === "injected") {
    return "MetaMask, Binance Wallet, Zerion extension, and other EIP-1193 wallets";
  }
  if (id === "walletConnect") {
    return "Mobile wallets via QR or deep link — Zerion, Trust, Rainbow, and more";
  }
  return "";
}

export function ConnectModal({ open, onClose }: Props) {
  const { connectAsync, connectors, isPending, error, reset } = useConnect();
  const { switchChainAsync } = useSwitchChain();
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setBusyId(null);
      reset();
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, reset]);

  if (!open) return null;

  async function handleConnect(connectorId: string) {
    const connector = connectors.find((c) => c.id === connectorId);
    if (!connector) return;
    setBusyId(connectorId);
    try {
      const result = await connectAsync({
        connector,
        chainId: BSC_CHAIN_ID,
      });
      if (result.chainId !== BSC_CHAIN_ID) {
        try {
          await switchChainAsync({ chainId: BSC_CHAIN_ID });
        } catch {
          // User may reject switch; connection still succeeds.
        }
      }
      onClose();
    } catch {
      // Error surfaced via useConnect().error
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="connect-wallet-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        aria-label="Close connect modal"
        onClick={onClose}
      />
      <div className="relative w-full max-w-md glass-strong rounded-2xl p-5 sm:p-6 shadow-2xl animate-scale-in">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2
              id="connect-wallet-title"
              className="text-lg font-semibold text-white"
            >
              Connect wallet
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              BNB Smart Chain (BSC · chain id 56). Spot only.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="btn-press rounded-lg border border-white/10 px-2.5 py-1 text-sm text-slate-400 hover:text-white hover:border-white/20"
          >
            Esc
          </button>
        </div>

        <ul className="mt-5 space-y-2">
          {connectors.map((connector) => {
            const pending = busyId === connector.id;
            return (
              <li key={connector.uid}>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => handleConnect(connector.id)}
                  className="btn-press w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-left hover:border-[#f3ba2f]/40 hover:bg-[#f3ba2f]/5 disabled:opacity-60"
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-white">
                      {connectorLabel(connector.id, connector.name)}
                    </span>
                    {pending ? (
                      <span className="text-xs text-[#f3ba2f]">Connecting…</span>
                    ) : (
                      <span className="text-xs text-slate-500">Connect</span>
                    )}
                  </span>
                  <span className="mt-1 block text-xs text-slate-500 leading-relaxed">
                    {connectorHint(connector.id)}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        {!hasWalletConnect && (
          <p className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-200/90 leading-relaxed">
            WalletConnect is offline until{" "}
            <code className="text-amber-100">
              NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID
            </code>{" "}
            is set. Browser extensions still work.
          </p>
        )}

        {error && (
          <p className="mt-3 text-sm text-[#f87171]">
            {error.message || "Could not connect. Try another wallet."}
          </p>
        )}
      </div>
    </div>
  );
}
