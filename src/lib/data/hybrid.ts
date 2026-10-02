/**
 * Hybrid data client: Yahoo (underlying close) + DexScreener/CMC (token prices)
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
import { fetchDexTokenPrices } from "@/lib/dex-prices";
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

function liqFromUsd(
  liq: number
): "high" | "medium" | "low" {
  if (liq >= 500_000) return "high";
  if (liq >= 50_000) return "medium";
  return "low";
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
    if (!FEATURED_TICKER_SET.has(t)) {
      // Still attempt — Yahoo may work; tokens may be unverified
    }
    const listings = listTokensForTicker(t);
    if (listings.length === 0) return [];

    const status = getMarketStatus();
    const now = new Date().toISOString();
    const addresses = listings
      .filter((l) => l.verified && l.address)
      .map((l) => l.address!) as string[];

    // Prefer CMC when keyed; always try DexScreener for BSC addresses
    const dexMap = await fetchDexTokenPrices(addresses);
    let cmcBySymbol: Record<string, { priceUsd: number; volume24h: number | null }> =
      {};
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

    // Yahoo last price as last-resort reference (labeled)
    const yahoo = await fetchYahooClose(t);

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

      if (cmc?.priceUsd) {
        tokenPriceUsd = cmc.priceUsd;
        volume24hUsd = cmc.volume24h ?? 0;
        dataSource = "coinmarketcap";
      }
      if (dex?.priceUsd) {
        // Prefer dex for on-chain tradable price when we will route via PCS
        if (listing.issuer === "xstocks" || !tokenPriceUsd) {
          tokenPriceUsd = dex.priceUsd;
          volume24hUsd = dex.volume24hUsd;
          liquidityUsd = dex.liquidityUsd;
          dataSource = "dexscreener";
        } else {
          liquidityUsd = dex.liquidityUsd;
          volume24hUsd = volume24hUsd || dex.volume24hUsd;
        }
      }

      // Size-aware PCS quote for xStocks (required for live buy path)
      let priceImpactPct: number | null = null;
      let pcsOk = false;
      if (listing.issuer === "xstocks" && listing.address) {
        try {
          let pcs = await quoteBuyWithUsdt({
            tokenOut: listing.address,
            amountUsd: Math.max(amountUsd, 5),
            tokenDecimals: listing.decimals,
          });
          if (!pcs.ok) {
            const wrap = XSTOCKS_WRAPPER_BSC[t];
            if (wrap) {
              pcs = await quoteBuyWithUsdt({
                tokenOut: wrap,
                amountUsd: Math.max(amountUsd, 5),
                tokenDecimals: listing.decimals,
              });
            }
          }
          if (pcs.ok && pcs.effectiveTokenPriceUsd > 0 && !pcs.blocked) {
            tokenPriceUsd = pcs.effectiveTokenPriceUsd;
            priceImpactPct = pcs.priceImpactPct;
            dataSource = "pancakeswap-v2";
            pcsOk = true;
          } else if (pcs.blocked) {
            tokenPriceUsd = pcs.effectiveTokenPriceUsd || tokenPriceUsd;
            priceImpactPct = pcs.priceImpactPct;
            dataSource = "pancakeswap-v2";
            quotes.push({
              issuer: listing.issuer,
              ticker: t,
              tokenSymbol: listing.tokenSymbol,
              tokenPriceUsd: tokenPriceUsd || yahoo?.lastPriceUsd || 0,
              tokenToShareRatio: ratio,
              tokensPerShare: 1 / ratio,
              contractAddress: listing.address,
              tradeableNow: false,
              tradeableReason: pcs.blockReason,
              liquidity: "low",
              liquidityNote: pcs.blockReason || "PCS route blocked",
              volume24hUsd,
              updatedAt: now,
              priceImpactPct,
              dataSource,
            });
            continue;
          } else if (!tokenPriceUsd) {
            if (dex?.priceUsd) {
              tokenPriceUsd = dex.priceUsd;
              dataSource = "dexscreener";
            } else if (yahoo?.lastPriceUsd) {
              tokenPriceUsd = yahoo.lastPriceUsd;
              dataSource = "yahoo-underlying-proxy";
            }
          }
        } catch {
          /* keep prior price */
        }
      }

      if (!tokenPriceUsd && yahoo?.lastPriceUsd) {
        tokenPriceUsd = yahoo.lastPriceUsd;
        dataSource = "yahoo-underlying-proxy";
      }

      let tradeableNow = trade.tradeableNow;
      let tradeableReason = trade.tradeableReason;

      // xStocks: only tradeable when a real PCS route exists (spot buy path)
      if (listing.issuer === "xstocks" && !pcsOk) {
        tradeableNow = false;
        tradeableReason =
          "No PancakeSwap V2 pool found on BSC for this xStock yet — compare-only until liquidity appears.";
      }

      if (!tokenPriceUsd) {
        tradeableNow = false;
        tradeableReason = `No live price for ${listing.tokenSymbol} yet.`;
      }

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
              ? `PancakeSwap V2 size-aware quote${
                  priceImpactPct != null
                    ? ` · impact ~${priceImpactPct.toFixed(2)}%`
                    : ""
                }`
              : `Price via ${dataSource}`,
        volume24hUsd,
        updatedAt: now,
        priceImpactPct,
        dataSource,
      });
    }

    return quotes;
  }

  async simulateTrade(req: SimulateTradeRequest): Promise<SimulateTradeResult> {
    const t = req.ticker.toUpperCase();
    const listing = getTokenListing(t, req.issuer);
    const quotes = await this.getQuotes(t, req.amountUsd);
    const q = quotes.find((x) => x.issuer === req.issuer);

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
          { label: "Check trade window", status: "skip" },
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
      if (!pcs.ok) {
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
            { label: "Check trade window", status: "ok" },
            { label: "PancakeSwap getAmountsOut", status: "skip" },
          ],
          warning: pcs.blockReason || "PCS quote failed",
          blocked: true,
          priceImpactPct: pcs.priceImpactPct,
        };
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

      const ratio = listing.tokenToShareRatio || 1;
      const feeUsd = req.amountUsd * 0.0025; // ~PCS LP fee ballpark
      return {
        ok: simOk || !req.walletAddress,
        issuer: req.issuer,
        ticker: t,
        amountUsd: req.amountUsd,
        estimatedTokens: pcs.amountOutTokens,
        effectivePricePerShare: pcs.effectiveTokenPriceUsd / ratio,
        estimatedFeesUsd: feeUsd,
        route: `USDT → ${q.tokenSymbol} via ${pcs.pathLabel} (PancakeSwap V2)`,
        steps: [
          { label: "Check trade window", status: "ok" },
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

    // Ondo / bStocks: stub until Binance Web3
    const ratio = q.tokenToShareRatio || 1;
    const feeBps = 8;
    const estimatedFeesUsd = (req.amountUsd * feeBps) / 10_000;
    const spendable = req.amountUsd - estimatedFeesUsd;
    const estimatedTokens =
      q.tokenPriceUsd > 0 ? spendable / q.tokenPriceUsd : 0;

    return {
      ok: true,
      issuer: req.issuer,
      ticker: t,
      amountUsd: req.amountUsd,
      estimatedTokens,
      effectivePricePerShare: q.tokenPriceUsd / ratio,
      estimatedFeesUsd,
      route: `USDT → ${q.tokenSymbol} (needs Binance Web3 API for live fill)`,
      steps: [
        { label: "Check trade window", status: "ok" },
        { label: "Normalize price per share", status: "ok" },
        { label: "Estimate fees & tokens out", status: "ok" },
        {
          label: "Live fill requires Binance Web3 API",
          status: "pending",
        },
      ],
      warning:
        "Simulate only — Ondo/bStock live buys need BINANCE_LIVE + portal API keys.",
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
        "Ondo/bStock execute needs Binance Web3 API (BINANCE_LIVE=true + keys). Spot buy is stubbed.",
    };
  }
}

export const HYBRID_TICKERS = [...FEATURED_TICKER_SET];
