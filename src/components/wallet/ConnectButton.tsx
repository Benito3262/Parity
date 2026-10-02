"use client";

import { useState } from "react";
import Link from "next/link";
import { useAccount, useDisconnect, useChainId, useSwitchChain } from "wagmi";
import { ConnectModal } from "@/components/wallet/ConnectModal";
import { useProfile } from "@/hooks/useProfile";
import { truncateAddress } from "@/lib/profile";
import { BSC_CHAIN_ID } from "@/lib/wagmi";

export function ConnectButton() {
  const { address, isConnected, isConnecting, isReconnecting } = useAccount();
  const { disconnect } = useDisconnect();
  const chainId = useChainId();
  const { switchChain, isPending: switching } = useSwitchChain();
  const { hasProfile, ready } = useProfile(address);
  const [open, setOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const busy = isConnecting || isReconnecting;

  if (!isConnected || !address) {
    return (
      <>
        <button
          type="button"
          onClick={() => setOpen(true)}
          disabled={busy}
          className="btn-press rounded-full border border-[#f3ba2f]/35 bg-[#f3ba2f]/10 px-3.5 py-1.5 text-sm font-semibold text-[#f3ba2f] hover:bg-[#f3ba2f]/20 disabled:opacity-60"
        >
          {busy ? "Connecting…" : "Connect wallet"}
        </button>
        <ConnectModal open={open} onClose={() => setOpen(false)} />
      </>
    );
  }

  const wrongChain = chainId !== BSC_CHAIN_ID;

  return (
    <div className="relative flex items-center gap-2">
      {wrongChain && (
        <button
          type="button"
          disabled={switching}
          onClick={() => switchChain?.({ chainId: BSC_CHAIN_ID })}
          className="btn-press hidden sm:inline-flex rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-200"
        >
          {switching ? "Switching…" : "Switch to BSC"}
        </button>
      )}

      {ready && hasProfile && (
        <Link
          href="/profile"
          className="btn-press hidden sm:inline-flex rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:border-[#f3ba2f]/35"
        >
          Portfolio
        </Link>
      )}

      {ready && !hasProfile && (
        <Link
          href="/profile"
          className="btn-press hidden sm:inline-flex rounded-full border border-[#f3ba2f]/30 bg-[#f3ba2f]/10 px-3 py-1.5 text-xs font-semibold text-[#f3ba2f]"
        >
          Create profile
        </Link>
      )}

      <button
        type="button"
        onClick={() => setMenuOpen((v) => !v)}
        className="btn-press rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm font-semibold tabular-nums text-white hover:border-white/20"
        aria-expanded={menuOpen}
        aria-haspopup="menu"
      >
        {truncateAddress(address)}
      </button>

      {menuOpen && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 cursor-default"
            aria-label="Close menu"
            onClick={() => setMenuOpen(false)}
          />
          <div
            role="menu"
            className="absolute right-0 top-full z-50 mt-2 w-52 overflow-hidden rounded-xl border border-white/10 bg-[#0b1220] shadow-xl animate-scale-in"
          >
            <div className="border-b border-white/5 px-3 py-2">
              <p className="text-[10px] uppercase tracking-wider text-slate-500">
                Connected
              </p>
              <p className="mt-0.5 font-mono text-xs text-slate-300 break-all">
                {address}
              </p>
            </div>
            <Link
              href="/profile"
              role="menuitem"
              onClick={() => setMenuOpen(false)}
              className="block px-3 py-2.5 text-sm text-slate-200 hover:bg-white/5"
            >
              {hasProfile ? "Profile & portfolio" : "Create profile"}
            </Link>
            {wrongChain && (
              <button
                type="button"
                role="menuitem"
                disabled={switching}
                onClick={() => {
                  switchChain?.({ chainId: BSC_CHAIN_ID });
                  setMenuOpen(false);
                }}
                className="block w-full px-3 py-2.5 text-left text-sm text-amber-200 hover:bg-white/5"
              >
                Switch to BSC
              </button>
            )}
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                disconnect();
              }}
              className="block w-full border-t border-white/5 px-3 py-2.5 text-left text-sm font-medium text-[#f87171] hover:bg-white/5"
            >
              Disconnect
            </button>
          </div>
        </>
      )}
    </div>
  );
}
