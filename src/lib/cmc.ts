/**
 * CoinMarketCap server client. Key never leaves the server.
 * Allowlisted endpoints only. Graceful when CMC_API_KEY is missing.
 */

import { cacheGetOrSet } from "@/lib/cache";

const CMC_BASE = "https://pro-api.coinmarketcap.com";

/** Allowlisted path prefixes relative to CMC_BASE */
const ALLOWLIST = [
  "/v1/cryptocurrency/quotes/latest",
  "/v2/cryptocurrency/quotes/latest",
  "/v1/cryptocurrency/info",
  "/v2/cryptocurrency/info",
  "/v1/cryptocurrency/map",
] as const;

export function getCmcApiKey(): string | undefined {
  return (
    process.env.CMC_API_KEY?.trim() ||
    process.env.COINMARKETCAP_API_KEY?.trim() ||
    undefined
  );
}

export function isAllowlistedCmcPath(path: string): boolean {
  const clean = path.split("?")[0];
  return ALLOWLIST.some((p) => clean === p || clean.startsWith(p + "/"));
}

export type CmcQuote = {
  symbol: string;
  priceUsd: number;
  volume24h: number | null;
  lastUpdated: string | null;
  cmcId: number | null;
};

export async function cmcQuotesBySymbol(
  symbols: string[]
): Promise<{ ok: true; quotes: Record<string, CmcQuote> } | { ok: false; error: string }> {
  const key = getCmcApiKey();
  if (!key) {
    return {
      ok: false,
      error: "CMC_API_KEY not set — add it to .env.local / Vercel to enable CoinMarketCap prices",
    };
  }
  const uniq = [...new Set(symbols.map((s) => s.toUpperCase()))].slice(0, 50);
  if (uniq.length === 0) return { ok: true, quotes: {} };

  const cacheKey = `cmc:quotes:${uniq.sort().join(",")}`;
  return cacheGetOrSet(cacheKey, 45_000, async () => {
    const url = `${CMC_BASE}/v2/cryptocurrency/quotes/latest?symbol=${encodeURIComponent(
      uniq.join(",")
    )}&convert=USD`;
    const res = await fetch(url, {
      headers: {
        Accept: "application/json",
        "X-CMC_PRO_API_KEY": key,
      },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return {
        ok: false as const,
        error: `CMC HTTP ${res.status}: ${text.slice(0, 200)}`,
      };
    }
    const body = (await res.json()) as {
      data?: Record<
        string,
        Array<{
          id: number;
          symbol: string;
          quote?: { USD?: { price?: number; volume_24h?: number; last_updated?: string } };
        }>
      >;
    };
    const quotes: Record<string, CmcQuote> = {};
    for (const sym of uniq) {
      const arr = body.data?.[sym];
      const first = Array.isArray(arr) ? arr[0] : undefined;
      const usd = first?.quote?.USD;
      if (first && usd?.price != null) {
        quotes[sym] = {
          symbol: sym,
          priceUsd: usd.price,
          volume24h: usd.volume_24h ?? null,
          lastUpdated: usd.last_updated ?? null,
          cmcId: first.id,
        };
      }
    }
    return { ok: true as const, quotes };
  });
}

/** Proxy helper used by /api/cmc — only allowlisted paths, injects key server-side. */
export async function cmcProxyFetch(
  pathWithQuery: string
): Promise<{ status: number; body: unknown }> {
  const key = getCmcApiKey();
  if (!key) {
    return {
      status: 503,
      body: {
        error: "CMC_API_KEY not configured",
        configured: false,
        hint: "Parity production runs without CoinMarketCap. Prices come from Yahoo (closes), DexScreener, and PancakeSwap. Set CMC_API_KEY only if you have a real key — do not invent one.",
      },
    };
  }
  const path = pathWithQuery.startsWith("/")
    ? pathWithQuery
    : `/${pathWithQuery}`;
  if (!isAllowlistedCmcPath(path)) {
    return {
      status: 400,
      body: {
        error: "Endpoint not allowlisted",
        allowlist: ALLOWLIST,
      },
    };
  }
  const url = `${CMC_BASE}${path}`;
  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      "X-CMC_PRO_API_KEY": key,
    },
  });
  const body = await res.json().catch(() => ({ error: "Invalid CMC JSON" }));
  return { status: res.status, body };
}
