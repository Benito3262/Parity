"use client";

import { FormEvent, useState } from "react";
import type { UserProfile } from "@/lib/profile";

type Props = {
  address: string;
  initial?: UserProfile | null;
  onSaved: (profile: UserProfile) => void;
};

export function CreateProfileForm({ address, initial, onSaved }: Props) {
  const [displayName, setDisplayName] = useState(initial?.displayName ?? "");
  const [bio, setBio] = useState(initial?.bio ?? "");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const name = displayName.trim();
    if (name.length < 2) {
      setError("Display name needs at least 2 characters.");
      return;
    }
    setError(null);
    onSaved({
      displayName: name,
      bio: bio.trim(),
      createdAt: initial?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="glass rounded-2xl p-5 sm:p-6 space-y-4 animate-fade-up"
    >
      <div>
        <h2 className="text-lg font-semibold text-white">
          {initial ? "Edit profile" : "Create your profile"}
        </h2>
        <p className="mt-1 text-sm text-slate-400">
          Saved on this device for{" "}
          <span className="font-mono text-slate-300">{address.slice(0, 6)}…{address.slice(-4)}</span>.
          No backend yet — localStorage only.
        </p>
      </div>

      <label className="block space-y-1.5">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Display name
        </span>
        <input
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          maxLength={40}
          placeholder="e.g. Trex Trader"
          className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-sm text-white placeholder:text-slate-600 focus:border-[#f3ba2f]/50"
          required
          autoFocus
        />
      </label>

      <label className="block space-y-1.5">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Bio <span className="normal-case font-normal">(optional)</span>
        </span>
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          maxLength={160}
          rows={3}
          placeholder="Spot tokenized stocks on BNB…"
          className="w-full resize-none rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-sm text-white placeholder:text-slate-600 focus:border-[#f3ba2f]/50"
        />
      </label>

      {error && <p className="text-sm text-[#f87171]">{error}</p>}

      <button
        type="submit"
        className="btn-press btn-gold w-full rounded-full py-2.5 text-sm"
      >
        {initial ? "Save changes" : "Create profile"}
      </button>
    </form>
  );
}
