import type {
  BinanceWeb3Client,
  ExecuteTradeRequest,
  ExecuteTradeResult,
  IssuerMeta,
  MarketClose,
  RawIssuerQuote,
  SimulateTradeRequest,
  SimulateTradeResult,
  Ticker,
} from "./types";

const ISSUERS: IssuerMeta[] = [
  {
    id: "bstocks",
    displayName: "bStocks",
    shortName: "bStocks",
    hoursNote: "Near 24/7 on BNB; may pause around corporate actions",
  },
  {
    id: "ondo",
    displayName: "Ondo",
    shortName: "Ondo",
    hoursNote: "Aligned with US market hours + limited after-hours",
  },
  {
    id: "xstocks",
    displayName: "xStocks",
    shortName: "xStocks",
    hoursNote: "Extended hours on BNB; weekend quotes can drift",
  },
];

/**
 * Fixture market closes (last NYSE regular session).
 * Weekend / off-hours demos use these as the "true" reference.
 */
const MARKET_CLOSES: Record<string, MarketClose> = {
  NVDA: {
    ticker: "NVDA",
    closeUsd: 178.4,
    asOf: "2026-09-26T20:00:00.000Z",
    sessionLabel: "NYSE close",
  },
  AAPL: {
    ticker: "AAPL",
    closeUsd: 228.15,
    asOf: "2026-09-26T20:00:00.000Z",
    sessionLabel: "NYSE close",
  },
};

/**
 * Realistic weekend-drift fixtures for 3 issuers × 2 tickers.
 * tokensPerShare differs so "token price" alone is misleading — that's the point of Parity.
 */
