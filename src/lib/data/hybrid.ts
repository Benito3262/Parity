/**
 * Hybrid data client: Yahoo (underlying close) + DexScreener (token prices)
 * + market clock + PancakeSwap size-aware quotes for xStocks.
 * Used when BINANCE_LIVE is not enabled.
 */

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
} from "@/lib/binance-web3/types";
import {
  FEATURED_TICKER_SET,
  getTokenListing,
  listTokensForTicker,
  tokenSymbolFor,
  XSTOCKS_WRAPPER_BSC,
} from "@/lib/tokens";
import { getMarketStatus, issuerTradeability } from "@/lib/market-clock";
import { fetchYahooClose } from "@/lib/yahoo";
import { cmcQuotesBySymbol, getCmcApiKey } from "@/lib/cmc";
import {
  fetchDexTokenPrices,
  priceSanityReject,
  MIN_POOL_LIQUIDITY_USD,
  MIN_POOL_VOLUME_24H_USD,
  MAX_PRICE_VS_REF_PCT,
} from "@/lib/dex-prices";
import { quoteBuyWithUsdt, simulateSwap } from "@/lib/pancakeswap";

const ISSUERS: IssuerMeta[] = [
  {
    id: "bstocks",
    displayName: "bStocks",
    shortName: "bStocks",
    hoursNote: "Assumed US regular hours until Binance API says otherwise",
  },
  {
    id: "ondo",
    displayName: "Ondo",
    shortName: "Ondo",
    hoursNote: "Assumed US regular hours until Binance API says otherwise",
  },
  {
    id: "xstocks",
    displayName: "xStocks",
    shortName: "xStocks",
    hoursNote: "24/7 on PancakeSwap / DEX pools (BSC)",
  },
];

function liqFromUsd(liq: number): "high" | "medium" | "low" {
  if (liq >= 500_000) return "high";
  if (liq >= 50_000) return "medium";
  return "low";
}

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

export class HybridDataClient implements BinanceWeb3Client {
  getMode(): DataMode {
    return "hybrid";
  }

  async listIssuers(): Promise<IssuerMeta[]> {
    return ISSUERS;
  }

  async getMarketClose(ticker: Ticker): Promise<MarketClose | null> {
    const y = await fetchYahooClose(ticker);
    if (!y) return null;
    return {
      ticker: y.ticker,
      closeUsd: y.closeUsd,
      asOf: y.asOf,
      sessionLabel: "NYSE regular close",
      direction: y.direction,
    };
  }

