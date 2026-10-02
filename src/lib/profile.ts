export type UserProfile = {
  displayName: string;
  bio: string;
  createdAt: string;
  updatedAt: string;
};

const PREFIX = "parity:profile:";

function keyFor(address: string): string {
  return `${PREFIX}${address.toLowerCase()}`;
}

export function loadProfile(address: string): UserProfile | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(keyFor(address));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as UserProfile;
    if (!parsed?.displayName || typeof parsed.displayName !== "string") {
      return null;
    }
    return {
      displayName: parsed.displayName.trim().slice(0, 40),
      bio: (parsed.bio || "").trim().slice(0, 160),
      createdAt: parsed.createdAt || new Date().toISOString(),
      updatedAt: parsed.updatedAt || parsed.createdAt || new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export function saveProfile(
  address: string,
  input: { displayName: string; bio?: string },
): UserProfile {
  const existing = loadProfile(address);
  const now = new Date().toISOString();
  const profile: UserProfile = {
    displayName: input.displayName.trim().slice(0, 40),
    bio: (input.bio || "").trim().slice(0, 160),
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };
  window.localStorage.setItem(keyFor(address), JSON.stringify(profile));
  return profile;
}

export function clearProfile(address: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(keyFor(address));
}

export function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export function truncateAddress(address: string, chars = 4): string {
  if (!address || address.length < 10) return address;
  return `${address.slice(0, 2 + chars)}…${address.slice(-chars)}`;
}
