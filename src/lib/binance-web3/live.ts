/**
 * Live Binance Web3 Build API client (typed stubs + real signing).
 * Base: https://web3.binance.com/build
 * Auth headers: X-OC-APIKEY, X-OC-TIMESTAMP, X-OC-SIGN, X-OC-RECV-WINDOW
 *
 * Enabled when BINANCE_LIVE=true (or BINANCE_WEB3_USE_MOCK=false) and keys exist.
 * Until portal Create is provisioned, calls will fail with honest errors —
 * hybrid CMC/PCS path remains the default.
 */

import { createHmac } from "crypto";
import type {
  BinanceWeb3Client,
  DataMode,
  ExecuteTradeRequest,
  ExecuteTradeResult,
  IssuerMeta,
  MarketClose,
  RawIssuerQuote,
  SimulateTradeRequest,
  SimulateTradeResult,
  Ticker,
} from "./types";
import { BINANCE_ERROR_MAP, QUOTE_EXPIRY_MS } from "./types";
import { issuerTradeability, getMarketStatus } from "@/lib/market-clock";
import {
  getTokenListing,
  listTokensForTicker,
  tokenSymbolFor,
  XSTOCKS_WRAPPER_BSC,
} from "@/lib/tokens";
import { fetchYahooClose } from "@/lib/yahoo";
import {
  fetchDexTokenPrices,
  priceSanityReject,
  MAX_PRICE_VS_REF_PCT,
} from "@/lib/dex-prices";
import { quoteBuyWithUsdt, simulateSwap } from "@/lib/pancakeswap";

const BASE =
  process.env.BINANCE_WEB3_BASE_URL?.replace(/\/$/, "") ||
  "https://web3.binance.com/build";

const ISSUERS: IssuerMeta[] = [
  {
    id: "bstocks",
    displayName: "bStocks",
    shortName: "bStocks",
    hoursNote: "Assumed US regular hours until API says otherwise",
  },
  {
    id: "ondo",
    displayName: "Ondo",
    shortName: "Ondo",
    hoursNote: "Assumed US regular hours until API says otherwise",
  },
  {
    id: "xstocks",
    displayName: "xStocks",
    shortName: "xStocks",
    hoursNote: "24/7 on DEX pools (BSC)",
  },
];


/** In-memory premium history for drift rising/falling (token vs close). */
const premiumHistory = new Map<
  string,
  { premiumPct: number; at: number }
>();

function premiumDirection(
  key: string,
  premiumPct: number | null
): "up" | "down" | "flat" | null {
  if (premiumPct == null) return null;
  const prev = premiumHistory.get(key);
  premiumHistory.set(key, { premiumPct, at: Date.now() });
  if (!prev || Date.now() - prev.at > 30 * 60_000) return null;
  const d = premiumPct - prev.premiumPct;
  if (d > 0.05) return "up";
  if (d < -0.05) return "down";
  return "flat";
}

function liqFromUsd(liq: number): "high" | "medium" | "low" {
  if (liq >= 500_000) return "high";
  if (liq >= 50_000) return "medium";
  return "low";
}

/**
 * Size-aware xStocks quote via PancakeSwap (+ DexScreener sanity).
 * Used when Binance RWA market price is empty / 202 / error.
 */
