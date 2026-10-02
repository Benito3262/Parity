"use client";

import {
  initialsFromName,
  truncateAddress,
  type UserProfile,
} from "@/lib/profile";

type Props = {
  address: string;
  profile: UserProfile;
  onEdit?: () => void;
};

export function ProfileCard({ address, profile, onEdit }: Props) {
  const initials = initialsFromName(profile.displayName);

  return (
    <div className="glass rounded-2xl p-5 sm:p-6 animate-fade-up">
      <div className="flex items-start gap-4">
        <div
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#f3ba2f] to-[#c9961a] text-lg font-bold text-[#0b1220] shadow-[0_0_24px_rgba(243,186,47,0.25)]"
          aria-hidden
        >
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-semibold text-white truncate">
              {profile.displayName}
            </h2>
            {onEdit && (
              <button
                type="button"
                onClick={onEdit}
                className="btn-press rounded-full border border-white/10 px-2.5 py-0.5 text-xs font-medium text-slate-400 hover:text-white hover:border-white/20"
              >
                Edit
              </button>
            )}
          </div>
          <p className="mt-1 font-mono text-sm text-slate-400">
            {truncateAddress(address, 6)}
          </p>
          {profile.bio ? (
            <p className="mt-3 text-sm text-slate-300 leading-relaxed">
              {profile.bio}
            </p>
          ) : (
            <p className="mt-3 text-sm text-slate-500 italic">No bio yet.</p>
          )}
          <p className="mt-3 text-[11px] text-slate-600">
            Profile since{" "}
            {new Date(profile.createdAt).toLocaleDateString(undefined, {
              year: "numeric",
              month: "short",
              day: "numeric",
            })}
          </p>
        </div>
      </div>
    </div>
  );
}
