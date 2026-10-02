"use client";

import { useEffect, useMemo, useState } from "react";
import { useConnect, useSwitchChain } from "wagmi";
import { hasWalletConnect, BSC_CHAIN_ID } from "@/lib/wagmi";

type Props = {
  open: boolean;
  onClose: () => void;
};

function detectMobile(): boolean {
  if (typeof window === "undefined") return false;
  const ua = navigator.userAgent || "";
  if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua)) {
    return true;
  }
  // iPadOS 13+ reports as Mac; treat coarse pointer + no hover as mobile-like.
  const coarse =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(pointer: coarse)").matches;
  const noHover =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(hover: none)").matches;
  return coarse && noHover;
}

function detectInjectedProvider(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(
    (window as Window & { ethereum?: unknown }).ethereum,
  );
}

function connectorLabel(id: string, name: string): string {
  if (id === "injected") return "Browser wallet";
  if (id === "walletConnect") return "Mobile wallets";
  return name;
}

function connectorHint(id: string, preferMobile: boolean): string {
  if (id === "injected") {
    return preferMobile
      ? "Only works if a wallet extension/provider is injected in this browser"
      : "MetaMask, Binance Wallet, Zerion extension, and other EIP-1193 wallets";
  }
  if (id === "walletConnect") {
    return "Zerion, MetaMask app, Trust, Rainbow, and other WalletConnect wallets — QR or deep link";
  }
  return "";
}

export function ConnectModal({ open, onClose }: Props) {
  const { connectAsync, connectors, isPending, error, reset } = useConnect();
  const { switchChainAsync } = useSwitchChain();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [hasInjected, setHasInjected] = useState(true);

  useEffect(() => {
    setIsMobile(detectMobile());
    setHasInjected(detectInjectedProvider());
  }, [open]);

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

  const preferMobileWallets = isMobile || !hasInjected;

  const visibleConnectors = useMemo(() => {
    const list = [...connectors];
    // Hide Browser wallet when there is no injected provider — it cannot work.
    const filtered = preferMobileWallets
      ? list.filter((c) => c.id !== "injected" || hasInjected)
      : list;

    return filtered.sort((a, b) => {
      if (!preferMobileWallets) return 0;
      if (a.id === "walletConnect") return -1;
      if (b.id === "walletConnect") return 1;
      return 0;
    });
  }, [connectors, preferMobileWallets, hasInjected]);

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

  const showWcPrimary = hasWalletConnect && preferMobileWallets;
  const showMissingWcForMobile = !hasWalletConnect && preferMobileWallets;
  const showMissingWcDesktop = !hasWalletConnect && !preferMobileWallets;

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
              {showWcPrimary
                ? "Open Zerion, MetaMask, Trust, or Rainbow to connect on BNB Chain."
                : "BNB Smart Chain (BSC · chain id 56). Spot only."}
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

        {showMissingWcForMobile && (
          <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-3 text-sm text-amber-100 leading-relaxed">
            <p className="font-semibold text-amber-50">
              Mobile wallets need WalletConnect
            </p>
            <p className="mt-1.5 text-xs text-amber-200/90">
              iPhone and other mobile browsers do not have a browser extension.
              To connect Zerion, MetaMask app, Trust, Rainbow, and similar wallets,
              set{" "}
              <code className="rounded bg-black/30 px-1 py-0.5 text-amber-50">
                NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID
              </code>{" "}
              (free at cloud.walletconnect.com / Reown) and redeploy.
            </p>
            {!hasInjected && (
              <p className="mt-2 text-xs text-amber-200/80">
                No injected wallet was detected in this browser, so Browser wallet
                is unavailable here.
              </p>
            )}
          </div>
        )}

        <ul className="mt-5 space-y-2">
          {visibleConnectors.map((connector) => {
            const pending = busyId === connector.id;
            const isPrimary =
              showWcPrimary && connector.id === "walletConnect";
            return (
              <li key={connector.uid}>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => handleConnect(connector.id)}
                  className={
                    isPrimary
                      ? "btn-press w-full rounded-xl border border-[#f3ba2f]/50 bg-[#f3ba2f]/15 px-4 py-3.5 text-left hover:border-[#f3ba2f]/70 hover:bg-[#f3ba2f]/25 disabled:opacity-60 shadow-[0_0_24px_-8px_rgba(243,186,47,0.45)]"
                      : "btn-press w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-left hover:border-[#f3ba2f]/40 hover:bg-[#f3ba2f]/5 disabled:opacity-60"
                  }
                >
                  <span className="flex items-center justify-between gap-2">
                    <span
                      className={
                        isPrimary
                          ? "font-semibold text-[#f3ba2f]"
                          : "font-semibold text-white"
                      }
                    >
                      {connectorLabel(connector.id, connector.name)}
                    </span>
                    {pending ? (
                      <span className="text-xs text-[#f3ba2f]">Connecting…</span>
                    ) : (
                      <span
                        className={
                          isPrimary
                            ? "text-xs font-medium text-[#f3ba2f]"
                            : "text-xs text-slate-500"
                        }
                      >
                        {isPrimary ? "Open wallets" : "Connect"}
                      </span>
                    )}
                  </span>
                  <span className="mt-1 block text-xs text-slate-400 leading-relaxed">
                    {connectorHint(connector.id, preferMobileWallets)}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        {hasInjected && preferMobileWallets && hasWalletConnect && (
          <p className="mt-3 text-[11px] text-slate-500 leading-relaxed">
            Browser wallet stays available because an injected provider was
            detected, but mobile deep-link wallets are recommended on phones.
          </p>
        )}

        {showMissingWcDesktop && (
          <p className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-200/90 leading-relaxed">
            WalletConnect is offline until{" "}
            <code className="text-amber-100">
              NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID
            </code>{" "}
            is set. Browser extensions still work. Mobile wallets (Zerion app,
            Trust, Rainbow, MetaMask mobile) need that project id.
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