async function quoteXstocksPcsFallback(args: {
  ticker: string;
  listing: ReturnType<typeof listTokensForTicker>[number];
  amountUsd: number;
  referenceUsd: number | null;
  now: string;
}): Promise<RawIssuerQuote> {
  const { ticker: t, listing, amountUsd, referenceUsd, now } = args;
  const ratio = listing.tokenToShareRatio || 1;
  let tokenPriceUsd = 0;
  let volume24hUsd = 0;
  let liquidityUsd = 0;
  let dataSource = "pancakeswap-v2-fallback";
  let priceImpactPct: number | null = null;
  let tradeableNow = false;
  let tradeableReason: string | undefined;
  let pcsOk = false;
  let pcsBlockedReason: string | undefined;
  let hadPcsRoute = false;

  if (!listing.verified || !listing.address) {
    return {
      issuer: "xstocks",
      ticker: t,
      tokenSymbol: listing.tokenSymbol,
      tokenPriceUsd: 0,
      tokenToShareRatio: ratio,
      tokensPerShare: 1 / ratio,
      contractAddress: null,
      tradeableNow: false,
      tradeableReason: `No verified BSC address for ${listing.tokenSymbol} — unsupported until confirmed on BscScan / issuer docs.`,
      liquidity: "low",
      liquidityNote: listing.source,
      volume24hUsd: 0,
      updatedAt: now,
      dataSource: "unverified",
    };
  }

  const dexMap = await fetchDexTokenPrices([listing.address]);
  const dex = dexMap.get(listing.address.toLowerCase());
  if (dex?.priceUsd) {
    tokenPriceUsd = dex.priceUsd;
    volume24hUsd = dex.volume24hUsd;
    liquidityUsd = dex.liquidityUsd;
    dataSource = dex.liquidEnough
      ? "dexscreener-fallback"
      : "dexscreener-thin-fallback";
  }

  try {
    let pcs = await quoteBuyWithUsdt({
      tokenOut: listing.address,
      amountUsd: Math.max(amountUsd, 1),
      tokenDecimals: listing.decimals,
    });
    if (!pcs.ok && pcs.path.length === 0) {
      const wrap = XSTOCKS_WRAPPER_BSC[t];
      if (wrap) {
        pcs = await quoteBuyWithUsdt({
          tokenOut: wrap,
          amountUsd: Math.max(amountUsd, 1),
          tokenDecimals: listing.decimals,
        });
      }
    }
    if (pcs.path.length > 0) hadPcsRoute = true;
    if (pcs.effectiveTokenPriceUsd > 0) {
      tokenPriceUsd = pcs.effectiveTokenPriceUsd;
      priceImpactPct = pcs.priceImpactPct;
      dataSource = "pancakeswap-v2-fallback";
    }
    if (pcs.ok && pcs.effectiveTokenPriceUsd > 0 && !pcs.blocked) {
      pcsOk = true;
    } else if (pcs.blocked) {
      pcsBlockedReason = pcs.blockReason;
    } else if (!pcs.ok) {
      pcsBlockedReason =
        pcs.blockReason || "No liquid route on PancakeSwap V2.";
    }
  } catch {
    /* keep dex price if any */
  }

  let sanity =
    tokenPriceUsd > 0
      ? priceSanityReject(tokenPriceUsd / ratio, referenceUsd)
      : null;

  if (sanity && dex?.liquidEnough && dex.priceUsd > 0) {
    const dexSanity = priceSanityReject(dex.priceUsd / ratio, referenceUsd);
    if (!dexSanity) {
      tokenPriceUsd = dex.priceUsd;
      dataSource = "dexscreener-fallback";
      volume24hUsd = dex.volume24hUsd;
      liquidityUsd = dex.liquidityUsd;
      priceImpactPct = null;
      pcsOk = false;
      sanity = null;
      pcsBlockedReason =
        pcsBlockedReason ||
        "PancakeSwap quote was off-market — showing DexScreener price (not executable).";
    }
  }

  if (pcsOk && !sanity) {
    tradeableNow = true;
    tradeableReason = undefined;
  } else if (sanity) {
    tradeableNow = false;
    tradeableReason = sanity;
  } else if (pcsBlockedReason) {
    tradeableNow = false;
    tradeableReason = pcsBlockedReason;
  } else if (!hadPcsRoute) {
    tradeableNow = false;
    tradeableReason = "No liquid route on PancakeSwap V2 for this xStock.";
  } else {
    tradeableNow = false;
    tradeableReason = "No liquid route right now.";
  }

  if (!tokenPriceUsd) {
    tradeableNow = false;
    tradeableReason =
      tradeableReason ||
      `No live Binance or PancakeSwap price for ${listing.tokenSymbol}.`;
  }

  const pricePerShare =
    tokenPriceUsd > 0 && ratio > 0 ? tokenPriceUsd / ratio : 0;
  const premiumPct =
    referenceUsd && referenceUsd > 0 && pricePerShare > 0
      ? ((pricePerShare - referenceUsd) / referenceUsd) * 100
      : null;
  const driftDir = premiumDirection(`${t}:xstocks`, premiumPct);

  return {
    issuer: "xstocks",
    ticker: t,
    tokenSymbol: listing.tokenSymbol,
    tokenPriceUsd,
    tokenToShareRatio: ratio,
    tokensPerShare: 1 / ratio,
    contractAddress: listing.address,
    tradeableNow,
    tradeableReason,
    liquidity: liqFromUsd(liquidityUsd || volume24hUsd),
    liquidityNote:
      dataSource === "pancakeswap-v2-fallback"
        ? `PancakeSwap V2 fallback (Binance RWA price unavailable) · $${amountUsd}${
            priceImpactPct != null
              ? ` · impact ~${priceImpactPct.toFixed(2)}%`
              : ""
          }`
        : dataSource.startsWith("dexscreener")
          ? `DexScreener fallback (Binance RWA price unavailable) · liq ~$${Math.round(
              liquidityUsd
            ).toLocaleString()}`
          : `Fallback via ${dataSource}`,
    volume24hUsd,
    updatedAt: now,
    priceImpactPct,
    dataSource,
    premiumDirection: driftDir,
  };
}