  async getQuotes(
    ticker: Ticker,
    amountUsd = 20
  ): Promise<RawIssuerQuote[]> {
    const t = ticker.toUpperCase();
    void FEATURED_TICKER_SET;
    const listings = listTokensForTicker(t);
    if (listings.length === 0) return [];

    const status = getMarketStatus();
    const now = new Date().toISOString();
    const addresses = listings
      .filter((l) => l.verified && l.address)
      .map((l) => l.address!) as string[];

    const dexMap = await fetchDexTokenPrices(addresses);
    let cmcBySymbol: Record<
      string,
      { priceUsd: number; volume24h: number | null }
    > = {};
    if (getCmcApiKey()) {
      const cmc = await cmcQuotesBySymbol(
        listings.map((l) => l.tokenSymbol)
      );
      if (cmc.ok) {
        for (const [sym, q] of Object.entries(cmc.quotes)) {
          cmcBySymbol[sym] = {
            priceUsd: q.priceUsd,
            volume24h: q.volume24h,
          };
        }
      }
    }

    const yahoo = await fetchYahooClose(t);
    const referenceUsd =
      yahoo?.closeUsd ?? yahoo?.lastPriceUsd ?? null;

    const quotes: RawIssuerQuote[] = [];

    for (const listing of listings) {
      const trade = issuerTradeability(listing.issuer, status);
      const ratio = listing.tokenToShareRatio || 1;

      if (!listing.verified || !listing.address) {
        quotes.push({
          issuer: listing.issuer,
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
        });
        continue;
      }

      const dex = dexMap.get(listing.address.toLowerCase());
      const cmc = cmcBySymbol[listing.tokenSymbol.toUpperCase()];

      let tokenPriceUsd = 0;
      let volume24hUsd = 0;
      let liquidityUsd = 0;
      let dataSource = "none";
      let poolOk = true;
      let poolReject: string | undefined;

      if (cmc?.priceUsd) {
        tokenPriceUsd = cmc.priceUsd;
        volume24hUsd = cmc.volume24h ?? 0;
        dataSource = "coinmarketcap";
      }

      if (dex?.priceUsd) {
        liquidityUsd = dex.liquidityUsd;
        volume24hUsd = volume24hUsd || dex.volume24hUsd;
        if (!dex.liquidEnough) {
          poolOk = false;
          poolReject = dex.rejectReason;
        }
        // Prefer dex for on-chain price when liquid enough
        if (dex.liquidEnough && (listing.issuer === "xstocks" || !tokenPriceUsd)) {
          tokenPriceUsd = dex.priceUsd;
          dataSource = "dexscreener";
        } else if (!tokenPriceUsd && !dex.liquidEnough) {
          // Keep thin-pool price for display only — not tradeable
          tokenPriceUsd = dex.priceUsd;
          dataSource = "dexscreener-thin";
        } else if (!tokenPriceUsd) {
          tokenPriceUsd = dex.priceUsd;
          dataSource = "dexscreener";
        }
      }

      // Size-aware PCS quote for xStocks (and as price discovery for others when possible)
      let priceImpactPct: number | null = null;
      let pcsOk = false;
      let pcsBlockedReason: string | undefined;
      let hadPcsRoute = false;

      if (listing.issuer === "xstocks" && listing.address) {
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
            dataSource = "pancakeswap-v2";
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
          /* keep prior price */
        }
      }

      // Sanity vs reference stock price (per share)
      let sanity =
        tokenPriceUsd > 0
          ? priceSanityReject(tokenPriceUsd / ratio, referenceUsd)
          : null;

      // If PCS/dex price is off-market, prefer a liquid DexScreener price for display
      if (sanity && dex?.liquidEnough && dex.priceUsd > 0) {
        const dexSanity = priceSanityReject(dex.priceUsd / ratio, referenceUsd);
        if (!dexSanity) {
          tokenPriceUsd = dex.priceUsd;
          dataSource = "dexscreener";
          volume24hUsd = dex.volume24hUsd;
          liquidityUsd = dex.liquidityUsd;
          priceImpactPct = null;
          pcsOk = false;
          sanity = null;
          if (listing.issuer === "xstocks") {
            pcsBlockedReason =
              pcsBlockedReason ||
              "PancakeSwap quote was off-market — showing DexScreener price (not executable).";
          }
        }
      }

      let tradeableNow = trade.tradeableNow;
      let tradeableReason = trade.tradeableReason;

      if (listing.issuer === "xstocks") {
        if (pcsOk && !sanity) {
          tradeableNow = true;
          tradeableReason = undefined;
        } else if (sanity) {
          tradeableNow = false;
          tradeableReason = sanity;
        } else if (pcsBlockedReason) {
          tradeableNow = false;
          // Prefer impact / liquid wording — never "Closed"
          tradeableReason = pcsBlockedReason;
        } else if (!hadPcsRoute) {
          tradeableNow = false;
          tradeableReason = "No liquid route on PancakeSwap V2 for this xStock.";
        } else {
          tradeableNow = false;
          tradeableReason = "No liquid route right now.";
        }
      } else {
        // Ondo / bStocks: not executable until Binance Web3 — never rank as best.
        tradeableNow = false;
        if (sanity) {
          tradeableReason = sanity;
        } else if (!poolOk && dataSource.startsWith("dexscreener")) {
          tradeableReason =
            poolReject ||
            `Thin pool (need ≥$${MIN_POOL_LIQUIDITY_USD.toLocaleString()} liquidity and ≥$${MIN_POOL_VOLUME_24H_USD.toLocaleString()} 24h volume).`;
        } else if (!tokenPriceUsd) {
          tradeableReason = `No live price for ${listing.tokenSymbol} yet.`;
        } else if (!trade.tradeableNow) {
          tradeableReason =
            (trade.tradeableReason ? trade.tradeableReason + " " : "") +
            "Live trading coming soon via Binance.";
        } else {
          tradeableReason =
            "Live trading coming soon via Binance (compare-only until portal API keys).";
        }
      }

      if (!tokenPriceUsd && yahoo?.lastPriceUsd) {
        tokenPriceUsd = yahoo.lastPriceUsd;
        dataSource = "yahoo-underlying-proxy";
        if (listing.issuer === "xstocks") {
          tradeableNow = false;
          tradeableReason =
            tradeableReason ||
            "No liquid route — showing underlying proxy price only.";
        }
      }

      if (!tokenPriceUsd) {
        tradeableNow = false;
        tradeableReason =
          tradeableReason || `No live price for ${listing.tokenSymbol} yet.`;
      }

      // Premium direction from token premium vs close over time
      const pricePerShare =
        tokenPriceUsd > 0 && ratio > 0 ? tokenPriceUsd / ratio : 0;
      const premiumPct =
        referenceUsd && referenceUsd > 0 && pricePerShare > 0
          ? ((pricePerShare - referenceUsd) / referenceUsd) * 100
          : null;
      const driftDir = premiumDirection(
        `${t}:${listing.issuer}`,
        premiumPct
      );

      const liq = liqFromUsd(liquidityUsd || volume24hUsd);
      quotes.push({
        issuer: listing.issuer,
        ticker: t,
        tokenSymbol: listing.tokenSymbol,
        tokenPriceUsd,
        tokenToShareRatio: ratio,
        tokensPerShare: 1 / ratio,
        contractAddress: listing.address,
        tradeableNow,
        tradeableReason,
        liquidity: liq,
        liquidityNote:
          dataSource === "yahoo-underlying-proxy"
            ? "Using underlying last price as proxy — on-chain pool quote unavailable"
            : dataSource === "pancakeswap-v2"
              ? `PancakeSwap V2 size-aware quote ($${amountUsd})${
                  priceImpactPct != null
                    ? ` · impact ~${priceImpactPct.toFixed(2)}%`
                    : ""
                }`
              : dataSource === "dexscreener-thin"
                ? poolReject || "Thin pool — display only"
                : dataSource === "coinmarketcap"
                  ? "Price via CoinMarketCap"
                  : dataSource === "dexscreener"
                    ? `Price via DexScreener · liq ~$${Math.round(
                        liquidityUsd
                      ).toLocaleString()}`
                    : `Price via ${dataSource}`,
        volume24hUsd,
        updatedAt: now,
        priceImpactPct,
        dataSource,
        premiumDirection: driftDir,
      });
    }

