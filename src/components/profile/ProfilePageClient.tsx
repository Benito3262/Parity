"use client";

import { useState } from "react";
import Link from "next/link";
import { useAccount } from "wagmi";
import { ConnectButton } from "@/components/wallet/ConnectButton";
import { CreateProfileForm } from "@/components/profile/CreateProfileForm";
import { ProfileCard } from "@/components/profile/ProfileCard";
import { PortfolioPanel } from "@/components/portfolio/PortfolioPanel";
import { useProfile } from "@/hooks/useProfile";
import { saveProfile } from "@/lib/profile";

export function ProfilePageClient() {
  const { address, isConnected, isConnecting, isReconnecting } = useAccount();
  const { profile, ready, upsert, hasProfile } = useProfile(address);
  const [editing, setEditing] = useState(false);

  const loading = isConnecting || isReconnecting || (isConnected && !ready);

  if (loading) {
    return (
      <div className="glass rounded-2xl p-8 text-sm text-slate-400 animate-pulse">
        Loading wallet…
      </div>
    );
  }

  if (!isConnected || !address) {
    return (
      <div className="glass rounded-2xl p-8 sm:p-10 text-center animate-fade-up space-y-4">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#f3ba2f]">
          Profile & portfolio
        </p>
        <h1 className="text-2xl font-semibold text-white">
          Connect a wallet to continue
        </h1>
        <p className="mx-auto max-w-md text-sm text-slate-400 leading-relaxed">
          After you connect on BNB Smart Chain, create a simple profile. Profile
          and portfolio UI unlock only once that profile exists for your address.
        </p>
        <div className="flex justify-center pt-2">
          <ConnectButton />
        </div>
        <p className="text-xs text-slate-500 pt-2">
          Fair-price routing on{" "}
          <Link href="/trade" className="text-slate-300 underline-offset-2 hover:underline">
            /trade
          </Link>{" "}
          still works without a wallet.
        </p>
      </div>
    );
  }

  if (!hasProfile || editing) {
    return (
      <div className="space-y-4 max-w-lg mx-auto">
        {!hasProfile && (
          <div className="text-center animate-fade-up space-y-1">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#f3ba2f]">
              Almost there
            </p>
            <h1 className="text-2xl font-semibold text-white">
              Create a profile first
            </h1>
            <p className="text-sm text-slate-400">
              Portfolio stays locked until you pick a display name.
            </p>
          </div>
        )}
        <CreateProfileForm
          address={address}
          initial={editing ? profile : null}
          onSaved={(draft) => {
            const saved = upsert({
              displayName: draft.displayName,
              bio: draft.bio,
            });
            // Ensure persistence even if hook race
            if (!saved) {
              saveProfile(address, {
                displayName: draft.displayName,
                bio: draft.bio,
              });
            }
            setEditing(false);
          }}
        />
        {editing && (
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="btn-press mx-auto block text-sm text-slate-400 hover:text-white"
          >
            Cancel
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="animate-fade-up">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#f3ba2f]">
          Your account
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-white tracking-tight">
          Profile & portfolio
        </h1>
      </div>
      <ProfileCard
        address={address}
        profile={profile!}
        onEdit={() => setEditing(true)}
      />
      <PortfolioPanel showMock />
    </div>
  );
}