function buildQuotes(ticker: Ticker): RawIssuerQuote[] {
  const t = ticker.toUpperCase();
  const now = new Date().toISOString();

  // Heuristic: weekends / Fri night → some venues less tradeable
  const day = new Date().getUTCDay(); // 0 Sun … 6 Sat
  const isWeekend = day === 0 || day === 6;

  if (t === "NVDA") {
    return [
      {
        issuer: "bstocks",
        ticker: t,
        tokenSymbol: "bNVDA",
        tokenPriceUsd: 179.85,
        tokensPerShare: 1,
        tradeableNow: true,
        liquidity: "high",
        liquidityNote: "Deep pool; typical fill for $20–$5k",
        volume24hUsd: 4_200_000,
        updatedAt: now,
      },
      {
        issuer: "ondo",
        ticker: t,
        tokenSymbol: "NVDA.on",
        // Ondo often closer to close during US hours; wider gap off-hours
        tokenPriceUsd: isWeekend ? 18.12 : 17.88,
        tokensPerShare: 10, // 10 tokens = 1 share → true share ≈ 181.2 weekend
        tradeableNow: !isWeekend,
        tradeableReason: isWeekend
          ? "Ondo spot pauses over the weekend"
          : undefined,
        liquidity: "medium",
        liquidityNote: isWeekend
          ? "Not tradeable now — check again Mon open"
          : "Solid depth during US hours",
        volume24hUsd: 1_850_000,
        updatedAt: now,
      },
      {
        issuer: "xstocks",
        ticker: t,
        tokenSymbol: "xNVDA",
        // Weekend premium drift example
        tokenPriceUsd: isWeekend ? 184.2 : 179.1,
        tokensPerShare: 1,
        tradeableNow: true,
        liquidity: isWeekend ? "low" : "medium",
        liquidityNote: isWeekend
          ? "Thin weekend book — larger slippage risk"
          : "Good for small spot buys",
        volume24hUsd: isWeekend ? 320_000 : 2_100_000,
        updatedAt: now,
      },
    ];
  }

  if (t === "AAPL") {
    return [
      {
        issuer: "bstocks",
        ticker: t,
        tokenSymbol: "bAAPL",
        tokenPriceUsd: 229.4,
        tokensPerShare: 1,
        tradeableNow: true,
        liquidity: "high",
        liquidityNote: "Deep pool; typical fill for $20–$5k",
        volume24hUsd: 3_600_000,
        updatedAt: now,
      },
      {
        issuer: "ondo",
        ticker: t,
        tokenSymbol: "AAPL.on",
        tokenPriceUsd: isWeekend ? 23.05 : 22.82,
        tokensPerShare: 10,
        tradeableNow: !isWeekend,
        tradeableReason: isWeekend
          ? "Ondo spot pauses over the weekend"
          : undefined,
        liquidity: "medium",
        liquidityNote: isWeekend
          ? "Not tradeable now — check again Mon open"
          : "Solid depth during US hours",
        volume24hUsd: 1_420_000,
        updatedAt: now,
      },
      {
        issuer: "xstocks",
        ticker: t,
        tokenSymbol: "xAAPL",
        tokenPriceUsd: isWeekend ? 232.8 : 228.9,
        tokensPerShare: 1,
        tradeableNow: true,
        liquidity: isWeekend ? "low" : "medium",
        liquidityNote: isWeekend
          ? "Thin weekend book — larger slippage risk"
          : "Good for small spot buys",
        volume24hUsd: isWeekend ? 280_000 : 1_900_000,
        updatedAt: now,
      },
    ];
  }

  // Unknown ticker → empty (UI should nudge user to NVDA / AAPL in mock mode)
  return [];
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export class MockBinanceWeb3Client implements BinanceWeb3Client {
  async listIssuers(): Promise<IssuerMeta[]> {
    await sleep(80);
    return ISSUERS;
  }

  async getMarketClose(ticker: Ticker): Promise<MarketClose | null> {
    await sleep(60);
    return MARKET_CLOSES[ticker.toUpperCase()] ?? null;
  }

  async getQuotes(ticker: Ticker): Promise<RawIssuerQuote[]> {
    await sleep(120);
    return buildQuotes(ticker);
  }

  async simulateTrade(req: SimulateTradeRequest): Promise<SimulateTradeResult> {
    await sleep(200);
    const quotes = buildQuotes(req.ticker);
    const q = quotes.find((x) => x.issuer === req.issuer);

    if (!q) {
      return {
        ok: false,
        issuer: req.issuer,
        ticker: req.ticker.toUpperCase(),
        amountUsd: req.amountUsd,
        estimatedTokens: 0,
        effectivePricePerShare: 0,
        estimatedFeesUsd: 0,
        route: "none",
        steps: [{ label: "Lookup quote", status: "skip" }],
        warning: `No mock quote for ${req.ticker} on ${req.issuer}`,
      };
    }

    if (!q.tradeableNow) {
      return {
        ok: false,
        issuer: req.issuer,
        ticker: req.ticker.toUpperCase(),
        amountUsd: req.amountUsd,
        estimatedTokens: 0,
        effectivePricePerShare: q.tokenPriceUsd * q.tokensPerShare,
        estimatedFeesUsd: 0,
        route: `${q.tokenSymbol} (unavailable)`,
        steps: [
          { label: "Check trade window", status: "skip" },
          { label: "Build swap path", status: "skip" },
        ],
        warning: q.tradeableReason ?? "Not tradeable right now",
      };
    }

    const feeBps = 8; // 0.08% mock fee
    const estimatedFeesUsd = (req.amountUsd * feeBps) / 10_000;
    const spendable = req.amountUsd - estimatedFeesUsd;
    const estimatedTokens = spendable / q.tokenPriceUsd;
    const effectivePricePerShare = q.tokenPriceUsd * q.tokensPerShare;

    return {
      ok: true,
      issuer: req.issuer,
      ticker: req.ticker.toUpperCase(),
      amountUsd: req.amountUsd,
      estimatedTokens,
      effectivePricePerShare,
      estimatedFeesUsd,
      route: `USDT → ${q.tokenSymbol} (spot, BSC)`,
      steps: [
        { label: "Check trade window", status: "ok" },
        { label: "Normalize price per share", status: "ok" },
        { label: "Estimate fees & tokens out", status: "ok" },
        { label: "Dry-run swap path", status: "ok" },
      ],
      warning:
        q.liquidity === "low"
          ? "Low liquidity — expect more slippage on live execute"
          : undefined,
    };
  }

  async executeTrade(req: ExecuteTradeRequest): Promise<ExecuteTradeResult> {
    await sleep(100);
    // Intentionally stubbed — no live swaps without API keys + wallet
    return {
      ok: false,
      stubbed: true,
      message:
        "Execute is stubbed. Connect a wallet and set BINANCE_WEB3_API_KEY to enable live BSC spot buys.",
      txHash: undefined,
    };
  }
}
