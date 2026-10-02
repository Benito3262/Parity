/**
 * DexScreener price lookup for BSC tokens (no API key).
 * Fallback when CMC_API_KEY is absent.
 */

import { cacheGetOrSet } from "@/lib/cache";

export type DexTokenPrice = {
  address: string;
  priceUsd: number;
  liquidityUsd: number;
  volume24hUsd: number;
  pairAddress: string | null;
  dexId: string | null;
  asOf: string;
  source: "dexscreener";
};

export async function fetchDexTokenPrice(
  address: string
): Promise<DexTokenPrice | null> {
  const addr = address.toLowerCase();
  return cacheGetOrSet(`dex:price:${addr}`, 45_000, async () => {
    const url = `https://api.dexscreener.com/latest/dex/tokens/${addr}`;
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      pairs?: Array<{
        chainId?: string;
        dexId?: string;
        pairAddress?: string;
        priceUsd?: string;
        liquidity?: { usd?: number };
        volume?: { h24?: number };
        baseToken?: { address?: string };
      }>;
    };
    const pairs = (data.pairs ?? []).filter(
      (p) =>
        p.chainId === "bsc" &&
        p.priceUsd &&
        Number(p.priceUsd) > 0 &&
        (p.baseToken?.address || "").toLowerCase() === addr
    );
    if (pairs.length === 0) {
      // Some tokens appear as quote; also accept any bsc pair with this token
      const any = (data.pairs ?? []).filter(
        (p) => p.chainId === "bsc" && p.priceUsd && Number(p.priceUsd) > 0
      );
      if (any.length === 0) return null;
      any.sort(
        (a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0)
      );
      const best = any[0];
      return {
        address: addr,
        priceUsd: Number(best.priceUsd),
        liquidityUsd: best.liquidity?.usd ?? 0,
        volume24hUsd: best.volume?.h24 ?? 0,
        pairAddress: best.pairAddress ?? null,
        dexId: best.dexId ?? null,
        asOf: new Date().toISOString(),
        source: "dexscreener" as const,
      };
    }
    pairs.sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0));
    const best = pairs[0];
    return {
      address: addr,
      priceUsd: Number(best.priceUsd),
      liquidityUsd: best.liquidity?.usd ?? 0,
      volume24hUsd: best.volume?.h24 ?? 0,
      pairAddress: best.pairAddress ?? null,
      dexId: best.dexId ?? null,
      asOf: new Date().toISOString(),
      source: "dexscreener" as const,
    };
  });
}

export async function fetchDexTokenPrices(
  addresses: string[]
): Promise<Map<string, DexTokenPrice>> {
  const map = new Map<string, DexTokenPrice>();
  // DexScreener allows comma-separated up to ~30
  const uniq = [...new Set(addresses.map((a) => a.toLowerCase()))].filter(
    Boolean
  );
  for (let i = 0; i < uniq.length; i += 20) {
    const chunk = uniq.slice(i, i + 20);
    const url = `https://api.dexscreener.com/latest/dex/tokens/${chunk.join(",")}`;
    try {
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      if (!res.ok) continue;
      const data = (await res.json()) as {
        pairs?: Array<{
          chainId?: string;
          dexId?: string;
          pairAddress?: string;
          priceUsd?: string;
          liquidity?: { usd?: number };
          volume?: { h24?: number };
          baseToken?: { address?: string };
        }>;
      };
      const byAddr = new Map<string, DexTokenPrice>();
      for (const p of data.pairs ?? []) {
        if (p.chainId !== "bsc" || !p.priceUsd) continue;
        const a = (p.baseToken?.address || "").toLowerCase();
        if (!a) continue;
        const liq = p.liquidity?.usd ?? 0;
        const existing = byAddr.get(a);
        if (!existing || liq > existing.liquidityUsd) {
          byAddr.set(a, {
            address: a,
            priceUsd: Number(p.priceUsd),
            liquidityUsd: liq,
            volume24hUsd: p.volume?.h24 ?? 0,
            pairAddress: p.pairAddress ?? null,
            dexId: p.dexId ?? null,
            asOf: new Date().toISOString(),
            source: "dexscreener",
          });
        }
      }
      for (const [k, v] of byAddr) map.set(k, v);
    } catch {
      // ignore chunk errors
    }
  }
  // Fill misses individually (cached)
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