export type LiveClientConfig = {
  apiKey: string;
  apiSecret: string;
  recvWindowMs?: number;
};

function signPayload(
  secret: string,
  timestamp: string,
  method: string,
  path: string,
  body: string
): string {
  // Docs: HMAC-SHA256 over timestamp + method + path + body (canonical form).
  const payload = `${timestamp}${method.toUpperCase()}${path}${body}`;
  return createHmac("sha256", secret).update(payload).digest("hex");
}

export class LiveBinanceWeb3Client implements BinanceWeb3Client {
  private apiKey: string;
  private apiSecret: string;
  private recvWindow: number;
  /** Cached RFQ quotes with expiry */
  private quoteCache = new Map<
    string,
    { expiresAt: number; payload: unknown }
  >();

  constructor(cfg: LiveClientConfig) {
    this.apiKey = cfg.apiKey;
    this.apiSecret = cfg.apiSecret;
    this.recvWindow = cfg.recvWindowMs ?? 5_000;
  }

  getMode(): DataMode {
    return "live";
  }

  /** Low-level signed request */
  async request<T = unknown>(
    method: "GET" | "POST",
    path: string,
    bodyObj?: Record<string, unknown>
  ): Promise<{ ok: boolean; status: number; data: T; errorCode?: number; errorMsg?: string }> {
    const timestamp = Date.now().toString();
    const body = bodyObj ? JSON.stringify(bodyObj) : "";
    const fullPath = path.startsWith("/") ? path : `/${path}`;
    const sign = signPayload(
      this.apiSecret,
      timestamp,
      method,
      fullPath,
      body
    );
    const res = await fetch(`${BASE}${fullPath}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        "X-OC-APIKEY": this.apiKey,
        "X-OC-TIMESTAMP": timestamp,
        "X-OC-SIGN": sign,
        "X-OC-RECV-WINDOW": String(this.recvWindow),
      },
      body: method === "POST" ? body : undefined,
    });
    const data = (await res.json().catch(() => ({}))) as T & {
      code?: number;
      msg?: string;
      message?: string;
    };
    const errorCode = typeof data?.code === "number" ? data.code : undefined;
    const errorMsg =
      (data as { msg?: string; message?: string })?.msg ||
      (data as { message?: string })?.message;
    return {
      ok: res.ok && (errorCode === undefined || errorCode === 0),
      status: res.status,
      data,
      errorCode,
      errorMsg,
    };
  }

  // ─── RWA Data ─────────────────────────────────────────────
  async rwaTokens(params?: Record<string, string>) {
    const q = params
      ? "?" + new URLSearchParams(params).toString()
      : "";
    return this.request("GET", `/bapi/defi/v1/public/wallet-direct/buw/wallet/market/token/rwa/tokens${q}`);
  }

  async rwaSearch(query: string) {
    return this.request(
      "GET",
      `/bapi/defi/v1/public/wallet-direct/buw/wallet/market/token/rwa/search?keyword=${encodeURIComponent(query)}`
    );
  }

  async rwaUnderlyingProfile(symbol: string) {
    return this.request(
      "GET",
      `/bapi/defi/v1/public/wallet-direct/buw/wallet/market/token/rwa/underlying-profile?symbol=${encodeURIComponent(symbol)}`
    );
  }

  // ─── Market ───────────────────────────────────────────────
  async marketPrice(symbol: string) {
    return this.request(
      "GET",
      `/bapi/defi/v1/public/wallet-direct/buw/wallet/market/token/rwa/price?symbol=${encodeURIComponent(symbol)}`
    );
  }

  // ─── Trading ──────────────────────────────────────────────
  async tradingQuote(body: Record<string, unknown>) {
    const res = await this.request("POST", `/bapi/defi/v1/private/wallet-direct/buw/wallet/market/token/rwa/quote`, body);
    if (res.ok) {
      const key = JSON.stringify(body);
      this.quoteCache.set(key, {
        expiresAt: Date.now() + QUOTE_EXPIRY_MS,
        payload: res.data,
      });
    }
    return res;
  }

  async tradingSwap(body: Record<string, unknown>) {
    return this.request("POST", `/bapi/defi/v1/private/wallet-direct/buw/wallet/market/token/rwa/swap`, body);
  }

  async orderSubmit(body: Record<string, unknown>) {
    return this.request("POST", `/bapi/defi/v1/private/wallet-direct/buw/wallet/market/token/rwa/order/submit`, body);
  }

  async pollOrder(orderId: string) {
    return this.request(
      "GET",
      `/bapi/defi/v1/private/wallet-direct/buw/wallet/market/token/rwa/order/status?orderId=${encodeURIComponent(orderId)}`
    );
  }

  // ─── Transaction ──────────────────────────────────────────
  async transactionSimulate(body: Record<string, unknown>) {
    return this.request("POST", `/bapi/defi/v1/private/wallet-direct/buw/wallet/market/token/rwa/simulate`, body);
  }

  mapTradeError(code?: number, fallback?: string): string {
    if (code != null && BINANCE_ERROR_MAP[code]) return BINANCE_ERROR_MAP[code];
    return fallback || `Binance Web3 error${code != null ? ` ${code}` : ""}`;
  }

  isQuoteExpired(cacheKey: string): boolean {
    const e = this.quoteCache.get(cacheKey);
    if (!e) return true;
    return Date.now() > e.expiresAt;
  }

  // ─── BinanceWeb3Client surface ────────────────────────────
  async listIssuers(): Promise<IssuerMeta[]> {
    return ISSUERS;
  }

  async getMarketClose(ticker: Ticker): Promise<MarketClose | null> {
    // Prefer RWA underlying profile when live; fall back to Yahoo last completed bar.
    try {
      const res = await this.rwaUnderlyingProfile(ticker.toUpperCase());
      const d = res.data as {
        data?: { lastClose?: number; closeTime?: string };
      };
      if (res.ok && d?.data?.lastClose) {
        return {
          ticker: ticker.toUpperCase(),
          closeUsd: d.data.lastClose,
          asOf: d.data.closeTime || new Date().toISOString(),
          sessionLabel: "NYSE close (Binance RWA)",
        };
      }
    } catch {
      /* ignore */
    }
    const y = await fetchYahooClose(ticker);
    if (!y) return null;
    return {
      ticker: y.ticker,
      closeUsd: y.closeUsd,
      asOf: y.asOf,
      sessionLabel: "NYSE regular close (Yahoo fallback)",
      direction: y.direction,
    };
  }

  async getQuotes(
    ticker: Ticker,
    amountUsd = 20
  ): Promise<RawIssuerQuote[]> {
    const t = ticker.toUpperCase();
    const listings = listTokensForTicker(t);
    const now = new Date().toISOString();
    const status = getMarketStatus();
    const yahoo = await fetchYahooClose(t);
    const referenceUsd = yahoo?.closeUsd ?? yahoo?.lastPriceUsd ?? null;
    const quotes: RawIssuerQuote[] = [];

    for (const listing of listings) {
      const trade = issuerTradeability(listing.issuer, status);
      let tokenPriceUsd = 0;
      let volume24hUsd = 0;
      let dataSource = "binance-rwa";
      let tradeableNow = trade.tradeableNow && listing.verified;
      let tradeableReason = !listing.verified
        ? `No verified BSC address for ${listing.tokenSymbol} — marked unsupported.`
        : trade.tradeableReason;
      let binancePriceOk = false;

      try {
        const res = await this.marketPrice(listing.tokenSymbol);
        const d = res.data as {
          data?: { price?: number; volume24h?: number };
          code?: number;
        };
        const price = d?.data?.price;
        // HTTP 202 empty / missing price → treat as unavailable
        if (res.ok && typeof price === "number" && price > 0) {
          tokenPriceUsd = price;
          volume24hUsd = d.data?.volume24h ?? 0;
          binancePriceOk = true;
        } else if (res.errorCode === 40367 || res.errorCode === 40369) {
          tradeableNow = false;
          tradeableReason = this.mapTradeError(res.errorCode);
          dataSource = "binance-rwa-session";
        } else {
          dataSource = "binance-rwa-unavailable";
        }
      } catch {
        dataSource = "binance-rwa-error";
      }

      // xStocks: when Binance RWA price fails, fall back to PCS / Dex (24/7)
      if (listing.issuer === "xstocks" && !binancePriceOk) {
        quotes.push(
          await quoteXstocksPcsFallback({
            ticker: t,
            listing,
            amountUsd,
            referenceUsd,
            now,
          })
        );
        continue;
      }

      // Ondo / bStocks keep market-clock gating; no PCS execute in live mode yet
      if (listing.issuer !== "xstocks") {
        if (!listing.verified) {
          tradeableNow = false;
        } else if (!binancePriceOk) {
          tradeableNow = false;
          tradeableReason =
            tradeableReason ||
            "Live Binance price unavailable for this token.";
        } else if (!trade.tradeableNow) {
          tradeableNow = false;
          tradeableReason = trade.tradeableReason;
        }
      } else if (binancePriceOk) {
        // Binance had a live xStocks price — still size-check via PCS when possible
        if (listing.address) {
          try {
            const pcs = await quoteBuyWithUsdt({
              tokenOut: listing.address,
              amountUsd: Math.max(amountUsd, 1),
              tokenDecimals: listing.decimals,
            });
            if (pcs.ok && pcs.effectiveTokenPriceUsd > 0 && !pcs.blocked) {
              tokenPriceUsd = pcs.effectiveTokenPriceUsd;
              dataSource = "binance-rwa+pancakeswap-v2";
              const sanity = priceSanityReject(
                tokenPriceUsd / (listing.tokenToShareRatio || 1),
                referenceUsd
              );
              if (sanity) {
                tradeableNow = false;
                tradeableReason = sanity;
              } else {
                tradeableNow = true;
                tradeableReason = undefined;
              }
              const ratio = listing.tokenToShareRatio || 1;
              const pricePerShare = tokenPriceUsd / ratio;
              const premiumPct =
                referenceUsd && referenceUsd > 0
                  ? ((pricePerShare - referenceUsd) / referenceUsd) * 100
                  : null;
              quotes.push({
                issuer: listing.issuer,
                ticker: t,
                tokenSymbol:
                  listing.tokenSymbol || tokenSymbolFor(t, listing.issuer),
                tokenPriceUsd,
                tokenToShareRatio: ratio,
                tokensPerShare: ratio > 0 ? 1 / ratio : 1,
                contractAddress: listing.address,
                tradeableNow,
                tradeableReason,
                liquidity:
                  volume24hUsd > 1_000_000
                    ? "high"
                    : volume24hUsd > 100_000
                      ? "medium"
                      : "low",
                liquidityNote: `Binance RWA + PCS size-aware ($${amountUsd}) · impact ~${(
                  pcs.priceImpactPct ?? 0
                ).toFixed(2)}%`,
                volume24hUsd,
                updatedAt: now,
                priceImpactPct: pcs.priceImpactPct,
                dataSource,
                premiumDirection: premiumDirection(
                  `${t}:xstocks`,
                  premiumPct
                ),
              });
              continue;
            }
            if (pcs.blocked || !pcs.ok) {
              // Keep Binance mid as display; mark untradeable with honest PCS reason
              tradeableNow = false;
              tradeableReason =
                pcs.blockReason ||
                "No liquid route on PancakeSwap V2 for this xStock.";
              dataSource = "binance-rwa-pcs-blocked";
            }
          } catch {
            /* keep Binance price */
          }
        }
      }

      const ratio = listing.tokenToShareRatio || 1;
      const pricePerShare =
        tokenPriceUsd > 0 && ratio > 0 ? tokenPriceUsd / ratio : 0;
      const premiumPct =
        referenceUsd && referenceUsd > 0 && pricePerShare > 0
          ? ((pricePerShare - referenceUsd) / referenceUsd) * 100
          : null;

      quotes.push({
        issuer: listing.issuer,
        ticker: t,
        tokenSymbol: listing.tokenSymbol || tokenSymbolFor(t, listing.issuer),
        tokenPriceUsd,
        tokenToShareRatio: ratio,
        tokensPerShare: ratio > 0 ? 1 / ratio : 1,
        contractAddress: listing.address,
        tradeableNow: tradeableNow && tokenPriceUsd > 0,
        tradeableReason:
          tradeableNow && tokenPriceUsd <= 0
            ? "Live Binance price unavailable for this token."
            : tradeableReason,
        liquidity:
          volume24hUsd > 1_000_000
            ? "high"
            : volume24hUsd > 100_000
              ? "medium"
              : "low",
        liquidityNote: binancePriceOk
          ? "Live Binance Web3 quote"
          : "Binance RWA price unavailable",
        volume24hUsd,
        updatedAt: now,
        dataSource,
        premiumDirection: premiumDirection(
          `${t}:${listing.issuer}`,
          premiumPct
        ),
      });
    }
    return quotes;
  }

  async simulateTrade(req: SimulateTradeRequest): Promise<SimulateTradeResult> {
    const t = req.ticker.toUpperCase();

    // Ondo / bStocks: never green OK — session gate + Binance fill pending
    if (req.issuer === "ondo" || req.issuer === "bstocks") {
      const status = getMarketStatus();
      const trade = issuerTradeability(req.issuer, status);
      const quotes = await this.getQuotes(t, req.amountUsd);
      const q = quotes.find((x) => x.issuer === req.issuer);
      const ratio = q?.tokenToShareRatio || 1;
      const pps =
        q && q.tokenPriceUsd > 0 && ratio > 0 ? q.tokenPriceUsd / ratio : 0;
      return {
        ok: false,
        issuer: req.issuer,
        ticker: t,
        amountUsd: req.amountUsd,
        estimatedTokens:
          q && q.tokenPriceUsd > 0 ? req.amountUsd / q.tokenPriceUsd : 0,
        effectivePricePerShare: pps,
        estimatedFeesUsd: 0,
        route: `${q?.tokenSymbol ?? req.issuer} — Binance Web3`,
        steps: [
          {
            label: trade.tradeableNow
              ? "US regular session open"
              : "Outside US regular hours",
            status: trade.tradeableNow ? "ok" : "skip",
          },
          {
            label: "Live trading coming soon via Binance",
            status: "pending",
          },
        ],
        warning: trade.tradeableNow
          ? "Live trading coming soon via Binance"
          : trade.tradeableReason || "Can't trade right now",
        comingSoonBinance: true,
      };
    }

    // xStocks: real PCS dry-run (same as hybrid) — Binance RWA may be empty
    if (req.issuer === "xstocks") {
      const listing = getTokenListing(t, "xstocks");
      const yahoo = await fetchYahooClose(t);
      const referenceUsd = yahoo?.closeUsd ?? null;
      const quotes = await this.getQuotes(t, req.amountUsd);
      const q = quotes.find((x) => x.issuer === "xstocks");

      if (!listing?.verified || !listing.address) {
        return {
          ok: false,
          issuer: req.issuer,
          ticker: t,
          amountUsd: req.amountUsd,
          estimatedTokens: 0,
          effectivePricePerShare: 0,
          estimatedFeesUsd: 0,
          route: "none",
          steps: [{ label: "Verify BSC contract", status: "skip" }],
          warning: `No verified address for ${tokenSymbolFor(t, "xstocks")}.`,
        };
      }

      if (q && !q.tradeableNow) {
        return {
          ok: false,
          issuer: req.issuer,
          ticker: t,
          amountUsd: req.amountUsd,
          estimatedTokens: 0,
          effectivePricePerShare:
            q.tokenToShareRatio > 0
              ? q.tokenPriceUsd / q.tokenToShareRatio
              : 0,
          estimatedFeesUsd: 0,
          route: `${q.tokenSymbol} (unavailable)`,
          steps: [
            { label: "Check liquid route", status: "skip" },
            { label: "Build swap path", status: "skip" },
          ],
          warning: q.tradeableReason ?? "Not tradeable right now",
        };
      }

      let pcs = await quoteBuyWithUsdt({
        tokenOut: listing.address,
        amountUsd: req.amountUsd,
        tokenDecimals: listing.decimals,
      });
      if (!pcs.ok && pcs.path.length === 0) {
        const wrap = XSTOCKS_WRAPPER_BSC[t];
        if (wrap) {
          pcs = await quoteBuyWithUsdt({
            tokenOut: wrap,
            amountUsd: req.amountUsd,
            tokenDecimals: listing.decimals,
          });
        }
      }
      if (!pcs.ok || pcs.blocked) {
        return {
          ok: false,
          issuer: req.issuer,
          ticker: t,
          amountUsd: req.amountUsd,
          estimatedTokens: 0,
          effectivePricePerShare: pcs.effectiveTokenPriceUsd || 0,
          estimatedFeesUsd: 0,
          route: pcs.pathLabel || "PCS",
          steps: [
            { label: "Check liquid route", status: "skip" },
            { label: "PancakeSwap getAmountsOut", status: "skip" },
          ],
          warning: pcs.blockReason || "PCS quote failed",
          blocked: true,
          priceImpactPct: pcs.priceImpactPct,
        };
      }

      const ratio = listing.tokenToShareRatio || 1;
      const execPps = pcs.effectiveTokenPriceUsd / ratio;
      if (referenceUsd && referenceUsd > 0 && execPps > 0) {
        const premPct = ((execPps - referenceUsd) / referenceUsd) * 100;
        if (premPct > MAX_PRICE_VS_REF_PCT) {
          return {
            ok: false,
            issuer: req.issuer,
            ticker: t,
            amountUsd: req.amountUsd,
            estimatedTokens: pcs.amountOutTokens,
            effectivePricePerShare: execPps,
            estimatedFeesUsd: req.amountUsd * 0.0025,
            route: `USDT → ${q?.tokenSymbol ?? listing.tokenSymbol} via ${pcs.pathLabel}`,
            steps: [
              { label: "Check liquid route", status: "ok" },
              { label: "PancakeSwap getAmountsOut", status: "ok" },
              {
                label: `Blocked: ~${premPct.toFixed(1)}% above last close`,
                status: "skip",
              },
            ],
            warning: `Execution ~${premPct.toFixed(
              1
            )}% above last close ($${referenceUsd.toFixed(
              2
            )}). Max allowed ~${MAX_PRICE_VS_REF_PCT}% — try a smaller size or wait for a fairer pool.`,
            blocked: true,
            priceImpactPct: pcs.priceImpactPct,
          };
        }
      }

      let simOk = true;
      let simErr: string | undefined;
      if (req.walletAddress && req.walletAddress.startsWith("0x")) {
        const sim = await simulateSwap({
          from: req.walletAddress as `0x${string}`,
          amountInWei: BigInt(pcs.amountInWei),
          amountOutMinWei: BigInt(pcs.amountOutMinWei),
          path: pcs.path,
        });
        simOk = sim.ok;
        simErr = sim.error;
      }

      return {
        ok: simOk || !req.walletAddress,
        issuer: req.issuer,
        ticker: t,
        amountUsd: req.amountUsd,
        estimatedTokens: pcs.amountOutTokens,
        effectivePricePerShare: execPps,
        estimatedFeesUsd: req.amountUsd * 0.0025,
        route: `USDT → ${q?.tokenSymbol ?? listing.tokenSymbol} via ${pcs.pathLabel} (PancakeSwap V2 fallback)`,
        steps: [
          { label: "Check liquid route", status: "ok" },
          { label: "PancakeSwap getAmountsOut", status: "ok" },
          {
            label: req.walletAddress
              ? "eth_call dry-run swap"
              : "eth_call dry-run (connect wallet for full sim)",
            status: req.walletAddress ? (simOk ? "ok" : "skip") : "pending",
          },
          { label: "Slippage protection set", status: "ok" },
        ],
        warning: simErr || pcs.warning,
        priceImpactPct: pcs.priceImpactPct,
        pcs: {
          tokenIn: pcs.tokenIn,
          tokenOut: pcs.tokenOut,
          amountInWei: pcs.amountInWei,
          amountOutMinWei: pcs.amountOutMinWei,
          path: pcs.path,
          slippageBps: pcs.slippageBps,
        },
      };
    }

    // Fallback: try Binance /simulate
    const res = await this.transactionSimulate({
      issuer: req.issuer,
      symbol: req.ticker,
      amountUsd: req.amountUsd,
      walletAddress: req.walletAddress,
    });
    if (!res.ok) {
      return {
        ok: false,
        issuer: req.issuer,
        ticker: t,
        amountUsd: req.amountUsd,
        estimatedTokens: 0,
        effectivePricePerShare: 0,
        estimatedFeesUsd: 0,
        route: "binance-web3",
        steps: [{ label: "Binance /simulate", status: "skip" }],
        warning: this.mapTradeError(res.errorCode, res.errorMsg),
      };
    }
    const d = res.data as {
      data?: {
        tokensOut?: number;
        pricePerShare?: number;
        feesUsd?: number;
        route?: string;
      };
    };
    return {
      ok: true,
      issuer: req.issuer,
      ticker: t,
      amountUsd: req.amountUsd,
      estimatedTokens: d?.data?.tokensOut ?? 0,
      effectivePricePerShare: d?.data?.pricePerShare ?? 0,
      estimatedFeesUsd: d?.data?.feesUsd ?? 0,
      route: d?.data?.route ?? "Binance Web3 spot",
      steps: [
        { label: "Check trade window", status: "ok" },
        { label: "Binance quote (30s expiry)", status: "ok" },
        { label: "Transaction /simulate", status: "ok" },
      ],
    };
  }

  async executeTrade(req: ExecuteTradeRequest): Promise<ExecuteTradeResult> {
    if (req.issuer === "xstocks") {
      return {
        ok: false,
        stubbed: true,
        message:
          "xStocks buys are signed in the browser via wagmi (approve + PancakeSwap). Use Connect wallet & buy in the UI — server never holds keys.",
      };
    }
    if (req.issuer === "ondo" || req.issuer === "bstocks") {
      return {
        ok: false,
        stubbed: true,
        message:
          "Live trading coming soon via Binance. Spot only — no auto-sign.",
      };
    }
    const submit = await this.orderSubmit({
      issuer: req.issuer,
      symbol: req.ticker,
      amountUsd: req.amountUsd,
      simulationId: req.simulationId,
    });
    if (!submit.ok) {
      return {
        ok: false,
        stubbed: false,
        message: this.mapTradeError(submit.errorCode, submit.errorMsg),
      };
    }
    const d = submit.data as { data?: { orderId?: string; txHash?: string } };
    if (d?.data?.orderId) {
      for (let i = 0; i < 5; i++) {
        await new Promise((r) => setTimeout(r, 1500));
        const st = await this.pollOrder(d.data!.orderId!);
        const sd = st.data as { data?: { status?: string; txHash?: string } };
        if (sd?.data?.status === "filled" || sd?.data?.txHash) {
          return {
            ok: true,
            stubbed: false,
            message: "Order filled",
            txHash: sd.data.txHash,
          };
        }
      }
    }
    return {
      ok: Boolean(d?.data?.txHash),
      stubbed: false,
      message: d?.data?.txHash ? "Submitted" : "Order submitted — still pending",
      txHash: d?.data?.txHash,
    };
  }
}

