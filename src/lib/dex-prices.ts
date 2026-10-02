/**
 * DexScreener price lookup for BSC tokens (no API key).
 * Filters junk pools (thin liquidity / volume) before ranking.
 */

import { cacheGetOrSet } from "@/lib/cache";

/** Minimum pool liquidity (USD) to trust a DexScreener price */
export const MIN_POOL_LIQUIDITY_USD = 25_000;
/** Minimum 24h volume (USD) */
export const MIN_POOL_VOLUME_24H_USD = 1_000;
/**
 * Reject token prices that diverge more than this from the reference
 * underlying (Yahoo last close / regular price).
 */
export const MAX_PRICE_VS_REF_PCT = 3;

export type DexTokenPrice = {
  address: string;
  priceUsd: number;
  liquidityUsd: number;
  volume24hUsd: number;
  pairAddress: string | null;
  dexId: string | null;
  asOf: string;
  source: "dexscreener";
  /** True when pool meets min liquidity + volume */
  liquidEnough: boolean;
  rejectReason?: string;
};

type RawPair = {
  chainId?: string;
  dexId?: string;
  pairAddress?: string;
  priceUsd?: string;
  liquidity?: { usd?: number };
  volume?: { h24?: number };
  baseToken?: { address?: string };
  quoteToken?: { symbol?: string };
};

function scorePair(p: RawPair): DexTokenPrice {
  const addr = (p.baseToken?.address || "").toLowerCase();
  const liq = p.liquidity?.usd ?? 0;
  const vol = p.volume?.h24 ?? 0;
  const priceUsd = Number(p.priceUsd);
  const liquidEnough =
    liq >= MIN_POOL_LIQUIDITY_USD && vol >= MIN_POOL_VOLUME_24H_USD;
  let rejectReason: string | undefined;
  if (!liquidEnough) {
    const parts: string[] = [];
    if (liq < MIN_POOL_LIQUIDITY_USD)
      parts.push(`liquidity ~$${Math.round(liq).toLocaleString()}`);
    if (vol < MIN_POOL_VOLUME_24H_USD)
      parts.push(`24h volume ~$${Math.round(vol).toLocaleString()}`);
    rejectReason = `Thin pool (${parts.join(", ")}) — not executable as best route.`;
  }
  return {
    address: addr,
    priceUsd,
    liquidityUsd: liq,
    volume24hUsd: vol,
    pairAddress: p.pairAddress ?? null,
    dexId: p.dexId ?? null,
    asOf: new Date().toISOString(),
    source: "dexscreener",
    liquidEnough,
    rejectReason,
  };
}

/** Prefer liquid pairs; among equals, highest liquidity. */
function pickBest(
  pairs: RawPair[],
  preferAddr?: string
): DexTokenPrice | null {
  const filtered = pairs.filter(
    (p) =>
      p.chainId === "bsc" &&
      p.priceUsd &&
      Number(p.priceUsd) > 0 &&
      (!preferAddr ||
        (p.baseToken?.address || "").toLowerCase() === preferAddr)
  );
  if (filtered.length === 0) return null;
  filtered.sort((a, b) => {
    const aOk =
      (a.liquidity?.usd ?? 0) >= MIN_POOL_LIQUIDITY_USD &&
      (a.volume?.h24 ?? 0) >= MIN_POOL_VOLUME_24H_USD
        ? 1
        : 0;
    const bOk =
      (b.liquidity?.usd ?? 0) >= MIN_POOL_LIQUIDITY_USD &&
      (b.volume?.h24 ?? 0) >= MIN_POOL_VOLUME_24H_USD
        ? 1
        : 0;
    if (bOk !== aOk) return bOk - aOk;
    return (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0);
  });
  return scorePair(filtered[0]);
}

/**
 * Sanity: price must stay within MAX_PRICE_VS_REF_PCT of reference.
 * Returns null reason when OK.
 */
export function priceSanityReject(
  tokenPriceUsd: number,
  referenceUsd: number | null | undefined,
  maxPct = MAX_PRICE_VS_REF_PCT
): string | null {
  if (
    referenceUsd == null ||
    !(referenceUsd > 0) ||
    !(tokenPriceUsd > 0)
  ) {
    return null;
  }
  const pct = (Math.abs(tokenPriceUsd - referenceUsd) / referenceUsd) * 100;
  if (pct > maxPct) {
    return `Price $${tokenPriceUsd.toFixed(2)} is ~${pct.toFixed(
      1
    )}% from reference $${referenceUsd.toFixed(
      2
    )} (max ${maxPct}%) — likely a junk pool.`;
  }
  return null;
}

export async function fetchDexTokenPrice(
  address: string
): Promise<DexTokenPrice | null> {
  const addr = address.toLowerCase();
  return cacheGetOrSet(`dex:price:v2:${addr}`, 45_000, async () => {
    const url = `https://api.dexscreener.com/latest/dex/tokens/${addr}`;
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { pairs?: RawPair[] };
    const preferred = pickBest(data.pairs ?? [], addr);
    if (preferred) return preferred;
    return pickBest(data.pairs ?? []);
  });
}

export async function fetchDexTokenPrices(
  addresses: string[]
): Promise<Map<string, DexTokenPrice>> {
  const map = new Map<string, DexTokenPrice>();
  const uniq = [...new Set(addresses.map((a) => a.toLowerCase()))].filter(
    Boolean
  );
  for (let i = 0; i < uniq.length; i += 20) {
    const chunk = uniq.slice(i, i + 20);
    const url = `https://api.dexscreener.com/latest/dex/tokens/${chunk.join(",")}`;
    try {
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      if (!res.ok) continue;
      const data = (await res.json()) as { pairs?: RawPair[] };
      const byAddr = new Map<string, RawPair[]>();
      for (const p of data.pairs ?? []) {
        if (p.chainId !== "bsc" || !p.priceUsd) continue;
        const a = (p.baseToken?.address || "").toLowerCase();
        if (!a) continue;
        const arr = byAddr.get(a) ?? [];
        arr.push(p);
        byAddr.set(a, arr);
      }
      for (const [k, arr] of byAddr) {
        const best = pickBest(arr, k);
        if (best) map.set(k, best);
      }
    } catch {
      // ignore chunk errors
    }
  }
  await Promise.all(
    uniq
      .filter((a) => !map.has(a))
      .map(async (a) => {
        const p = await fetchDexTokenPrice(a);
        if (p) map.set(a, p);
      })
  );
  return map;
}