    return quotes;
  }

  async simulateTrade(req: SimulateTradeRequest): Promise<SimulateTradeResult> {
    const t = req.ticker.toUpperCase();
    const listing = getTokenListing(t, req.issuer);
    const quotes = await this.getQuotes(t, req.amountUsd);
    const q = quotes.find((x) => x.issuer === req.issuer);
    const yahoo = await fetchYahooClose(t);
    const referenceUsd = yahoo?.closeUsd ?? null;

    if (!listing?.verified) {
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
        warning: `No verified address for ${tokenSymbolFor(t, req.issuer)}.`,
      };
    }

    if (!q) {
      return {
        ok: false,
        issuer: req.issuer,
        ticker: t,
        amountUsd: req.amountUsd,
        estimatedTokens: 0,
        effectivePricePerShare: 0,
        estimatedFeesUsd: 0,
        route: "none",
        steps: [{ label: "Lookup quote", status: "skip" }],
        warning: `No quote for ${t} on ${req.issuer}`,
      };
    }

    // Ondo / bStocks: never green "Test run OK" — live fill needs Binance
    if (req.issuer === "ondo" || req.issuer === "bstocks") {
      const ratio = q.tokenToShareRatio || 1;
      const pps =
        ratio > 0 && q.tokenPriceUsd > 0 ? q.tokenPriceUsd / ratio : 0;
      return {
        ok: false,
        issuer: req.issuer,
        ticker: t,
        amountUsd: req.amountUsd,
        estimatedTokens:
          q.tokenPriceUsd > 0 ? req.amountUsd / q.tokenPriceUsd : 0,
        effectivePricePerShare: pps,
        estimatedFeesUsd: 0,
        route: `${q.tokenSymbol} — Binance Web3 pending`,
        steps: [
          { label: "Compare prices (hybrid data)", status: "ok" },
          {
            label: "Live trading coming soon via Binance",
            status: "pending",
          },
        ],
        warning: "Live trading coming soon via Binance",
        comingSoonBinance: true,
      };
    }

    if (!q.tradeableNow) {
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

    // xStocks: real PCS dry-run
    if (req.issuer === "xstocks" && listing.address) {
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

      // Hard block when execution is >~3% above reference close
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
            route: `USDT → ${q.tokenSymbol} via ${pcs.pathLabel}`,
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

      const feeUsd = req.amountUsd * 0.0025;
      return {
        ok: simOk || !req.walletAddress,
        issuer: req.issuer,
        ticker: t,
        amountUsd: req.amountUsd,
        estimatedTokens: pcs.amountOutTokens,
        effectivePricePerShare: execPps,
        estimatedFeesUsd: feeUsd,
        route: `USDT → ${q.tokenSymbol} via ${pcs.pathLabel} (PancakeSwap V2)`,
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
        warning:
          simErr ||
          pcs.warning ||
          (q.liquidity === "low"
            ? "Low liquidity — expect more slippage on live execute"
            : undefined),
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

    return {
      ok: false,
      issuer: req.issuer,
      ticker: t,
      amountUsd: req.amountUsd,
      estimatedTokens: 0,
      effectivePricePerShare: 0,
      estimatedFeesUsd: 0,
      route: "none",
      steps: [{ label: "Unsupported issuer path", status: "skip" }],
      warning: "Unsupported simulate path",
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
    return {
      ok: false,
      stubbed: true,
      message:
        "Live trading coming soon via Binance. Ondo/bStock execute needs BINANCE_LIVE=true + portal API keys.",
    };
  }
}

export const HYBRID_TICKERS = [...FEATURED_TICKER_SET];

/** Re-export thresholds for UI/docs */
export {
  MIN_POOL_LIQUIDITY_USD,
  MIN_POOL_VOLUME_24H_USD,
  MAX_PRICE_VS_REF_PCT,
};
