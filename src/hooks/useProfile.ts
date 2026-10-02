"use client";

import { useCallback, useEffect, useState } from "react";
import {
  loadProfile,
  saveProfile,
  type UserProfile,
} from "@/lib/profile";

export function useProfile(address: string | undefined) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(() => {
    if (!address) {
      setProfile(null);
      setReady(true);
      return;
    }
    setProfile(loadProfile(address));
    setReady(true);
  }, [address]);

  useEffect(() => {
    setReady(false);
    refresh();
  }, [refresh]);

  const upsert = useCallback(
    (input: { displayName: string; bio?: string }) => {
      if (!address) return null;
      const next = saveProfile(address, input);
      setProfile(next);
      return next;
    },
    [address],
  );

  return { profile, ready, refresh, upsert, hasProfile: Boolean(profile) };
}
